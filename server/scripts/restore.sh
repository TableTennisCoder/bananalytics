#!/usr/bin/env bash
#
# Restores a Bananalytics dump created by scripts/backup.sh.
#
#   ./scripts/restore.sh backups/bananalytics-2026-08-30T03-30-00Z.sql.gz
#
# This REPLACES the current database: it is dropped and recreated empty, then
# the dump is loaded into it. Restoring on top of the existing schema is not an
# option here — pg_dump emits DROP CONSTRAINT for constraints the monthly event
# partitions inherit, and Postgres refuses to execute those.
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a; . ./.env; set +a
fi

DB_USER="${BANANA_DB_USER:-bananalytics}"
DB_NAME="${BANANA_DB_NAME:-bananalytics}"

# The names are interpolated into SQL below, so refuse anything that is not a
# plain identifier rather than trusting the .env file.
if ! printf '%s' "$DB_NAME" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "ERROR: BANANA_DB_NAME must be a plain identifier, got '$DB_NAME'." >&2
    exit 1
fi
if ! printf '%s' "$DB_USER" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "ERROR: BANANA_DB_USER must be a plain identifier, got '$DB_USER'." >&2
    exit 1
fi

dump="${1:-}"
if [ -z "$dump" ]; then
    echo "Usage: $0 <dump.sql.gz>" >&2
    echo >&2
    echo "Available dumps:" >&2
    ls -1t "${BANANA_BACKUP_DIR:-./backups}"/bananalytics-*.sql.gz 2>/dev/null | head -10 >&2 || echo "  (none found)" >&2
    exit 1
fi

if [ ! -f "$dump" ]; then
    echo "ERROR: $dump does not exist." >&2
    exit 1
fi

compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# Runs SQL against the maintenance database, which stays connectable while the
# application database is being dropped and recreated.
maintenance_psql() {
    compose exec -T postgres psql --username="$DB_USER" --dbname=postgres -v ON_ERROR_STOP=1 -q "$@"
}

if ! compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    echo "ERROR: the postgres container is not running — start it with 'docker compose up -d'." >&2
    exit 1
fi

echo "About to restore into database '$DB_NAME':"
echo "  $dump"
echo
echo "This REPLACES all current analytics data and cannot be undone."
read -r -p "Type the database name to confirm: " answer
if [ "$answer" != "$DB_NAME" ]; then
    echo "Aborted."
    exit 1
fi

# Stop the backend so it cannot reconnect while the database is being replaced.
echo "Stopping the backend..."
compose stop bananalytics >/dev/null

restore_failed=0

echo "Recreating the database..."
if ! maintenance_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null \
   || ! maintenance_psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" \
   || ! maintenance_psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"; then
    echo "ERROR: could not recreate the database." >&2
    echo "Starting the backend..."
    compose start bananalytics >/dev/null
    exit 1
fi

echo "Restoring..."
if ! gunzip -c "$dump" | compose exec -T postgres \
        psql --username="$DB_USER" --dbname="$DB_NAME" -v ON_ERROR_STOP=1 -q >/dev/null; then
    restore_failed=1
fi

echo "Starting the backend..."
compose start bananalytics >/dev/null

if [ "$restore_failed" -ne 0 ]; then
    echo >&2
    echo "ERROR: the restore failed and the database is now empty." >&2
    echo "Try an older dump, or check the file is not truncated:" >&2
    echo "  gunzip -t $dump" >&2
    exit 1
fi

echo "Restore complete. The server re-checks migrations on start."
