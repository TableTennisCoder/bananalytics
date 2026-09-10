-- Revenue as a first-class column rather than a value buried in JSONB.
--
-- Summing a JSONB field on every query means casting text to numeric across the
-- whole range; a real numeric column lets Postgres aggregate directly and lets
-- the partial index below skip the (usually large) majority of non-revenue rows.
ALTER TABLE events ADD COLUMN IF NOT EXISTS revenue  NUMERIC(18,4);
ALTER TABLE events ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

-- Revenue rows are a small fraction of all events, so the index only covers them.
CREATE INDEX IF NOT EXISTS idx_events_revenue
    ON events (project_id, created_at)
    WHERE revenue IS NOT NULL;

-- The view must be recreated to expose the new columns: CREATE OR REPLACE can
-- only append columns, and revenue belongs with the other event fields rather
-- than after the derived person_id.
DROP VIEW IF EXISTS events_resolved;

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
    e.revenue,
    e.currency,
    COALESCE(e.user_id, i.user_id, e.anonymous_id) AS person_id
FROM events e
LEFT JOIN identities i
    ON i.project_id = e.project_id
   AND i.anonymous_id = e.anonymous_id;
