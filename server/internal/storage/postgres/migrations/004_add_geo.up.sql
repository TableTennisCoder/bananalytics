-- Add geo-location data to events (populated by server-side IP lookup)
ALTER TABLE events ADD COLUMN IF NOT EXISTS geo JSONB;

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS idx_events_geo_country ON events ((geo->>'country_code'))
    WHERE geo IS NOT NULL;
