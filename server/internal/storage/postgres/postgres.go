package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
)

// EventStore implements storage.EventRepository using PostgreSQL.
type EventStore struct {
	pool *pgxpool.Pool
}

// NewEventStore creates a new PostgreSQL event store.
func NewEventStore(pool *pgxpool.Pool) *EventStore {
	return &EventStore{pool: pool}
}

// InsertBatch inserts events, deduplicating on (project_id, message_id).
func (s *EventStore) InsertBatch(ctx context.Context, events []domain.Event) (int, error) {
	if len(events) == 0 {
		return 0, nil
	}

	batch := &pgx.Batch{}
	for _, e := range events {
		// Serialize geo to JSON, nil if no geo data
		var geoJSON []byte
		if e.Geo != nil {
			geoJSON, _ = json.Marshal(e.Geo)
		}

		batch.Queue(insertEventQuery,
			e.MessageID, e.ProjectID, e.EventName, e.Type,
			e.Properties, e.Context,
			e.UserID, e.AnonymousID,
			e.ClientTS, e.ServerTS, e.SessionID, e.ServerTS, geoJSON,
		)
	}

	results := s.pool.SendBatch(ctx, batch)
	defer results.Close()

	accepted := 0
	for range events {
		tag, err := results.Exec()
		if err != nil {
			continue // skip failed inserts (e.g., constraint violations)
		}
		accepted += int(tag.RowsAffected())
	}

	return accepted, nil
}

