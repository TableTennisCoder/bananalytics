-- The "what is happening right now" queries filter on server_ts, but events is
-- partitioned on created_at. With nothing constraining the partition key,
-- Postgres cannot prune and sequentially scans every monthly partition — 24 of
-- them — to answer a question about the last five minutes.
--
-- The queries themselves now also carry a created_at bound so pruning applies.
-- This index is what makes the surviving partition cheap to look in.
CREATE INDEX IF NOT EXISTS idx_events_project_server_ts
    ON events (project_id, server_ts DESC);
