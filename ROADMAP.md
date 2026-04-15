# Rochade Analytics — Production Roadmap

Status: **MVP — Production-Hardened** (164 Tests, End-to-End verifiziert, CI/CD, gehashte Keys, Connection Pooling)

---

## Sicherheit

- [x] **HTTPS einrichten** — Caddy Reverse Proxy mit automatischen Let's Encrypt Zertifikaten, Security Headers, `docker-compose.dev.yml` für lokale Entwicklung
- [x] **API Keys hashen** — SHA-256 Hash + 8-Zeichen Lookup-Präfix, Constant-Time-Vergleich, Migration 003
- [x] **CORS einschränken** — `ROCHADE_CORS_ORIGINS` konfigurierbar, Warnung im Log wenn `*` in Production
- [x] **JSON-Payload Tiefenprüfung** — Max 10 Ebenen JSON-Tiefe, max 32KB Context-Größe, wird bei Validation geprüft
- [x] **Rate Limit pro IP** — `ROCHADE_IP_RATE_LIMIT_RPM` (default 300), X-Forwarded-For Support, globale Middleware vor Auth
- [x] **Request-Body-Logging deaktivieren** — Logger loggt nur Method/Path/Status/Duration/IP, nie Bodies, Query-Params oder API Keys

---

## Infrastruktur

- [ ] **Migrations-Tool einführen** — `golang-migrate` oder `goose` statt manuelle SQL-Dateien, damit Migrationen versioniert und reversibel sind
- [x] **Health Check erweitern** — `/health` prüft Postgres-Verbindung, gibt `unhealthy` + 503 zurück wenn DB nicht erreichbar
- [x] **Partitionen automatisch erstellen** — Go-Routine erstellt beim Start und täglich Partitionen für die nächsten 3 Monate
- [ ] **Datenbank-Backups** — `pg_dump`-Cronjob oder Managed-DB-Service mit automatischen Backups
- [ ] **Alte Partitionen archivieren** — Strategie für Daten älter als X Monate (DROP, Export nach S3, etc.)
- [x] **Docker Production Config** — Multi-Stage Build mit `-s -w` Flags, Non-Root User, `HEALTHCHECK` Directive, `restart: unless-stopped`
- [x] **Environment-spezifische Configs** — `.env.example`, `docker-compose.dev.yml` Override für lokale Entwicklung

---

## Skalierung

- [ ] **Rate Limiter externalisieren** — Redis-basierter Rate Limiter statt In-Memory (geht bei Neustart verloren, funktioniert nicht mit mehreren Instanzen)
- [x] **Connection Pool Tuning** — `ROCHADE_DB_MAX_CONNS` (default 25), `ROCHADE_DB_MIN_CONNS` (default 5), MaxConnLifetime 30min
- [ ] **Message Queue einführen** — Events in eine Queue (Redis Streams, NATS, Kafka) schreiben statt direkt in die DB, damit bei DB-Ausfall keine Events verloren gehen
- [ ] **Batch-Insert optimieren** — `COPY`-Protokoll statt einzelne INSERTs für bessere Durchsatzrate
- [ ] **Read Replicas** — Query-API auf Read Replica lenken um die Haupt-DB zu entlasten
- [ ] **Horizontale Skalierung** — Load Balancer vor mehreren Server-Instanzen

---

## SDK

- [ ] **Auf echtem Gerät testen** — iOS und Android (nicht nur Web/Emulator)
- [x] **Offline-Queue-Limit** — max 512KB AsyncStorage, älteste Events werden automatisch gedroppt
- [ ] **Request-Kompression** — Gzip für große Batches (Content-Encoding: gzip)
- [x] **Retry-Backoff-Jitter** — 0-50% Random-Jitter auf Exponential Backoff gegen Thundering Herd
- [x] **Network Connectivity Check** — Batcher prüft Konnektivität vor dem Flush, überspringt wenn offline
- [ ] **TypeDoc generieren** — API-Dokumentation aus den JSDoc-Kommentaren erstellen
- [ ] **npm publish vorbereiten** — `prepublishOnly` Script, Changelog, Semantic Versioning
- [ ] **React Navigation Integration testen** — `useTrackScreen` mit echtem Navigation-Stack verifizieren
- [ ] **Expo Plugin** — Optional: Expo Config Plugin für automatische native Module

---

## Monitoring & Observability

- [ ] **Prometheus Metrics** — `/metrics` Endpoint mit: Events/Sekunde, Batch-Größe, Fehlerrate, DB-Latenz
- [x] **Structured Error Codes** — `APIError` mit maschinenlesbaren Codes (`BAD_REQUEST`, `UNAUTHORIZED`, etc.) in `api/errors.go`
- [ ] **Structured Logging verbessern** — Request-ID durchgängig in allen Logs
- [ ] **Alerting einrichten** — Benachrichtigung bei: Fehlerrate > X%, DB nicht erreichbar, Disk > 80%
- [ ] **Grafana Dashboard** — Visualisierung von Ingestion-Rate, Query-Latenz, Top-Events
- [ ] **Error Tracking** — Sentry oder ähnliches für Server-Fehler

---

## Tests & CI/CD

- [ ] **Postgres-Integrationstests** — Tests mit echter DB (Testcontainers oder Docker in CI)
- [ ] **Lasttests** — k6 oder vegeta Skript um Events/Sekunde Kapazität zu messen
- [x] **CI/CD Pipeline** — GitHub Actions: Go Build+Test+Vet, SDK TypeCheck+Test+Coverage+Build, Docker Build
- [ ] **SDK E2E Tests automatisieren** — `test-e2e.ts` in CI laufen lassen (Server + DB in Docker starten)
- [ ] **Code Coverage in CI** — Coverage-Reports automatisch generieren und Schwellenwert erzwingen
- [ ] **Linter einrichten** — `golangci-lint` in CI, ESLint für TypeScript SDK
- [ ] **Pre-Commit Hooks** — Husky + lint-staged für automatische Formatierung

---

## Features (Nice to Have)

- [ ] **Dashboard UI** — Web-Frontend zur Visualisierung der Analytics-Daten
- [ ] **Event Replay** — Events erneut verarbeiten können (z.B. nach Schema-Änderung)
- [ ] **Webhooks** — Events an externe Services weiterleiten
- [ ] **ClickHouse Adapter** — Stub existiert bereits, für bessere Analytics-Query-Performance bei großen Datenmengen
- [ ] **User Segmentation** — Benutzer anhand von Traits gruppieren
- [ ] **Funnel Visualisierung** — Conversion-Funnels im Dashboard anzeigen
- [ ] **Data Export** — CSV/JSON Export der Events für externe Analyse
- [ ] **Multi-Tenancy** — mehrere Organisationen mit getrennten Projekten
- [ ] **API Versioning** — v2 API planen ohne v1 zu brechen
- [ ] **React Web SDK** — Gleiche API für Web-Apps (ohne React Native Dependencies)
