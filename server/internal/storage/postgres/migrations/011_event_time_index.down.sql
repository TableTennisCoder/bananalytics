-- Restores the two indexes 011 replaced. The funnel index is recreated with its
-- original pre-identity-resolution expression, matching migration 006.
CREATE INDEX IF NOT EXISTS idx_events_person_event_ts
    ON events (project_id, event, (COALESCE(user_id, anonymous_id)), client_ts);

CREATE INDEX IF NOT EXISTS idx_events_project_event
    ON events (project_id, event);

DROP INDEX IF EXISTS idx_events_project_event_ts;
