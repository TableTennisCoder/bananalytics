# Bananalytics — Production Roadmap

**Current Status:** Self-hosted MVP works end-to-end. First-run user setup, login, project creation, dashboard with KPIs/funnels/retention/geo/sessions/live view, React Native SDK with offline-first batching, all behind Caddy HTTPS.

Since then the analysis layer moved from "what happened" to "where is the money":
ordered funnels with conversion windows, property breakdowns and filters on every
query, identity merging with DAU/WAU/MAU, and revenue as a first-class metric.
See [PLAN.md](PLAN.md) for what changed and why.

**Test counts:** Go 98 unit + 42 PostgreSQL integration + SDK 119 = **259 tests passing**.

---

## ✅ Already Built (Production Quality)

### Analysis Layer
- [x] **Ordered funnels** — strict step sequence + conversion window measured from step 1 (Mixpanel/Amplitude semantics), per-step drop-off and median time to convert
- [x] **Property breakdowns & filters** — `filter=key:value` on every query, `/v1/query/breakdown` ranks any dimension, funnels split into per-segment comparisons. Dimension keys are validated and bound as parameters, never interpolated into SQL
- [x] **Identity merge** — `identities` table + `events_resolved` view; a person who browses anonymously then signs in counts once, across devices (Migration 007)
- [x] **DAU/WAU/MAU** — `/v1/query/active-users` with rolling windows and stickiness, counting people rather than event volume
- [x] **Revenue** — `revenue`/`currency` columns (Migration 008), extracted at ingest from any event's properties; `/v1/query/revenue` reports totals, paying users, ARPU, ARPPU and AOV in a single currency, never summed across currencies

### Backend (Go)
- [x] **Event ingestion** — `POST /v1/ingest`, batching, deduplication on `(project_id, message_id, created_at)`, 5MB body limit, 500 events per batch
- [x] **Query API** — events, stats, timeseries, top events, event names, funnel, sessions, retention, geo, live, breakdown, dimensions, active-users, revenue (14 endpoints)
- [x] **API Key Hashing** — SHA-256 + 8-char prefix lookup, constant-time comparison (Migration 003)
- [x] **HTTPS via Caddy** — Auto Let's Encrypt, security headers (HSTS, X-Frame-Options, etc.)
- [x] **CORS configurable** — `BANANA_CORS_ORIGINS` is required in the production compose file (no silent `*` fallback), and the server warns when it is wide open
- [x] **Postgres not exposed** — the production compose publishes no host port for the database; only Caddy binds 80/443. Credentials come from `.env`, with no default password
- [x] **JSON depth check** — Max 10 nesting levels, max 32KB context size
- [x] **Per-IP rate limiting** — `BANANA_IP_RATE_LIMIT_RPM` (default 300)
- [x] **Per-API-key rate limiting** — `BANANA_RATE_LIMIT_RPM` (default 1000) on ingest
- [x] **Strict project-create rate limiting** — `BANANA_PROJECT_CREATE_RPM` (default 5)
- [x] **Safe request logging** — Never logs bodies, query params, or auth headers
- [x] **Health check** — `/health` pings DB, returns 503 + `unhealthy` if down
- [x] **Auto partitions** — Monthly events partitions, 3 months ahead, daily check
- [x] **Connection pool tuning** — `BANANA_DB_MAX_CONNS` / `MIN_CONNS` env vars
- [x] **Structured error codes** — `APIError` type with `BAD_REQUEST` / `UNAUTHORIZED` / etc.
- [x] **Docker production config** — Multi-stage build, non-root user, healthcheck directive, restart policy
- [x] **GeoIP enrichment** — MaxMind GeoLite2 IP→country/city in event enricher (gracefully disabled if no DB file)
- [x] **User authentication** — bcrypt passwords, server-side sessions, SHA-256 hashed tokens, 7-day expiry (Migration 005)
- [x] **First-run setup gate** — `/v1/auth/setup` works only when 0 users exist, returns 410 Gone after
- [x] **Login/logout/status/me endpoints** — Full session lifecycle with httpOnly cookies
- [x] **Project ownership** — `project_members` table, owner role, IsMember/role checks on all project endpoints
- [x] **Authorization** — Project creation requires session, key rotation requires owner role, all checks enforced

