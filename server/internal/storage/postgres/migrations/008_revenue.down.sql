DROP VIEW IF EXISTS events_resolved;
DROP INDEX IF EXISTS idx_events_revenue;

ALTER TABLE events DROP COLUMN IF EXISTS revenue;
ALTER TABLE events DROP COLUMN IF EXISTS currency;

-- Restore the pre-revenue view from migration 007.
CREATE VIEW events_resolved AS
SELECT
    e.id,
    e.project_id,
    e.message_id,
    e.event,
    e.type,
    e.properties,
    e.context,
    e.user_id,
    e.anonymous_id,
    e.client_ts,
    e.server_ts,
    e.session_id,
    e.created_at,
    e.geo,
    COALESCE(e.user_id, i.user_id, e.anonymous_id) AS person_id
FROM events e
LEFT JOIN identities i
    ON i.project_id = e.project_id
   AND i.anonymous_id = e.anonymous_id;