// QueryEvents retrieves events matching the given filters.
func (s *EventStore) QueryEvents(ctx context.Context, filter storage.EventFilter) ([]domain.Event, error) {
	query := queryEventsSQL
	args := []any{filter.ProjectID}
	paramIdx := 2

	if filter.Event != "" {
		query += fmt.Sprintf(queryEventsByNameSQL, paramIdx)
		args = append(args, filter.Event)
		paramIdx++
	}

	if filter.UserID != "" {
		query += fmt.Sprintf(queryEventsByUserSQL, paramIdx, paramIdx+1)
		args = append(args, filter.UserID, filter.UserID)
		paramIdx += 2
	}

	if !filter.From.IsZero() {
		query += fmt.Sprintf(queryEventsFromSQL, paramIdx)
		args = append(args, filter.From)
		paramIdx++
	}

	if !filter.To.IsZero() {
		query += fmt.Sprintf(queryEventsToSQL, paramIdx)
		args = append(args, filter.To)
		paramIdx++
	}

	query += queryEventsOrderSQL

	limit := filter.Limit
	if limit == 0 {
		limit = 100
	}
	query += fmt.Sprintf(queryEventsLimitSQL, paramIdx, paramIdx+1)
	args = append(args, limit, filter.Offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query events: %w", err)
	}
	defer rows.Close()

	var events []domain.Event
	for rows.Next() {
		var e domain.Event
		if err := rows.Scan(
			&e.ID, &e.ProjectID, &e.MessageID, &e.EventName, &e.Type,
			&e.Properties, &e.Context,
			&e.UserID, &e.AnonymousID,
			&e.ClientTS, &e.ServerTS, &e.SessionID, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}

	return events, rows.Err()
}

// QueryFunnel computes funnel step counts.
func (s *EventStore) QueryFunnel(ctx context.Context, projectID string, steps []string, from, to time.Time) ([]storage.FunnelStep, error) {
	rows, err := s.pool.Query(ctx, queryFunnelSQL, projectID, from, to, steps)
	if err != nil {
		return nil, fmt.Errorf("query funnel: %w", err)
	}
	defer rows.Close()

	stepCounts := make(map[string]int)
	for rows.Next() {
		var event string
		var count int
		if err := rows.Scan(&event, &count); err != nil {
			return nil, fmt.Errorf("scan funnel step: %w", err)
		}
		stepCounts[event] = count
	}

	// Return in the order of the requested steps
	result := make([]storage.FunnelStep, 0, len(steps))
	for _, step := range steps {
		result = append(result, storage.FunnelStep{
			Step:  step,
			Count: stepCounts[step],
		})
	}

	return result, rows.Err()
}

// QuerySessions retrieves session data for a user.
func (s *EventStore) QuerySessions(ctx context.Context, projectID string, userID string) ([]storage.Session, error) {
	rows, err := s.pool.Query(ctx, querySessionsSQL, projectID, userID)
	if err != nil {
		return nil, fmt.Errorf("query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []storage.Session
	for rows.Next() {
		var sess storage.Session
		if err := rows.Scan(&sess.SessionID, &sess.UserID, &sess.StartedAt, &sess.EndedAt, &sess.EventCount); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, sess)
	}

	return sessions, rows.Err()
}

// QueryRetention computes retention cohorts.
func (s *EventStore) QueryRetention(ctx context.Context, projectID string, from, to time.Time) ([]storage.RetentionCohort, error) {
	rows, err := s.pool.Query(ctx, queryRetentionSQL, projectID, from, to)
	if err != nil {
		return nil, fmt.Errorf("query retention: %w", err)
	}
	defer rows.Close()

	var cohorts []storage.RetentionCohort
	for rows.Next() {
		var c storage.RetentionCohort
		if err := rows.Scan(&c.Cohort, &c.CohortSize, &c.Period, &c.Retained); err != nil {
			return nil, fmt.Errorf("scan retention cohort: %w", err)
		}
		cohorts = append(cohorts, c)
	}

	return cohorts, rows.Err()
}

// QueryStats returns aggregated overview metrics.
func (s *EventStore) QueryStats(ctx context.Context, projectID string, from, to time.Time) (*storage.StatsOverview, error) {
	var stats storage.StatsOverview
	err := s.pool.QueryRow(ctx, queryStatsSQL, projectID, from, to).Scan(
		&stats.TotalEvents, &stats.UniqueUsers, &stats.ActiveSessions,
		&stats.EventsPerMinute, &stats.TopCountry,
	)
	if err != nil {
		return nil, fmt.Errorf("query stats: %w", err)
	}
	return &stats, nil
}

// QueryTimeseries returns event counts bucketed by time interval.
func (s *EventStore) QueryTimeseries(ctx context.Context, projectID string, from, to time.Time, interval string, event string) ([]storage.TimeseriesPoint, error) {
	var baseQuery string
	switch interval {
	case "minute":
		baseQuery = queryTimeseriesMinuteSQL
	case "day":
		baseQuery = queryTimeseriesDaySQL
	default:
		baseQuery = queryTimeseriesHourSQL
	}

	var args []any
	args = append(args, projectID, from, to)

	if event != "" {
		baseQuery += queryTimeseriesEventFilterSQL
		args = append(args, event)
	}
	baseQuery += queryTimeseriesGroupSQL

	rows, err := s.pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("query timeseries: %w", err)
	}
	defer rows.Close()

	var points []storage.TimeseriesPoint
	for rows.Next() {
		var p storage.TimeseriesPoint
		if err := rows.Scan(&p.Bucket, &p.Count); err != nil {
			return nil, fmt.Errorf("scan timeseries: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// QueryTopEvents returns the top N events by count.
func (s *EventStore) QueryTopEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]storage.TopEvent, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.pool.Query(ctx, queryTopEventsSQL, projectID, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("query top events: %w", err)
	}
	defer rows.Close()

	var events []storage.TopEvent
	for rows.Next() {
		var e storage.TopEvent
		if err := rows.Scan(&e.Event, &e.Count); err != nil {
			return nil, fmt.Errorf("scan top event: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// QueryEventNames returns distinct event names for a project.
func (s *EventStore) QueryEventNames(ctx context.Context, projectID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, queryEventNamesSQL, projectID)
	if err != nil {
		return nil, fmt.Errorf("query event names: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan event name: %w", err)
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// QueryGeo returns event counts grouped by country or city.
func (s *EventStore) QueryGeo(ctx context.Context, projectID string, from, to time.Time, groupBy string) ([]storage.GeoData, error) {
	query := queryGeoByCountrySQL
	if groupBy == "city" {
		query = queryGeoByCitySQL
	}

	rows, err := s.pool.Query(ctx, query, projectID, from, to)
	if err != nil {
		return nil, fmt.Errorf("query geo: %w", err)
	}
	defer rows.Close()

	var data []storage.GeoData
	for rows.Next() {
		var g storage.GeoData
		if err := rows.Scan(&g.Country, &g.CountryCode, &g.City, &g.Count, &g.UniqueUsers, &g.Lat, &g.Lng); err != nil {
			return nil, fmt.Errorf("scan geo: %w", err)
		}
		data = append(data, g)
	}
	return data, rows.Err()
}

// QueryLive returns real-time activity data.
func (s *EventStore) QueryLive(ctx context.Context, projectID string) (*storage.LiveData, error) {
	live := &storage.LiveData{}

	// Active users in last 5 min
	err := s.pool.QueryRow(ctx, queryLiveActiveUsersSQL, projectID).Scan(&live.ActiveUsers)
	if err != nil {
		return nil, fmt.Errorf("query live active users: %w", err)
	}

	// Events in last minute
	err = s.pool.QueryRow(ctx, queryLiveEventsLastMinuteSQL, projectID).Scan(&live.EventsLastMinute)
	if err != nil {
		return nil, fmt.Errorf("query live events/min: %w", err)
	}

	// Recent events
	rows, err := s.pool.Query(ctx, queryLiveRecentEventsSQL, projectID)
	if err != nil {
		return nil, fmt.Errorf("query live recent events: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var e storage.EventResult
		if err := rows.Scan(&e.ID, &e.Event, &e.Type, &e.Properties, &e.UserID, &e.AnonymousID, &e.Timestamp, &e.SessionID); err != nil {
			return nil, fmt.Errorf("scan live event: %w", err)
		}
		live.RecentEvents = append(live.RecentEvents, e)
	}

	return live, rows.Err()
}

// ProjectStore implements storage.ProjectRepository using PostgreSQL.
type ProjectStore struct {
	pool *pgxpool.Pool
}

// NewProjectStore creates a new PostgreSQL project store.
func NewProjectStore(pool *pgxpool.Pool) *ProjectStore {
	return &ProjectStore{pool: pool}
}

// Create inserts a new project with hashed API keys.
func (s *ProjectStore) Create(ctx context.Context, project *domain.Project) error {
	_, err := s.pool.Exec(ctx, insertProjectQuery,
		project.ID, project.Name, project.WriteKey, project.SecretKey,
		project.WriteKey[:8], hashKey(project.WriteKey),
		project.SecretKey[:8], hashKey(project.SecretKey),
		project.CreatedAt, project.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create project: %w", err)
	}
	return nil
}

func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// FindByWriteKey looks up a project by write key.
func (s *ProjectStore) FindByWriteKey(ctx context.Context, writeKey string) (*domain.Project, error) {
	return s.scanProject(ctx, findProjectByWriteKeyQuery, writeKey)
}

// FindBySecretKey looks up a project by secret key.
func (s *ProjectStore) FindBySecretKey(ctx context.Context, secretKey string) (*domain.Project, error) {
	return s.scanProject(ctx, findProjectBySecretKeyQuery, secretKey)
}

// FindByWriteKeyPrefix looks up projects by write key prefix for hash-based verification.
func (s *ProjectStore) FindByWriteKeyPrefix(ctx context.Context, prefix string) ([]storage.ProjectWithHash, error) {
	return s.scanProjectsWithHash(ctx, findProjectByWriteKeyPrefixQuery, prefix)
}

// FindBySecretKeyPrefix looks up projects by secret key prefix for hash-based verification.
func (s *ProjectStore) FindBySecretKeyPrefix(ctx context.Context, prefix string) ([]storage.ProjectWithHash, error) {
	return s.scanProjectsWithHash(ctx, findProjectBySecretKeyPrefixQuery, prefix)
}

// FindByID looks up a project by ID.
func (s *ProjectStore) FindByID(ctx context.Context, id string) (*domain.Project, error) {
	return s.scanProject(ctx, findProjectByIDQuery, id)
}

// RotateKeys updates the write and secret keys for a project, including hashes.
func (s *ProjectStore) RotateKeys(ctx context.Context, id string, newWriteKey, newSecretKey string) error {
	tag, err := s.pool.Exec(ctx, rotateKeysQuery, id, newWriteKey, newSecretKey,
		newWriteKey[:8], hashKey(newWriteKey),
		newSecretKey[:8], hashKey(newSecretKey),
	)
	if err != nil {
		return fmt.Errorf("rotate keys: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "project", ID: id}
	}
	return nil
}

func (s *ProjectStore) scanProject(ctx context.Context, query string, arg any) (*domain.Project, error) {
	var p domain.Project
	err := s.pool.QueryRow(ctx, query, arg).Scan(
		&p.ID, &p.Name, &p.WriteKey, &p.SecretKey, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, &domain.ErrNotFound{Resource: "project", ID: fmt.Sprintf("%v", arg)}
		}
		return nil, fmt.Errorf("find project: %w", err)
	}
	return &p, nil
}

func (s *ProjectStore) scanProjectsWithHash(ctx context.Context, query string, prefix string) ([]storage.ProjectWithHash, error) {
	rows, err := s.pool.Query(ctx, query, prefix)
	if err != nil {
		return nil, fmt.Errorf("find projects by prefix: %w", err)
	}
	defer rows.Close()

	var results []storage.ProjectWithHash
	for rows.Next() {
		var pwh storage.ProjectWithHash
		var keyHash string
		if err := rows.Scan(
			&pwh.Project.ID, &pwh.Project.Name,
			&pwh.Project.WriteKey, &pwh.Project.SecretKey,
			&keyHash,
			&pwh.Project.CreatedAt, &pwh.Project.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan project with hash: %w", err)
		}
		pwh.KeyHash = keyHash
		results = append(results, pwh)
	}
	return results, rows.Err()
}