### React Native SDK (`@bananalytics/react-native`)
- [x] **Event tracking** — `track`, `screen`, `identify`, `reset`, `optIn`, `optOut`, `flush`
- [x] **Singleton + React Provider** — Both `Bananalytics.init()` and `<BananalyticsProvider>` patterns
- [x] **Auto-tracking** — App lifecycle (foreground/background), screen views (with React Navigation), sessions
- [x] **Offline queue** — In-memory queue + AsyncStorage persistence, max 512KB
- [x] **Smart batching** — Configurable interval (30s default) and threshold (20 events default)
- [x] **Retry logic** — Exponential backoff with 0-50% jitter, skips 4xx errors
- [x] **Network connectivity check** — Skips flush when offline
- [x] **PII sanitization** — Auto-strips email, password, ssn, credit card from auto-captured events
- [x] **Validation** — Event name regex, max length, max property count, max property value size
- [x] **107 unit tests passing** across 14 test suites

### Web Dashboard (Next.js 16 + React 19)
- [x] **Landing page** — Hero with code snippet, problem/solution, features, comparison table, pricing, blueprint grid background
- [x] **Docs page** — Quick start, SDK setup, API reference (collapsible), self-hosting guide, env vars table, AI setup prompt
- [x] **First-run setup page** — `/setup` with name/email/password, redirects properly based on state
- [x] **Login page** — Email + password (replaced old secret-key flow)
- [x] **Dashboard pages** — Overview (KPIs + chart + globe + top events), Live, Events, Funnels, Retention, Sessions, Journey, Geography, Settings
- [x] **Project creation page** — `/dashboard/projects/new` with key reveal + copy
- [x] **Project switcher** — Dropdown in topbar with active project cookie
- [x] **ProjectGuard** — Redirects to creation page when no projects exist
- [x] **Settings page** — Real project data, masked keys with show/hide, copy buttons, key rotation with confirmation
- [x] **Demo mode** — `/demo/dashboard/*` mirror with deterministic seed data
- [x] **Theme** — Dark with electric yellow `#FFD60A` (Bananalytics brand)
- [x] **Charts** — shadcn/ui (Recharts) area/bar/donut + 3D globe (react-globe.gl) + 2D world map
- [x] **Code blocks** — Custom syntax highlighter with copy button (matches hero style)

### CI/CD & Tests
- [x] **GitHub Actions** — Go build/test/vet, SDK typecheck/test/build, Docker build
- [x] **119 SDK unit tests** + **98 Go unit tests** = **217 tests passing**
- [x] **42 PostgreSQL integration tests** — run the real queries against a real database using the real migrations, behind the `integration` build tag (see [PLAN.md](PLAN.md) for how to run them)

---

## 🔴 Critical Blockers (must fix before any real user touches it)

### ~~1. Migrations are still manual~~ ✅ DONE
- **Status:** `golang-migrate` integrated. Migration `.sql` files are embedded into the Go binary via `go:embed` and auto-applied on every server startup. The `schema_migrations` table tracks the current version. Idempotent on restart (logs "already up-to-date" when no new migrations).
- **Verified:** Empty DB → 5 migrations applied automatically (`from_version=0, to_version=5`); restart → "database already up-to-date".
- **Files:** `internal/storage/postgres/migrate.go`, `internal/storage/postgres/migrations/embed.go`

### 2. SDK is not published to npm
- **Status:** `@bananalytics/react-native` exists on disk but isn't on npm. Users can't install it.
- **Fix:** Set up `prepublishOnly` script, build dist, register npm scope `@bananalytics`, publish v0.1.0.
- **Effort:** ~2 hours

### 3. SDK never tested on a real iOS/Android device
- **Risk:** AsyncStorage, lifecycle events, network polyfills behave differently on device than in jest. Possible runtime crashes.
- **Fix:** Build a tiny Expo test app, install the SDK, run on a phone, verify events arrive.
- **Effort:** ~2 hours

