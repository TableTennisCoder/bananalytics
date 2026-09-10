package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Rollup keeps the daily aggregate tables in step with the raw event stream.
//
// Rebuilding is per (project, day) and idempotent: a day is deleted and
// recomputed inside one transaction, so a reader never sees a half-built day and
// a crashed run costs nothing but the work it had done. Days in the past are
// built once; the current day is rebuilt on every pass, which is what bounds how
// stale the dashboard can be.
//
// created_at is the server's receive time, so a past day never gains new rows.
// The one-day lookback covers events that were in flight across midnight.
type Rollup struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

// NewRollup creates a rollup maintainer.
func NewRollup(pool *pgxpool.Pool, logger *slog.Logger) *Rollup {
	return &Rollup{pool: pool, logger: logger}
}

// lookbackDays is how far back a refresh rebuilds beyond the watermark.
const lookbackDays = 1

// maxBackfillDays caps how much history a single refresh will build for a
// project that has never been rolled up, so a first run on a large database
// makes visible progress instead of occupying one long transaction.
const maxBackfillDays = 400

const deleteEventDaySQL = `DELETE FROM rollup_event_daily WHERE project_id = $1 AND day = $2`

// Built from raw events rather than events_resolved: none of these metrics need
// identity resolution, so the join to identities would be pure cost.
const insertEventDaySQL = `
	INSERT INTO rollup_event_daily (
		project_id, day, event, platform, country, country_code, city, currency,
		events, revenue, revenue_events, paying_events, lat_sum, lng_sum, geo_events
	)
	SELECT
		project_id,
		$2::date,
		event,
		COALESCE(context->'device'->>'os', ''),
		COALESCE(geo->>'country', ''),
		COALESCE(geo->>'country_code', ''),
		COALESCE(geo->>'city', ''),
		COALESCE(currency, ''),
		COUNT(*),
		COALESCE(SUM(revenue), 0),
		COUNT(*) FILTER (WHERE revenue IS NOT NULL),
		COUNT(*) FILTER (WHERE revenue > 0),
		COALESCE(SUM((geo->>'lat')::float8), 0),
		COALESCE(SUM((geo->>'lng')::float8), 0),
		COUNT(*) FILTER (WHERE geo->>'lat' IS NOT NULL)
	FROM events
	WHERE project_id = $1
	  AND created_at >= $2::date
	  AND created_at < ($2::date + 1)
	GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`

const deletePersonDaySQL = `DELETE FROM rollup_person_daily WHERE project_id = $1 AND day = $2`

// This one does read events_resolved: counting people rather than devices is the
// whole point of the table.
const insertPersonDaySQL = `
	INSERT INTO rollup_person_daily (
		project_id, day, person_id, event, platform, country, currency, events, revenue
	)
	SELECT
		project_id,
		$2::date,
		person_id,
		event,
		COALESCE(context->'device'->>'os', ''),
		COALESCE(geo->>'country', ''),
		COALESCE(currency, ''),
		COUNT(*),
		COALESCE(SUM(revenue), 0)
	FROM ` + eventsTable + `
	WHERE project_id = $1
	  AND created_at >= $2::date
	  AND created_at < ($2::date + 1)
	GROUP BY 1, 2, 3, 4, 5, 6, 7`

const upsertStateSQL = `
	INSERT INTO rollup_state (project_id, rolled_through, updated_at)
	VALUES ($1, $2, NOW())
	ON CONFLICT (project_id) DO UPDATE
	SET rolled_through = GREATEST(rollup_state.rolled_through, EXCLUDED.rolled_through),
	    updated_at = NOW()`

