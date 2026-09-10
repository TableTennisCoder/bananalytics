-- Daily rollups.
--
-- Every dashboard query was a GROUP BY over a full scan of the raw event stream,
-- so response time grew linearly with the events in the window — measured at
-- roughly 2-3 seconds per million rows scanned. These tables collapse that stream
-- into one row per (project, day, dimension combination), which is the shape the
-- dashboard actually asks for.
--
-- Two tables, because the metrics split into two kinds:
--
--   rollup_event_daily   additive metrics (counts, revenue). Summing buckets is
--                        correct, so any date range is a SUM over daily rows.
--
--   rollup_person_daily  one row per person per day, because COUNT(DISTINCT) is
--                        NOT summable — a person active on three days is one
--                        unique user, not three. Keeping person granularity lets
--                        a range query re-count distinctly over a table that is
--                        still far smaller and much narrower than raw events.
--
-- The event name sits in the person table's key as well. Measured on 4.22M real
-- rows that costs 11% more rows (953k vs 856k) — people trigger few distinct
-- event types per day — and in exchange one table answers every unique-user
-- question the dashboard asks, per event, per platform, or over a whole range.
--
-- Only the built-in dimensions are rolled up. A breakdown on an arbitrary
-- properties path still reads raw events; the query layer decides per request.

CREATE TABLE IF NOT EXISTS rollup_event_daily (
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    day           DATE NOT NULL,
    event         TEXT NOT NULL,
    -- Empty string rather than NULL: these are primary key columns, and NULL
    -- would make every "not set" row collide-free but unmatchable.
    platform      TEXT NOT NULL DEFAULT '',
    country       TEXT NOT NULL DEFAULT '',
    country_code  TEXT NOT NULL DEFAULT '',
    city          TEXT NOT NULL DEFAULT '',
    currency      TEXT NOT NULL DEFAULT '',

    events        BIGINT NOT NULL DEFAULT 0,
    revenue       NUMERIC(20,4) NOT NULL DEFAULT 0,
    -- Two different counts, deliberately. A transaction is any event that
    -- carried a revenue field; paying_events excludes the zero-value ones.
    revenue_events BIGINT NOT NULL DEFAULT 0,
    paying_events BIGINT NOT NULL DEFAULT 0,

    -- Sums, not averages, so that re-averaging across buckets stays weighted.
    lat_sum       DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng_sum       DOUBLE PRECISION NOT NULL DEFAULT 0,
    geo_events    BIGINT NOT NULL DEFAULT 0,

    PRIMARY KEY (project_id, day, event, platform, country, country_code, city, currency)
);

CREATE TABLE IF NOT EXISTS rollup_person_daily (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    day        DATE NOT NULL,
    person_id  TEXT NOT NULL,
    event      TEXT NOT NULL,
    platform   TEXT NOT NULL DEFAULT '',
    country    TEXT NOT NULL DEFAULT '',
    -- Revenue figures are always reported in one currency, so attributing a
    -- paying person to a currency needs it in the key here too.
    currency   TEXT NOT NULL DEFAULT '',

    events     BIGINT NOT NULL DEFAULT 0,
    revenue    NUMERIC(20,4) NOT NULL DEFAULT 0,

    PRIMARY KEY (project_id, day, person_id, event, platform, country, currency)
);

-- How far each project has been rolled up. Per project rather than global so a
-- newly created project does not drag every other project's watermark backwards.
CREATE TABLE IF NOT EXISTS rollup_state (
    project_id     UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    rolled_through DATE NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The primary keys already lead with (project_id, day), which serves every range
-- scan the dashboard issues. These two add the orderings the hot paths want:
-- ranking events by volume, and counting distinct people without touching the
-- dimension columns.
CREATE INDEX IF NOT EXISTS idx_rollup_event_daily_rank
    ON rollup_event_daily (project_id, day, events DESC);

-- The primary key leads with (project_id, day, person_id), which already serves
-- "distinct people in a range". Ranking events by reach asks the other way round,
-- so this ordering lets that stay index-only.
CREATE INDEX IF NOT EXISTS idx_rollup_person_daily_event
    ON rollup_person_daily (project_id, day, event, person_id);

-- No extra index on events is needed here: idx_events_project_ts covers the
-- per-day scan a rollup build does, and migration 008's idx_events_revenue
-- already indexes (project_id, created_at) WHERE revenue IS NOT NULL.