### ~~4. No GeoIP database setup documented~~ ✅ DONE
- **Status:** Setup scripts added (`scripts/download-geoip.sh` for macOS/Linux + `.ps1` for Windows). The `geoip/` directory is mounted into the Docker container and gitignored. Docs page has a dedicated &quot;GeoIP Setup&quot; section explaining license key signup, download, restart, and monthly refresh.
- **Files:** `server/scripts/download-geoip.sh`, `server/scripts/download-geoip.ps1`, `server/.gitignore` (geoip excluded), `server/.env.example` (`MAXMIND_LICENSE_KEY` added), `server/docker-compose.yml` (volume mount + `BANANA_GEOIP_DB` env), `packages/web/src/app/(marketing)/docs/page.tsx` (new section)

### 5. No password reset flow
- **Risk:** If a user forgets their password they're locked out forever.
- **Fix (self-host):** CLI command `bananalytics reset-password --email=x@y.com` that sets a temp password.
- **Fix (Cloud):** Email-based reset link (requires SMTP).
- **Effort:** ~30 min for CLI, ~3 hours for email

### 6. No team invitations
- **Status:** `project_members` table exists, but only the owner can ever access. Multi-user is sold but doesn't work.
- **Fix:** `POST /v1/projects/{id}/invitations` endpoint + accept-invitation page + invitation email (or shareable link for self-host).
- **Effort:** ~3 hours

---

## 🟡 Should-Have Before Public Launch

### ~~7. Database backups~~ ✅ DONE
- **Status:** `scripts/backup.sh` dumps the database, prunes old files and can push
  off-site via any rclone remote; `scripts/restore.sh` recreates the database and
  loads a dump. Both refuse to run against a stopped container, and a dump that
  fails or comes back too small is discarded rather than kept.
- **Verified end to end:** seeded 250 events with revenue and an identity mapping,
  dumped, dropped the whole database, restored — event count, revenue sum,
  identity merge, all constraints, 24 partitions and the migration version came
  back identical.
- **Not automatic:** the operator schedules `backup.sh` via cron. README.md has
  the crontab line.
- **Files:** `server/scripts/backup.sh`, `server/scripts/restore.sh`, README.md

### 8. Error monitoring (Sentry or GlitchTip)
- Right now production errors are only visible by reading server logs. Need automatic error tracking with stack traces.
- **Effort:** ~1 hour for Sentry SDK in Go + Next.js

### 9. Email infrastructure
- Needed for password reset, team invitations, Cloud signup verification, billing receipts.
- **Choices:** Resend ($20/mo), Postmark, AWS SES, or Mailpit for dev.
- **Effort:** ~2 hours setup + plumbing

### 10. SDK gzip compression for ingestion
- Large batches (200+ events) waste bandwidth. `Content-Encoding: gzip` on SDK + decompression on Go side.
- **Effort:** ~1 hour

### 11. SDK npm publish prep
- `prepublishOnly` script, CHANGELOG.md, semantic versioning, README badges, example project.
- **Effort:** ~2 hours

### 12. React Navigation integration verified
- The `useTrackScreen` hook needs end-to-end verification with React Navigation v6 + v7.
- **Effort:** ~1 hour

---

## 🟢 Cloud/Managed Hosting Specific (only when offering Cloud plan)

### 13. Stripe billing integration
- Subscription creation, plan tiers, webhook handling for `customer.subscription.*`, invoice emails.
- **Effort:** ~1-2 days

### 14. Usage tracking & quota enforcement
- Count events per project per month, block ingestion when over limit, send warning emails at 80% of quota.
- **Effort:** ~1 day

