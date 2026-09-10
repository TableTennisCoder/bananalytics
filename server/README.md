# Bananalytics Server

Self-hosted analytics backend for React Native apps. Ingests events from the `@bananalytics/react-native` SDK, stores them in PostgreSQL, and exposes query APIs for dashboards.

## Quick Start

Configuration comes from `.env`, and compose refuses to start without the two
required values rather than falling back to insecure defaults.

```bash
cp .env.example .env
```

Set `BANANA_DB_PASSWORD` (generate one with `openssl rand -hex 24`),
`BANANA_CORS_ORIGINS` and, for a real deployment, `BANANA_DOMAIN`. Then:

```bash
docker compose up -d --build
```

Only Caddy binds to the host (80/443). Postgres, the API and the dashboard talk
to each other over the internal Docker network and are not reachable from
outside.

For local development, the dev overlay publishes those ports and relaxes CORS:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BANANA_DB_PASSWORD` | (required) | Postgres password; only read when the data directory is first created |
| `BANANA_CORS_ORIGINS` | (required) | Allowed CORS origins, comma-separated. Native apps send no Origin and are unaffected |
| `BANANA_DOMAIN` | `localhost` | Domain Caddy provisions a TLS certificate for |
| `BANANA_DB_USER` | `bananalytics` | Postgres user |
| `BANANA_DB_NAME` | `bananalytics` | Database name |
| `BANANA_PORT` | `8080` | HTTP server port |
| `BANANA_DB_DSN` | (built from the above) | PostgreSQL connection string |
| `BANANA_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `BANANA_RATE_LIMIT_RPM` | `1000` | Requests per minute per API key |
| `BANANA_BACKUP_DIR` | `./backups` | Where `scripts/backup.sh` writes dumps |
| `BANANA_BACKUP_RETENTION_DAYS` | `14` | How long local dumps are kept |
| `BANANA_BACKUP_REMOTE` | (empty) | rclone remote for off-site copies |

## API Reference

### Create Project

```
POST /v1/projects
Body: { "name": "My App" }
Response: { "id": "...", "write_key": "rk_...", "secret_key": "sk_..." }
```

### Ingest Events (write key auth)

```
POST /v1/ingest
Authorization: Bearer <write_key>
Body: { "batch": [ ...EventPayload[] ] }
Response: { "success": true, "accepted": 18 }
```

### Query Events (secret key auth)

```
GET /v1/query/events?event=button_clicked&from=2025-01-01T00:00:00Z&to=2025-12-31T23:59:59Z
GET /v1/query/funnel?steps=signup_start,signup_complete&from=...&to=...
GET /v1/query/sessions?user_id=user-123
GET /v1/query/retention?from=...&to=...
Authorization: Bearer <secret_key>
```

### Rotate Keys

```
POST /v1/projects/:id/keys/rotate
Authorization: Session (project owner)
```

## Backups

Nothing backs the database up by default — `scripts/backup.sh` is the piece you
have to schedule yourself.

```bash
./scripts/backup.sh
```

It writes a compressed dump to `BANANA_BACKUP_DIR` (default `./backups`), prunes
dumps older than `BANANA_BACKUP_RETENTION_DAYS`, and — if `BANANA_BACKUP_REMOTE`
is set and `rclone` is installed — copies the dump off-site. A dump that fails or
comes back suspiciously small is discarded rather than kept, so a broken backup
never masquerades as a good one.

Schedule it nightly on the host:

```bash
crontab -e
```

```
30 3 * * * cd /opt/bananalytics/server && ./scripts/backup.sh 2>&1 | logger -t bananalytics-backup
```

A copy on the same disk as the database does not survive losing that disk. Set
`BANANA_BACKUP_REMOTE` to an rclone remote (S3, B2, Storj, …), or use managed
Postgres and let the provider handle it.

### Restoring

```bash
./scripts/restore.sh backups/bananalytics-2026-08-30T03-30-00Z.sql.gz
```

This drops the database, recreates it and loads the dump, so the result is
exactly the state the dump captured. It asks for confirmation first and stops the
backend while it works. Restoring *on top of* an existing schema is deliberately
not supported: `pg_dump` emits `DROP CONSTRAINT` for constraints the monthly
event partitions inherit, and Postgres refuses those — a restore that aborts
half-way leaves the schema damaged.

**Test your restore before you need it.** Take a dump, run the restore on a
throwaway machine, and confirm the event count matches.

## Rotating the database password

`BANANA_DB_PASSWORD` is only read when Postgres initialises an empty data
directory. Changing it in `.env` afterwards leaves the existing user's password
untouched, and the backend then fails to connect. Change it in the database too:

```bash
docker compose exec postgres psql -U bananalytics -d postgres -c "ALTER USER bananalytics WITH PASSWORD 'your-new-password';"
```

Then update `.env` to match and run `docker compose up -d` to restart with the
new value.

## Database Migrations

Migrations are applied automatically on server startup via `golang-migrate` with embedded SQL files.
You don't need to run them manually — just start the server.

## Development

```bash
make test    # Run tests
make lint    # Run linter
make build   # Build binary
```
