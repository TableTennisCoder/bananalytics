#!/usr/bin/env bash
#
# Dumps the Bananalytics database to a compressed file, prunes old dumps and
# optionally copies the result off-site.
#
#   ./scripts/backup.sh
#
# Run it from the server/ directory, or point BANANA_BACKUP_DIR at an absolute
# path. Configuration comes from .env — see the "Backups" section there.
#
# Nightly via cron (3:30 am), logging to syslog:
#   30 3 * * * cd /opt/bananalytics/server && ./scripts/backup.sh 2>&1 | logger -t bananalytics-backup
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a; . ./.env; set +a
fi

DB_USER="${BANANA_DB_USER:-bananalytics}"
DB_NAME="${BANANA_DB_NAME:-bananalytics}"
BACKUP_DIR="${BANANA_BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BANANA_BACKUP_RETENTION_DAYS:-14}"
REMOTE="${BANANA_BACKUP_REMOTE:-}"

# The database has no published port, so the dump runs inside the container.
compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

if ! compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    echo "ERROR: the postgres container is not running — start it with 'docker compose up -d'." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
target="$BACKUP_DIR/bananalytics-$timestamp.sql.gz"
# Write to a temporary name first so an interrupted run cannot leave a
# truncated file that looks like a usable backup.
partial="$target.partial"

echo "Dumping $DB_NAME -> $target"

# A plain dump, deliberately without --clean: on a partitioned table pg_dump
# emits DROP CONSTRAINT for constraints the partitions inherit, which Postgres
# refuses to execute. restore.sh recreates the database instead, so the dump
# never needs to clean up after itself.
if ! compose exec -T postgres \
        pg_dump --username="$DB_USER" --dbname="$DB_NAME" \
    | gzip -9 > "$partial"; then
    rm -f "$partial"
    echo "ERROR: pg_dump failed — no backup written." >&2
    exit 1
fi

# A dump of an empty or unreachable database still produces a few bytes of
# header, so treat a suspiciously small file as a failure rather than success.
size=$(wc -c < "$partial")
if [ "$size" -lt 1000 ]; then
    rm -f "$partial"
    echo "ERROR: dump is only ${size} bytes — refusing to keep it." >&2
    exit 1
fi

mv "$partial" "$target"
echo "Wrote $(du -h "$target" | cut -f1)"

if [ -n "$REMOTE" ]; then
    if ! command -v rclone >/dev/null 2>&1; then
        echo "WARNING: BANANA_BACKUP_REMOTE is set but rclone is not installed — keeping the local copy only." >&2
    else
        echo "Uploading to $REMOTE"
        rclone copy "$target" "$REMOTE"
    fi
fi

# Prune local dumps last: a failure above must never delete existing backups.
if [ "$RETENTION_DAYS" -gt 0 ]; then
    deleted=$(find "$BACKUP_DIR" -name 'bananalytics-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
    if [ "$deleted" -gt 0 ]; then
        echo "Pruned $deleted dump(s) older than $RETENTION_DAYS days"
    fi
fi

echo "Backup complete."
