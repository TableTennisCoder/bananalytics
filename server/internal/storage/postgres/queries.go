// Package postgres implements storage interfaces using PostgreSQL.
package postgres

const (
	insertEventQuery = `
		INSERT INTO events (message_id, project_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at, geo)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (project_id, message_id, created_at) DO NOTHING`

	queryEventsSQL = `
		SELECT id, project_id, message_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at
		FROM events
		WHERE project_id = $1`

	queryEventsByNameSQL = ` AND event = $%d`
	queryEventsByUserSQL = ` AND (user_id = $%d OR anonymous_id = $%d)`
	queryEventsFromSQL   = ` AND created_at >= $%d`
	queryEventsToSQL     = ` AND created_at <= $%d`
	queryEventsOrderSQL  = ` ORDER BY created_at DESC`
	queryEventsLimitSQL  = ` LIMIT $%d OFFSET $%d`

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

	queryFunnelSQL = `
		WITH step_users AS (
			SELECT DISTINCT anonymous_id, event, MIN(client_ts) as first_ts
			FROM events
			WHERE project_id = $1
				AND created_at >= $2
				AND created_at <= $3
				AND event = ANY($4)
			GROUP BY anonymous_id, event
		)
		SELECT event, COUNT(DISTINCT anonymous_id)
		FROM step_users
		GROUP BY event`

	querySessionsSQL = `
		SELECT session_id, user_id,
			MIN(client_ts) as started_at,
			MAX(client_ts) as ended_at,
			COUNT(*) as event_count
		FROM events
		WHERE project_id = $1 AND (user_id = $2 OR anonymous_id = $2)
		GROUP BY session_id, user_id
		ORDER BY started_at DESC`

	queryRetentionSQL = `
		WITH first_seen AS (
			SELECT anonymous_id, DATE(MIN(created_at)) as cohort_date
			FROM events
			WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
			GROUP BY anonymous_id
		),
		activity AS (
			SELECT e.anonymous_id, DATE(e.created_at) as activity_date, fs.cohort_date
			FROM events e
			JOIN first_seen fs ON e.anonymous_id = fs.anonymous_id
			WHERE e.project_id = $1 AND e.created_at >= $2 AND e.created_at <= $3
		)
		SELECT
			cohort_date::text as cohort,
			COUNT(DISTINCT CASE WHEN activity_date = cohort_date THEN anonymous_id END) as cohort_size,
			(activity_date - cohort_date) as period,
			COUNT(DISTINCT anonymous_id) as retained
		FROM activity
		GROUP BY cohort_date, period
		ORDER BY cohort_date, period`

	queryStatsSQL = `
		SELECT
			COUNT(*) as total_events,
			COUNT(DISTINCT COALESCE(user_id, anonymous_id)) as unique_users,
			COUNT(DISTINCT CASE WHEN server_ts >= NOW() - INTERVAL '30 minutes' THEN session_id END) as active_sessions,
			COALESCE(COUNT(*) FILTER (WHERE server_ts >= NOW() - INTERVAL '30 minutes') / 30.0, 0) as events_per_minute,
			COALESCE(
				(SELECT geo->>'country' FROM events WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND geo IS NOT NULL
				 GROUP BY geo->>'country' ORDER BY COUNT(*) DESC LIMIT 1),
				'Unknown'
			) as top_country
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3`

	queryTimeseriesHourSQL = `
		SELECT DATE_TRUNC('hour', created_at)::text as bucket, COUNT(*) as count
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3`

	queryTimeseriesDaySQL = `
		SELECT DATE_TRUNC('day', created_at)::text as bucket, COUNT(*) as count
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3`

	queryTimeseriesMinuteSQL = `
		SELECT DATE_TRUNC('minute', created_at)::text as bucket, COUNT(*) as count
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3`

	queryTimeseriesEventFilterSQL = ` AND event = $4`
	queryTimeseriesGroupSQL       = ` GROUP BY bucket ORDER BY bucket`

	queryTopEventsSQL = `
		SELECT event, COUNT(*) as count
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
		GROUP BY event
		ORDER BY count DESC
		LIMIT $4`

	queryEventNamesSQL = `
		SELECT DISTINCT event FROM events WHERE project_id = $1 ORDER BY event`

	queryGeoByCountrySQL = `
		SELECT
			COALESCE(geo->>'country', 'Unknown') as country,
			COALESCE(geo->>'country_code', '') as country_code,
			'' as city,
			COUNT(*) as count,
			COUNT(DISTINCT COALESCE(user_id, anonymous_id)) as unique_users,
			COALESCE(AVG((geo->>'lat')::float), 0) as lat,
			COALESCE(AVG((geo->>'lng')::float), 0) as lng
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
		GROUP BY geo->>'country', geo->>'country_code'
		ORDER BY count DESC`

	queryGeoByCitySQL = `
		SELECT
			COALESCE(geo->>'country', 'Unknown') as country,
			COALESCE(geo->>'country_code', '') as country_code,
			COALESCE(geo->>'city', 'Unknown') as city,
			COUNT(*) as count,
			COUNT(DISTINCT COALESCE(user_id, anonymous_id)) as unique_users,
			COALESCE(AVG((geo->>'lat')::float), 0) as lat,
			COALESCE(AVG((geo->>'lng')::float), 0) as lng
		FROM events
		WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3
		GROUP BY geo->>'country', geo->>'country_code', geo->>'city'
		ORDER BY count DESC`

	queryLiveActiveUsersSQL = `
		SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id))
		FROM events
		WHERE project_id = $1 AND server_ts >= NOW() - INTERVAL '5 minutes'`

	queryLiveEventsLastMinuteSQL = `
		SELECT COUNT(*)
		FROM events
		WHERE project_id = $1 AND server_ts >= NOW() - INTERVAL '1 minute'`

	queryLiveRecentEventsSQL = `
		SELECT id, event, type, properties, user_id, anonymous_id, client_ts, session_id
		FROM events
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT 20`
)
