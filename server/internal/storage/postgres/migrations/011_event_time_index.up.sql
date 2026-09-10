-- Index housekeeping on events, driven by measured plans rather than guesses.
--
-- 1. Add created_at to the (project_id, event) index.
--
--    Funnels and any event-filtered range query match on exactly these three
--    columns. Without created_at in the index, Postgres combined the event index
--    with the primary key and then rechecked the range against the heap. With it,
--    all three become index conditions. Measured on a three-day slice of 4.2M
--    events: 6845 ms before, 546 ms after.
--
-- 2. Drop the old (project_id, event) index, now a strict prefix of the new one.
--
-- 3. Drop the funnel index from migration 006.
--
--    It indexes the expression COALESCE(user_id, anonymous_id), which was how a
--    person was identified before migration 007 introduced identity resolution.
--    Funnels now group by COALESCE(user_id, identities.user_id, anonymous_id) —
--    a different expression, and one that spans a join, so no single-table index
--    can match it. Postgres has not been able to use this index since 007; it was
--    costing 123 MB per populated partition and a write on every insert.

CREATE INDEX IF NOT EXISTS idx_events_project_event_ts
    ON events (project_id, event, created_at);

DROP INDEX IF EXISTS idx_events_project_event;

DROP INDEX IF EXISTS idx_events_person_event_ts;
