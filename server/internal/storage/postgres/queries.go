// Package postgres implements storage interfaces using PostgreSQL.
//
// Queries that accept caller-supplied filters or breakdown dimensions are
// assembled at call time by the helpers in builder.go, which bind every value —
// including JSON path segments — as a positional parameter. The constants here
// are the queries whose shape never varies.
package postgres

const (
	insertEventQuery = `
		INSERT INTO events (message_id, project_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at, geo, revenue, currency)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (project_id, message_id, created_at) DO NOTHING`

	insertProjectQuery = `
		INSERT INTO projects (id, name, write_key, secret_key, write_key_prefix, write_key_hash, secret_key_prefix, secret_key_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	findProjectByWriteKeyQuery = `
		SELECT id, name, write_key, secret_key, created_at, updated_at
		FROM projects WHERE write_key = $1`

	findProjectByWriteKeyPrefixQuery = `
		SELECT id, name, write_key, secret_key, write_key_hash, created_at, updated_at
		FROM projects WHERE write_key_prefix = $1`

	findProjectBySecretKeyQuery = `
		SELECT id, name, write_key, secret_key, created_at, updated_at
		FROM projects WHERE secret_key = $1`

	findProjectBySecretKeyPrefixQuery = `
		SELECT id, name, write_key, secret_key, secret_key_hash, created_at, updated_at
		FROM projects WHERE secret_key_prefix = $1`

	findProjectByIDQuery = `
		SELECT id, name, write_key, secret_key, created_at, updated_at
		FROM projects WHERE id = $1`

	rotateKeysQuery = `
		UPDATE projects SET write_key = $2, secret_key = $3,
			write_key_prefix = $4, write_key_hash = $5,
			secret_key_prefix = $6, secret_key_hash = $7,
			updated_at = NOW()
		WHERE id = $1`

	// Identity mappings are written once per person; a later conflicting
	// identify is ignored rather than retroactively rewriting who past events
	// belonged to. See migration 007 for why that is safe.
	insertIdentityQuery = `
		INSERT INTO identities (project_id, anonymous_id, user_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (project_id, anonymous_id) DO NOTHING`

	querySessionsSQL = `
		SELECT session_id, user_id,
			MIN(client_ts) as started_at,
			MAX(client_ts) as ended_at,
			COUNT(*) as event_count
		FROM ` + eventsTable + `
		WHERE project_id = $1 AND (person_id = $2 OR anonymous_id = $2)
		GROUP BY session_id, user_id
		ORDER BY started_at DESC`

	// Cohorts are keyed on person_id, so someone who signs in mid-cohort stays in
	// the cohort they started in instead of appearing as a second new person.
	queryRetentionSQL = `
		WITH first_seen AS (
			SELECT person_id, DATE(MIN(created_at)) as cohort_date
			FROM ` + eventsTable + `
			WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
			GROUP BY person_id
		),
		activity AS (
			SELECT e.person_id, DATE(e.created_at) as activity_date, fs.cohort_date
			FROM ` + eventsTable + ` e
			JOIN first_seen fs ON e.person_id = fs.person_id
			WHERE e.project_id = $1 AND e.created_at >= $2 AND e.created_at <= $3
		)
		SELECT
			cohort_date::text as cohort,
			COUNT(DISTINCT CASE WHEN activity_date = cohort_date THEN person_id END) as cohort_size,
			(activity_date - cohort_date) as period,
			COUNT(DISTINCT person_id) as retained
		FROM activity
		GROUP BY cohort_date, period
		ORDER BY cohort_date, period`

	queryEventNamesSQL = `
		SELECT DISTINCT event FROM events WHERE project_id = $1 ORDER BY event`

	// The created_at bound is what lets Postgres prune partitions: the table is
	// partitioned on created_at, but the question is asked about server_ts. Both
	// are set to the same instant on insert, so the wider hour-long bound cannot
	// drop a row that the server_ts filter would have kept.
	queryLiveActiveUsersSQL = `
		SELECT COUNT(DISTINCT person_id)
		FROM ` + eventsTable + `
		WHERE project_id = $1
		  AND created_at >= NOW() - INTERVAL '1 hour'
		  AND server_ts >= NOW() - INTERVAL '5 minutes'`

	queryLiveEventsLastMinuteSQL = `
		SELECT COUNT(*)
		FROM events
		WHERE project_id = $1
		  AND created_at >= NOW() - INTERVAL '1 hour'
		  AND server_ts >= NOW() - INTERVAL '1 minute'`

	queryLiveRecentEventsSQL = `
		SELECT id, event, type, properties, user_id, anonymous_id, client_ts, session_id
		FROM events
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT 20`
)
