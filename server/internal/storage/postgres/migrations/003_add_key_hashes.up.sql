-- Add hash columns for secure API key storage.
-- write_key_prefix / secret_key_prefix: first 8 chars for fast DB lookup
-- write_key_hash / secret_key_hash: SHA-256 hex digest for verification
ALTER TABLE projects ADD COLUMN IF NOT EXISTS write_key_prefix VARCHAR(8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS write_key_hash VARCHAR(64);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secret_key_prefix VARCHAR(8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secret_key_hash VARCHAR(64);

-- Index on prefixes for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_write_key_prefix ON projects(write_key_prefix);
CREATE INDEX IF NOT EXISTS idx_projects_secret_key_prefix ON projects(secret_key_prefix);
