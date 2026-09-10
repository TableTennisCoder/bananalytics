-- Ordered funnel queries join every step back to the previous step's people,
-- filtering by event name and ordering by client_ts. This index covers that
-- access path, including the COALESCE expression used to identify a person.
CREATE INDEX IF NOT EXISTS idx_events_person_event_ts
    ON events (project_id, event, (COALESCE(user_id, anonymous_id)), client_ts);
