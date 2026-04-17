# Bananalytics Server — Docker Cheatsheet

All commands run from your `bananalytics/server` directory.

## Daily workflow

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

```powershell
docker exec -it server-postgres-1 psql -U bananalytics -d bananalytics
```

Inside psql: `\dt` lists tables, `\q` quits.

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
