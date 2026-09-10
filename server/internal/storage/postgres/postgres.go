package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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

		// An empty currency is stored as NULL rather than an empty string so the
		// "no currency stated" case is a single value, not two.
		var currency any
		if e.Currency != "" {
			currency = e.Currency
		}

		batch.Queue(insertEventQuery,
			e.MessageID, e.ProjectID, e.EventName, e.Type,
			e.Properties, e.Context,
			e.UserID, e.AnonymousID,
			e.ClientTS, e.ServerTS, e.SessionID, e.ServerTS, geoJSON,
			e.Revenue, currency,
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
	var a argList

	clauses := []string{"project_id = " + a.bind(filter.ProjectID)}

	if filter.Event != "" {
		clauses = append(clauses, "event = "+a.bind(filter.Event))
	}
	if filter.UserID != "" {
		// Matching person_id finds a user's pre-login events too; anonymous_id is
		// kept so a device that never identified is still searchable by its ID.
		person := a.bind(filter.UserID)
		clauses = append(clauses, "(person_id = "+person+" OR anonymous_id = "+person+")")
	}
	if !filter.From.IsZero() {
		clauses = append(clauses, "created_at >= "+a.bind(filter.From))
	}
	if !filter.To.IsZero() {
		clauses = append(clauses, "created_at <= "+a.bind(filter.To))
	}
	for _, f := range filter.Filters {
		clauses = append(clauses, dimensionExpr(f.Dimension, "", &a)+" = "+a.bind(f.Value))
	}

	limit := filter.Limit
	if limit == 0 {
		limit = 100
	}

	query := fmt.Sprintf(`
		SELECT id, project_id, message_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at
		FROM `+eventsTable+`
		WHERE %s
		ORDER BY created_at DESC
		LIMIT %s OFFSET %s`,
		strings.Join(clauses, " AND "), a.bind(limit), a.bind(filter.Offset))

	rows, err := s.pool.Query(ctx, query, a.args...)
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

// QueryFunnel computes conversion through an ordered sequence of event steps.
func (s *EventStore) QueryFunnel(ctx context.Context, params storage.FunnelParams) ([]storage.FunnelStep, error) {
	steps := params.Steps
	if len(steps) == 0 {
		return nil, nil
	}

	query, args := buildFunnelQuery(params)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query funnel: %w", err)
	}
	defer rows.Close()

	counts := make([]int, len(steps))
	medians := make([]*float64, len(steps))
	for rows.Next() {
		var index int
		var reached int64
		var median *float64
		if err := rows.Scan(&index, &reached, &median); err != nil {
			return nil, fmt.Errorf("scan funnel step: %w", err)
		}
		if index < 1 || index > len(steps) {
			continue
		}
		counts[index-1] = int(reached)
		medians[index-1] = median
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("query funnel: %w", err)
	}

	return storage.NewFunnelResult(steps, counts, medians), nil
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
func (s *EventStore) QueryStats(ctx context.Context, params storage.QueryParams) (*storage.StatsOverview, error) {
	if w, ok := s.rollupPlan(ctx, scopeOf(params), true); ok {
		return s.statsFromRollup(ctx, params, w)
	}

	var a argList
	where := scopeOf(params).where("", &a)

	// Everything is derived from one scoped scan, so the leading country and
	// currency are resolved *within* whatever segment is being viewed.
	//
	// Revenue is restricted to the leading currency: summing across currencies
	// without exchange rates would produce a number that means nothing.
	query := fmt.Sprintf(`
		WITH scoped AS (
			SELECT %s AS person_id, session_id, server_ts, geo, revenue, currency
			FROM `+eventsTable+`
			WHERE %s
		),
		top_currency AS (
			SELECT COALESCE(currency, '') AS code
			FROM scoped
			WHERE revenue IS NOT NULL
			GROUP BY 1
			ORDER BY SUM(revenue) DESC NULLS LAST
			LIMIT 1
		)
		SELECT
			COUNT(*) AS total_events,
			COUNT(DISTINCT person_id) AS unique_users,
			COUNT(DISTINCT CASE WHEN server_ts >= NOW() - INTERVAL '30 minutes' THEN session_id END) AS active_sessions,
			COALESCE(COUNT(*) FILTER (WHERE server_ts >= NOW() - INTERVAL '30 minutes') / 30.0, 0) AS events_per_minute,
			COALESCE(
				(SELECT geo->>'country' FROM scoped WHERE geo IS NOT NULL
				 GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1),
				'Unknown'
			) AS top_country,
			COALESCE((SELECT code FROM top_currency), '') AS top_currency,
			COALESCE(
				SUM(revenue) FILTER (WHERE COALESCE(currency, '') = (SELECT code FROM top_currency)),
				0
			)::float8 AS revenue
		FROM scoped`,
		personColumn(""), where)

	var stats storage.StatsOverview
	err := s.pool.QueryRow(ctx, query, a.args...).Scan(
		&stats.TotalEvents, &stats.UniqueUsers, &stats.ActiveSessions,
		&stats.EventsPerMinute, &stats.TopCountry,
		&stats.TopCurrency, &stats.Revenue,
	)
	if err != nil {
		return nil, fmt.Errorf("query stats: %w", err)
	}
	return &stats, nil
}

// QueryTimeseries returns event and unique-people counts per time bucket.
func (s *EventStore) QueryTimeseries(ctx context.Context, params storage.QueryParams, interval string) ([]storage.TimeseriesPoint, error) {
	unit := "hour"
	switch interval {
	case "minute", "day":
		unit = interval
	}

	// Only the daily grain matches what the rollups store; hour and minute
	// buckets still come from raw events.
	if unit == "day" {
		if w, ok := s.rollupPlan(ctx, scopeOf(params), true); ok {
			return s.timeseriesFromRollup(ctx, params, w)
		}
	}

	var a argList
	query := fmt.Sprintf(`
		SELECT DATE_TRUNC('%s', created_at)::text AS bucket,
		       COUNT(*) AS count,
		       COUNT(DISTINCT %s) AS unique_users
		FROM `+eventsTable+`
		WHERE %s
		GROUP BY bucket
		ORDER BY bucket`,
		unit, personColumn(""), scopeOf(params).where("", &a))

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query timeseries: %w", err)
	}
	defer rows.Close()

	var points []storage.TimeseriesPoint
	for rows.Next() {
		var p storage.TimeseriesPoint
		if err := rows.Scan(&p.Bucket, &p.Count, &p.UniqueUsers); err != nil {
			return nil, fmt.Errorf("scan timeseries: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// QueryTopEvents returns the top N events by count.
func (s *EventStore) QueryTopEvents(ctx context.Context, params storage.QueryParams, limit int) ([]storage.TopEvent, error) {
	if limit <= 0 {
		limit = 10
	}

	if w, ok := s.rollupPlan(ctx, scopeOf(params), true); ok {
		return s.topEventsFromRollup(ctx, params, w, limit)
	}

	var a argList
	query := fmt.Sprintf(`
		SELECT event, COUNT(*) AS count, COUNT(DISTINCT %s) AS unique_users
		FROM `+eventsTable+`
		WHERE %s
		GROUP BY event
		ORDER BY count DESC
		LIMIT %s`,
		personColumn(""), scopeOf(params).where("", &a), a.bind(limit))

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query top events: %w", err)
	}
	defer rows.Close()

	var events []storage.TopEvent
	for rows.Next() {
		var e storage.TopEvent
		if err := rows.Scan(&e.Event, &e.Count, &e.UniqueUsers); err != nil {
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
func (s *EventStore) QueryGeo(ctx context.Context, params storage.QueryParams, groupBy string) ([]storage.GeoData, error) {
	if w, ok := s.rollupPlan(ctx, scopeOf(params), true); ok {
		return s.geoFromRollup(ctx, params, w, groupBy)
	}

	cityColumn, cityGroup := "'' AS city", ""
	if groupBy == "city" {
		cityColumn = "COALESCE(geo->>'city', 'Unknown') AS city"
		cityGroup = ", geo->>'city'"
	}

	var a argList
	query := fmt.Sprintf(`
		SELECT
			COALESCE(geo->>'country', 'Unknown') AS country,
			COALESCE(geo->>'country_code', '') AS country_code,
			%s,
			COUNT(*) AS count,
			COUNT(DISTINCT %s) AS unique_users,
			COALESCE(AVG((geo->>'lat')::float), 0) AS lat,
			COALESCE(AVG((geo->>'lng')::float), 0) AS lng
		FROM `+eventsTable+`
		WHERE %s
		GROUP BY geo->>'country', geo->>'country_code'%s
		ORDER BY count DESC`,
		cityColumn, personColumn(""), scopeOf(params).where("", &a), cityGroup)

	rows, err := s.pool.Query(ctx, query, a.args...)
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

// QueryBreakdown groups events by a dimension, ranked by volume. This is what
// turns an aggregate number into an answer: not "500 people dropped off" but
// "450 of them were on Android 1.2".
func (s *EventStore) QueryBreakdown(ctx context.Context, params storage.BreakdownParams) ([]storage.BreakdownBucket, error) {
	limit := params.Limit
	if limit <= 0 || limit > storage.MaxBreakdownValues {
		limit = storage.MaxBreakdownValues
	}

	sc := scope{
		ProjectID: params.ProjectID,
		From:      params.From,
		To:        params.To,
		Event:     params.Event,
		Filters:   params.Filters,
	}

	// A breakdown on an arbitrary properties path has no rollup column, so only
	// the built-in dimensions take this route.
	if w, ok := s.rollupPlan(ctx, sc, true); ok {
		buckets, err := s.breakdownFromRollup(ctx, params, w, limit)
		if err == nil {
			return buckets, nil
		}
		if !errors.Is(err, errRollupUnsupported) {
			return nil, err
		}
	}

	var a argList

	// The dimension is rendered before the scope so its bound path segments keep
	// their placeholder numbers in the order the arguments are appended.
	value := dimensionExpr(params.Dimension, "", &a)

	person := personColumn("")
	query := fmt.Sprintf(`
		SELECT COALESCE(%s, '(not set)') AS value,
		       COUNT(*) AS count,
		       COUNT(DISTINCT %s) AS unique_users,
		       COALESCE(SUM(revenue), 0)::float8 AS revenue,
		       COUNT(DISTINCT %s) FILTER (WHERE revenue > 0) AS paying_users
		FROM `+eventsTable+`
		WHERE %s
		GROUP BY 1
		ORDER BY count DESC
		LIMIT %s`,
		value, person, person, sc.where("", &a), a.bind(limit))

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query breakdown: %w", err)
	}
	defer rows.Close()

	var buckets []storage.BreakdownBucket
	for rows.Next() {
		var b storage.BreakdownBucket
		if err := rows.Scan(&b.Value, &b.Count, &b.UniqueUsers, &b.Revenue, &b.PayingUsers); err != nil {
			return nil, fmt.Errorf("scan breakdown: %w", err)
		}
		buckets = append(buckets, b)
	}
	return buckets, rows.Err()
}

// QueryPropertyKeys returns the custom property names seen on a project's events.
//
// Expanding every properties object is expensive, so this samples the most recent
// events rather than scanning the whole range — enough to populate a dimension
// picker without turning it into a full table scan.
func (s *EventStore) QueryPropertyKeys(ctx context.Context, projectID string, from, to time.Time) ([]string, error) {
	const sampleSize = 50000

	var a argList
	query := fmt.Sprintf(`
		SELECT DISTINCT jsonb_object_keys(properties) AS key
		FROM (
			SELECT properties
			FROM `+eventsTable+`
			WHERE project_id = %s AND created_at >= %s AND created_at <= %s
			  AND properties <> '{}'::jsonb
			ORDER BY created_at DESC
			LIMIT %d
		) recent
		ORDER BY key
		LIMIT %d`,
		a.bind(projectID), a.bind(from), a.bind(to), sampleSize, storage.MaxBreakdownValues)

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query property keys: %w", err)
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("scan property key: %w", err)
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

// QueryActiveUsers returns daily, weekly and monthly active people per day.
//
// WAU and MAU are rolling windows, not calendar buckets: the WAU of a day counts
// everyone active in the 7 days ending on it. The activity scan therefore starts
// a full month before the requested range so the earliest days have a complete
// lookback instead of ramping up from zero.
func (s *EventStore) QueryActiveUsers(ctx context.Context, params storage.QueryParams) ([]storage.ActiveUsersPoint, error) {
	const mauDays = 30

	if w, ok := s.rollupPlan(ctx, scopeOf(params), true); ok {
		return s.activeUsersFromRollup(ctx, params, w)
	}

	activity := scopeOf(params)
	activity.From = params.From.AddDate(0, 0, -(mauDays - 1))

	var a argList
	query := fmt.Sprintf(`
		WITH days AS (
			SELECT generate_series(%s::date, %s::date, '1 day')::date AS day
		),
		activity AS (
			SELECT DISTINCT person_id, created_at::date AS day
			FROM `+eventsTable+`
			WHERE %s
		)
		SELECT
			d.day::text AS bucket,
			COUNT(DISTINCT a.person_id) FILTER (WHERE a.day = d.day) AS dau,
			COUNT(DISTINCT a.person_id) FILTER (WHERE a.day > d.day - 7) AS wau,
			COUNT(DISTINCT a.person_id) AS mau
		FROM days d
		LEFT JOIN activity a ON a.day > d.day - %d AND a.day <= d.day
		GROUP BY d.day
		ORDER BY d.day`,
		a.bind(params.From), a.bind(params.To), activity.where("", &a), mauDays)

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query active users: %w", err)
	}
	defer rows.Close()

	var points []storage.ActiveUsersPoint
	for rows.Next() {
		var p storage.ActiveUsersPoint
		if err := rows.Scan(&p.Bucket, &p.DAU, &p.WAU, &p.MAU); err != nil {
			return nil, fmt.Errorf("scan active users: %w", err)
		}
		if p.MAU > 0 {
			p.Stickiness = float64(p.DAU) / float64(p.MAU) * 100
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// LinkIdentities records anonymous-to-user mappings.
func (s *EventStore) LinkIdentities(ctx context.Context, links []storage.IdentityLink) error {
	if len(links) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, link := range links {
		batch.Queue(insertIdentityQuery, link.ProjectID, link.AnonymousID, link.UserID)
	}

	results := s.pool.SendBatch(ctx, batch)
	defer results.Close()

	for range links {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("link identity: %w", err)
		}
	}
	return nil
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
