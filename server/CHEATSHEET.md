# Bananalytics Server — Docker Cheatsheet

All commands run from your `bananalytics/server` directory.

## Daily workflow

Everything reads `.env` — copy `.env.example` once and fill in the two required
values, otherwise compose stops with a message telling you which one is missing.

```powershell
# Start everything (postgres + Go backend)
docker-compose up -d

# Stop everything (keeps data)
docker-compose down

# Show running containers
docker-compose ps
```

## After changing Go code

```powershell
# Rebuild image and restart
docker-compose up -d --build
```

## Logs

```powershell
docker-compose logs -f bananalytics       # follow backend logs
docker-compose logs -f                    # follow all services
docker-compose logs bananalytics --tail 50  # last 50 lines, no follow
```

Look for these on startup:
- `connected to database`
- `migrations: applied successfully`
- `GeoIP database loaded`
- `server starting port=8080`

## Reset / nuke

```powershell
docker-compose down -v                       # stop + delete postgres volume (fresh DB)
docker-compose build --no-cache bananalytics # rebuild from scratch ignoring cache
```

## Direct database access

Postgres is not published to the host in the production config, so go through
the container:

```powershell
docker-compose exec postgres psql -U bananalytics -d bananalytics
```

Inside psql: `\dt` lists tables, `\q` quits.

To reach it from a GUI client on port 5432, start with the dev overlay:

```powershell
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Backups

```powershell
.\scriptsackup.sh          # write a dump to ./backups
.\scriptsestore.sh <file>  # replace the database with a dump
```

Schedule `backup.sh` nightly with cron on the host — see README.md. Nothing
backs up automatically.

## Frontend

Run separately for hot reload:

```powershell
cd ..\packages\web
npm run dev
```

Dashboard: http://localhost:3000

## Service URLs

| Service        | URL                       |
| -------------- | ------------------------- |
| Dashboard      | http://localhost:3000     |
| Go backend API | http://localhost:8080     |
| Health check   | http://localhost:8080/health |
| Postgres       | localhost:5432 (user: bananalytics / pass: bananalytics) |

## Troubleshooting

**`docker-compose` says "no such service: #"**
Windows shells don't strip `#` comments. Drop the comment, run the bare command.

**Backend container exits immediately**
Check logs: `docker-compose logs bananalytics --tail 30`. Usually a config or DB connection issue.

**Port 8080 already in use**
Something else is on that port. Stop your local `go run` if it's still running, or change the port mapping in `docker-compose.override.yml`.

**GeoIP shows "disabled"**
Confirm `server/geoip/GeoLite2-City.mmdb` exists. If you just added it, restart: `docker-compose restart bananalytics`.
