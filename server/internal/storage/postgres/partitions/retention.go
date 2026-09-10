package partitions

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// Raw event retention.
//
// Dropping a whole monthly partition is close to free — no DELETE over millions
// of rows, no VACUUM afterwards, no bloat left behind. That is the only reason
// this is worth doing automatically rather than leaving it to an operator.
//
// It is also irreversible, so the work here is mostly about refusing to run:
//
//   1. Retention is off unless someone sets it, and self-hosted installs are
//      expected to leave it off. Losing a user's data because a default
//      expired it would be inexcusable.
//   2. A partition is dropped only when its entire range is older than the
//      cutoff. A partition holding a single in-window row stays.
//   3. Nothing is dropped until the rollups covering it are built, because the
//      aggregates are what keeps the dashboard's history intact afterwards.
//      Dropping first would destroy the data permanently.
//   4. A partition whose declared bounds do not match its name is left alone.
//      Something created it by hand, and guessing would be worse than skipping.

// MinRetentionMonths is the shortest retention this will accept.
//
// Below two months the current and previous month are at risk, which is where
// every query that reads raw events actually looks.
const MinRetentionMonths = 2

// partitionName matches the names EnsurePartitions creates.
var partitionName = regexp.MustCompile(`^events_(\d{4})_(\d{2})$`)

// listPartitionsSQL returns every child of events with its declared bounds and
// its estimated row count. reltuples is an estimate, which is all a log line
// needs and avoids counting a partition just to announce its removal.
const listPartitionsSQL = `
	SELECT c.relname,
	       pg_get_expr(c.relpartbound, c.oid),
	       GREATEST(c.reltuples, 0)::bigint,
	       pg_total_relation_size(c.oid)
	FROM pg_class c
	JOIN pg_inherits i ON i.inhrelid = c.oid
	WHERE i.inhparent = 'events'::regclass
	ORDER BY c.relname`

// rollupCoverageSQL reports how far the rollups are built.
//
// unrolled counts projects that have events but no rollup state at all; a single
// one of those means the aggregates are incomplete and nothing may be dropped.
// earliest is the furthest-behind project among those that do have state.
const rollupCoverageSQL = `
	SELECT
		COUNT(*) FILTER (WHERE e.first_day IS NOT NULL AND s.rolled_through IS NULL),
		MIN(s.rolled_through) FILTER (WHERE e.first_day IS NOT NULL)
	FROM projects p
	LEFT JOIN rollup_state s ON s.project_id = p.id
	LEFT JOIN LATERAL (
		SELECT MIN(created_at)::date AS first_day
		FROM events
		WHERE project_id = p.id
	) e ON TRUE`

// partition is one child table of events.
type partition struct {
	name  string
	upper time.Time // exclusive: the first instant NOT in this partition
	rows  int64
	bytes int64
}

// DropExpired removes partitions whose data is entirely older than months.
//
// Returns the number of partitions dropped. A months value of zero or less
// means retention is disabled and nothing happens.
func (m *Manager) DropExpired(ctx context.Context, months int) (int, error) {
	if months <= 0 {
		return 0, nil
	}
	if months < MinRetentionMonths {
		return 0, fmt.Errorf("raw retention of %d months is too short (minimum %d)", months, MinRetentionMonths)
	}

	// The cutoff is the start of the oldest month being kept. A partition may go
	// only if it ends at or before that instant.
	now := time.Now().UTC()
	cutoff := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)

	safe, reason, err := m.rollupsCover(ctx, cutoff)
	if err != nil {
		return 0, err
	}
	if !safe {
		// Not an error: the rollup worker is simply still catching up. Retention
		// will get its turn on the next pass.
		m.logger.Info("raw retention skipped, rollups not caught up yet",
			"reason", reason, "cutoff", cutoff.Format("2006-01-02"))
		return 0, nil
	}

	parts, err := m.expiredPartitions(ctx, cutoff)
	if err != nil {
		return 0, err
	}

	dropped := 0
	for _, p := range parts {
		if _, err := m.pool.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", p.name)); err != nil {
			return dropped, fmt.Errorf("drop expired partition %s: %w", p.name, err)
		}
		m.logger.Info("dropped expired raw events",
			"partition", p.name,
			"approx_rows", p.rows,
			"freed_bytes", p.bytes,
			"retention_months", months,
		)
		dropped++
	}
	return dropped, nil
}

