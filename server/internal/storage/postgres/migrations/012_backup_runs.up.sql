-- What the nightly dump did, recorded where the dashboard can see it.
--
-- backup.sh runs on the host; the dashboard runs in a container with no host
-- mounts at all — it cannot read a log file, a crontab or the .env. The one
-- thing both sides already reach is this database, so the backup script reports
-- into the very database it just dumped.
--
-- Deliberately not project-scoped: a dump covers the whole instance, and
-- "when did this server last back itself up" is an operator's question, not a
-- tenant's.
CREATE TABLE IF NOT EXISTS backup_runs (
    id          BIGSERIAL PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 'ok' or 'failed'. A failed run is the one worth keeping: it is the only
    -- record that the dump did not happen, since nobody reads cron mail.
    status      VARCHAR(16) NOT NULL,
    -- Size of the dump. NULL when the run failed before writing one.
    bytes       BIGINT,
    -- Absolute path of the dump on the server.
    path        TEXT,
    -- The rclone remote it was copied to, empty when it stayed local.
    remote      TEXT NOT NULL DEFAULT '',
    -- Why it failed, for the run that needs explaining.
    message     TEXT NOT NULL DEFAULT ''
);

-- No index: this table gains one row a night. Reading 365 of them in date order
-- is faster than maintaining a b-tree over them.
