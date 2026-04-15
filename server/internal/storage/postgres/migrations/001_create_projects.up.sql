CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    write_key   VARCHAR(64) NOT NULL UNIQUE,
    secret_key  VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_write_key ON projects(write_key);
CREATE INDEX IF NOT EXISTS idx_projects_secret_key ON projects(secret_key);