// rollupsCover reports whether every project's aggregates are built past the
// cutoff, so that dropping raw data below it loses nothing the dashboard shows.
func (m *Manager) rollupsCover(ctx context.Context, cutoff time.Time) (bool, string, error) {
	var unrolled int64
	var earliest *time.Time

	if err := m.pool.QueryRow(ctx, rollupCoverageSQL).Scan(&unrolled, &earliest); err != nil {
		return false, "", fmt.Errorf("check rollup coverage: %w", err)
	}

	if unrolled > 0 {
		return false, fmt.Sprintf("%d project(s) have events but no rollups yet", unrolled), nil
	}
	if earliest == nil {
		// No project has any events. Nothing to drop, and nothing to protect.
		return true, "", nil
	}
	if earliest.UTC().Before(cutoff) {
		return false, fmt.Sprintf("rollups only built through %s", earliest.UTC().Format("2006-01-02")), nil
	}
	return true, "", nil
}

// expiredPartitions returns the children whose range ends at or before cutoff.
func (m *Manager) expiredPartitions(ctx context.Context, cutoff time.Time) ([]partition, error) {
	rows, err := m.pool.Query(ctx, listPartitionsSQL)
	if err != nil {
		return nil, fmt.Errorf("list partitions: %w", err)
	}
	defer rows.Close()

	var expired []partition
	for rows.Next() {
		var name, bound string
		var rowCount, size int64
		if err := rows.Scan(&name, &bound, &rowCount, &size); err != nil {
			return nil, fmt.Errorf("scan partition: %w", err)
		}

		upper, ok := boundsFromName(name)
		if !ok {
			m.logger.Warn("skipping partition with unrecognised name", "partition", name)
			continue
		}
		// Guard against dropping a partition whose real bounds differ from what
		// its name implies — it was not created by EnsurePartitions.
		if !boundMatches(bound, upper) {
			m.logger.Warn("skipping partition whose bounds do not match its name",
				"partition", name, "bound", bound)
			continue
		}

		if !upper.After(cutoff) {
			expired = append(expired, partition{name: name, upper: upper, rows: rowCount, bytes: size})
		}
	}
	return expired, rows.Err()
}

// boundsFromName derives the exclusive upper bound from a partition's name.
func boundsFromName(name string) (time.Time, bool) {
	match := partitionName.FindStringSubmatch(name)
	if match == nil {
		return time.Time{}, false
	}
	year, err := strconv.Atoi(match[1])
	if err != nil {
		return time.Time{}, false
	}
	month, err := strconv.Atoi(match[2])
	if err != nil || month < 1 || month > 12 {
		return time.Time{}, false
	}
	// The partition covers one month, so it ends where the next one begins.
	return time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0), true
}

// boundMatches checks that a partition's declared upper bound is the date the
// name implies. Postgres renders bounds as
// FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00').
func boundMatches(bound string, upper time.Time) bool {
	to := regexp.MustCompile(`TO \('(\d{4}-\d{2}-\d{2})`).FindStringSubmatch(bound)
	if to == nil {
		return false
	}
	return to[1] == upper.Format("2006-01-02")
}

// ValidateRetention checks a configured retention window without running
// anything, so a bad setting stops the server at startup rather than being
// discovered a day later by a worker that quietly refused to do its job.
func ValidateRetention(months int) error {
	if months < 0 {
		return fmt.Errorf("raw retention months must not be negative, got %d", months)
	}
	if months > 0 && months < MinRetentionMonths {
		return fmt.Errorf(
			"raw retention of %d months is too short: use 0 to keep events forever, or at least %d",
			months, MinRetentionMonths)
	}
	return nil
}

// StartRetention drops expired partitions once, then daily.
//
// Runs alongside StartAutoCreation: one end of the window grows, the other is
// trimmed. Disabled entirely when months is zero, which is the default.
func (m *Manager) StartRetention(ctx context.Context, months int) {
	if months <= 0 {
		m.logger.Info("raw event retention disabled, events are kept forever")
		return
	}

	m.logger.Info("raw event retention enabled", "months", months)

	run := func() {
		dropped, err := m.DropExpired(ctx, months)
		if err != nil && ctx.Err() == nil {
			m.logger.Error("raw retention failed", "error", err)
			return
		}
		if dropped > 0 {
			m.logger.Info("raw retention complete", "partitions_dropped", dropped)
		}
	}

	run()

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				m.logger.Info("raw retention stopped")
				return
			case <-ticker.C:
				run()
			}
		}
	}()
}
