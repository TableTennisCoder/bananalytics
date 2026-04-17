# Bananalytics Server

Self-hosted analytics backend for React Native apps. Ingests events from the `@bananalytics/react-native` SDK, stores them in PostgreSQL, and exposes query APIs for dashboards.

## Quick Start

```bash
# Start Postgres + server with Docker
docker-compose up --build

# Or run locally
export BANANA_DB_DSN="postgres://bananalytics:bananalytics@localhost:5432/bananalytics?sslmode=disable"
make build && make run
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BANANA_PORT` | `8080` | HTTP server port |
| `BANANA_DB_DSN` | (required) | PostgreSQL connection string |
| `BANANA_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `BANANA_RATE_LIMIT_RPM` | `1000` | Requests per minute per API key |
| `BANANA_CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |

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

## Database Migrations

Migrations are applied automatically on server startup via `golang-migrate` with embedded SQL files.
You don't need to run them manually — just start the server.

## Development

```bash
make test    # Run tests
make lint    # Run linter
make build   # Build binary
```