### 15. Signup with email verification
- Right now anyone can create an admin account on Cloud. Needs email confirmation before activation.
- **Effort:** ~3 hours (depends on email infra from #9)

### 16. Multi-tenant DB strategy decision
- Option A: Single DB with project filtering (current, mostly works) — cheap, simpler
- Option B: One DB per customer — better isolation, easier deletion
- Option C: Schema-per-customer in one DB
- **Effort:** Decision now, implementation later

### 17. Pricing page → Stripe Checkout
- Wire the existing pricing card to a real Stripe Checkout session.
- **Effort:** ~2 hours

---

## ⚪ Nice-to-Have (Post-Launch)

### Scaling (when you actually have load)
- [ ] **Redis-based rate limiter** — When running multiple server instances
- [ ] **Message queue (NATS/Kafka)** — When DB writes become a bottleneck
- [ ] **`COPY` protocol for batch inserts** — 5-10x faster than current INSERT batches
- [ ] **Read replicas for query API** — When query load impacts ingest
- [ ] **Horizontal scaling** — Load balancer + multiple Go server instances
- [ ] **ClickHouse adapter** — For >100M events/month (stub already exists)
- [ ] **Old partition archival** — Move >12-month data to S3 cold storage

### Quality
- [x] **Postgres integration tests** — 42 tests behind the `integration` tag, running the real migrations against a real database
- [ ] **Run the integration tests in CI** — they exist but CI does not start a Postgres service container yet
- [ ] **Load tests (k6 or vegeta)** — Document max events/sec capacity
- [ ] **`golangci-lint` in CI** — Code quality enforcement
- [ ] **ESLint for SDK + web** — Consistent style
- [ ] **Pre-commit hooks** — Husky + lint-staged
- [ ] **Code coverage in CI** — Enforce minimum thresholds
- [ ] **Storybook for components** — Visual component library

### Observability
- [ ] **Prometheus `/metrics` endpoint** — Events/sec, batch size, error rate, DB latency
- [ ] **Structured logging with request ID** — Trace requests across all logs
- [ ] **Grafana dashboard** — Visualize ingestion rate, query latency, top events
- [ ] **Alerting** — Notify on error rate spike, DB unreachable, disk >80%

### Features
- [ ] **Webhooks** — Forward events to external services (Zapier, Slack, etc.)
- [ ] **Data export** — CSV/JSON export for selected event ranges
- [ ] **Event replay** — Reprocess events after schema changes
- [ ] **Saved segments** — persist a filter combination and reuse it (filtering itself is done, saving is not)
- [ ] **Revenue webhooks** — accept purchase events from RevenueCat/Stripe directly, instead of relying on the app to report them
- [ ] **API versioning (v2)** — Plan v2 namespace before breaking v1
- [ ] **React Web SDK** — Same API for web apps (without RN deps)
- [ ] **Other SDKs** — Flutter, iOS native (Swift), Android native (Kotlin)
- [ ] **Custom dashboards** — User-defined widgets and queries
- [ ] **Cohort builder UI** — Visual cohort definition
- [ ] **TypeDoc generation** — Public API docs from JSDoc

### SDK-specific
- [ ] **Expo Config Plugin** — Auto-link native modules
- [ ] **React Native bridgeless mode support** — New architecture compatibility
- [ ] **Source maps for crash reports** — Symbolicate stack traces

---

## 7-Day Launch Plan

If aiming to ship in 7 days, prioritize like this:

| Day | Tasks |
|---|---|
| 1 | ~~Migrations auto-run on server start (#1)~~ ✅ DONE + ~~GeoIP docs (#4)~~ ✅ DONE |
| 2 | npm publish prep (#11) + first publish to npm (#2) |
| 3 | Real-device SDK testing on iOS + Android (#3) |
| 4 | Password reset CLI (#5) + Team invitations basic flow (#6) |
| 5 | Sentry error tracking (#8) + DB backup strategy decision (#7) |
| 6 | Email infrastructure setup (#9) + invitation emails (#6 cont.) |
| 7 | Final QA pass, docs polish, marketing site final review, **launch** |

**Cloud plan extension** (~2 weeks after self-hosted launch):
- Week 2: Stripe billing (#13) + signup with email verification (#15)
- Week 3: Usage tracking + quotas (#14) + multi-tenant decision (#16)