// RebuildDay recomputes both rollup tables for one project and day.
func (r *Rollup) RebuildDay(ctx context.Context, projectID string, day time.Time) error {
	d := day.UTC().Format("2006-01-02")

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin rollup tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rolled back only if commit did not run

	for _, step := range []struct {
		name string
		sql  string
	}{
		{"delete events", deleteEventDaySQL},
		{"insert events", insertEventDaySQL},
		{"delete persons", deletePersonDaySQL},
		{"insert persons", insertPersonDaySQL},
	} {
		if _, err := tx.Exec(ctx, step.sql, projectID, d); err != nil {
			return fmt.Errorf("rollup %s for %s on %s: %w", step.name, projectID, d, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit rollup for %s on %s: %w", projectID, d, err)
	}
	return nil
}

// projectRange is the span a project still needs built.
type projectRange struct {
	projectID string
	from      time.Time
	to        time.Time
}

// pendingSQL finds, per project, the first day that needs rebuilding.
//
// A project with a watermark restarts one day behind it; a project without one
// starts at its earliest event. Projects that have never received an event are
// skipped — there is nothing to aggregate.
const pendingSQL = `
	SELECT p.id::text,
	       COALESCE(s.rolled_through - $1::int, e.first_day) AS from_day
	FROM projects p
	LEFT JOIN rollup_state s ON s.project_id = p.id
	LEFT JOIN LATERAL (
		SELECT MIN(created_at)::date AS first_day
		FROM events
		WHERE project_id = p.id
	) e ON TRUE
	WHERE COALESCE(s.rolled_through - $1::int, e.first_day) IS NOT NULL`

// Refresh brings every project's rollups up to today.
func (r *Rollup) Refresh(ctx context.Context) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	rows, err := r.pool.Query(ctx, pendingSQL, lookbackDays)
	if err != nil {
		return fmt.Errorf("find pending rollups: %w", err)
	}

	var pending []projectRange
	for rows.Next() {
		var pr projectRange
		if err := rows.Scan(&pr.projectID, &pr.from); err != nil {
			rows.Close()
			return fmt.Errorf("scan pending rollup: %w", err)
		}
		pr.from = pr.from.UTC().Truncate(24 * time.Hour)
		if earliest := today.AddDate(0, 0, -maxBackfillDays); pr.from.Before(earliest) {
			pr.from = earliest
		}
		pr.to = today
		pending = append(pending, pr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read pending rollups: %w", err)
	}

	var days int
	start := time.Now()

	for _, pr := range pending {
		for day := pr.from; !day.After(pr.to); day = day.AddDate(0, 0, 1) {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := r.RebuildDay(ctx, pr.projectID, day); err != nil {
				return err
			}
			days++
		}

		if _, err := r.pool.Exec(ctx, upsertStateSQL, pr.projectID, pr.to.Format("2006-01-02")); err != nil {
			return fmt.Errorf("update rollup state for %s: %w", pr.projectID, err)
		}
	}

	if days > 0 {
		r.logger.Info("rollups refreshed",
			"projects", len(pending),
			"days", days,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}
	return nil
}

// Start refreshes once, then on every tick until the context is cancelled.
//
// The interval is what bounds dashboard staleness: an event is visible in the
// aggregates within one tick of being ingested. Real-time views read the raw
// table directly and are unaffected.
func (r *Rollup) Start(ctx context.Context, interval time.Duration) {
	if err := r.Refresh(ctx); err != nil && ctx.Err() == nil {
		r.logger.Error("initial rollup refresh failed", "error", err)
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				r.logger.Info("rollup refresh stopped")
				return
			case <-ticker.C:
				if err := r.Refresh(ctx); err != nil && ctx.Err() == nil {
					r.logger.Error("rollup refresh failed", "error", err)
				}
			}
		}
	}()
}

// RolledThrough reports the last day a project's rollups are known good, and
// whether the project has been rolled up at all. The query layer uses it to
// decide whether a requested range can be served from aggregates.
func (r *Rollup) RolledThrough(ctx context.Context, projectID string) (time.Time, bool, error) {
	var through time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT rolled_through FROM rollup_state WHERE project_id = $1`, projectID,
	).Scan(&through)

	if err == pgx.ErrNoRows {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, fmt.Errorf("read rollup state: %w", err)
	}
	return through.UTC(), true, nil
}
