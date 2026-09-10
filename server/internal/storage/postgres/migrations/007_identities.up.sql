-- Identity resolution: link the anonymous events a person produced before
-- logging in to the user they turned out to be.
--
-- The SDK generates a fresh anonymous_id on reset() (logout), so an anonymous_id
-- belongs to at most one user. The first identify therefore wins; a later
-- conflicting mapping is ignored rather than silently rewriting history.
CREATE TABLE IF NOT EXISTS identities (
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    anonymous_id VARCHAR(256) NOT NULL,
    user_id      VARCHAR(256) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, anonymous_id)
);

CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(project_id, user_id);

-- events_resolved is what every analytics query reads. person_id answers
-- "which human is this?" instead of "which device is this?", so someone who
-- browsed anonymously and then signed in counts once rather than twice.
--
-- Priority: an event's own user_id is ground truth for that event; the identity
-- mapping fills in pre-login events; otherwise the person is their device.
--
-- Columns are listed explicitly: a view built with e.* freezes its column list
-- at creation, so a later migration adding an events column must recreate this
-- view anyway — being explicit makes that dependency visible.
CREATE OR REPLACE VIEW events_resolved AS
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
