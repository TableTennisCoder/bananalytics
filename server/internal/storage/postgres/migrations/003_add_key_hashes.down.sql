ALTER TABLE projects DROP COLUMN IF EXISTS write_key_prefix;
ALTER TABLE projects DROP COLUMN IF EXISTS write_key_hash;
ALTER TABLE projects DROP COLUMN IF EXISTS secret_key_prefix;
ALTER TABLE projects DROP COLUMN IF EXISTS secret_key_hash;
