# Umsetzungsplan — Von "Activity Monitor" zu "Revenue Optimizer"

Arbeitsreihenfolge: **1 → 2 → 4 → 3**. Punkt 5 (Launch-Blocker) folgt danach separat.

---

## ✅ Punkt 1 — Funnel korrekt machen (Sequenz + Conversion-Window)

**Problem:** `queryFunnelSQL` zählt pro Step nur, wer das Event irgendwann im Zeitraum
ausgelöst hat. Reihenfolge wird ignoriert (`first_ts` wird berechnet, nie benutzt).
Folge: Step N kann größer sein als Step N-1 → negative Drop-offs, falsche Conversion.

**Lösung:** Dynamisch generiertes SQL mit einer CTE pro Step.
- Step 1: alle Personen mit `MIN(client_ts)` als Einstiegszeitpunkt
- Step N: JOIN auf Step N-1, Bedingung `client_ts >= vorheriger Step`
  **und** `client_ts <= erster Step + Conversion-Window`
- Window-Semantik wie Mixpanel/Amplitude: Gesamtfenster ab Step 1.

**Zusätzlich geliefert:** `conversion_rate` (zum ersten Step), `step_conversion_rate`
(zum vorherigen Step), `dropped`, `median_seconds_from_prev` (wie lange Nutzer für
den Schritt brauchen — starker Hinweis auf Hidden Spots).

**Dateien:**
- `server/internal/storage/postgres/funnel.go` (neu — SQL-Builder)
- `server/internal/storage/postgres/postgres.go` (QueryFunnel)
- `server/internal/storage/repository.go` (FunnelParams, FunnelStep erweitert)
- `server/internal/query/{service,handler}.go` (`window`-Param)
- `packages/dashboard/…/funnels/page.tsx` (Window-Auswahl, neue Kennzahlen)

**Erledigt.** Verifiziert mit 6 Unit-Tests auf dem SQL-Builder und 9 Integrations-
tests gegen echtes PostgreSQL — inklusive Regressionstest für den Originalbug
(wer nur den letzten Schritt macht, wird nicht mehr gezählt).

---

## ✅ Punkt 2 — Property-Breakdowns & Filter

**Problem:** Keine Query kann nach Properties aufgeschlüsselt oder gefiltert werden.
Genau dort liegen die Hidden Spots ("Android + Version 1.2 konvertiert 4× schlechter").

**Lösung:**
- Zentraler, **injection-sicherer** Dimension-Resolver: benutzerlesbarer Key
  (`platform`, `app_version`, `country`, `properties.plan`) → parametrisierter
  JSONB-Ausdruck (`context->$n->>$m`). Keine String-Interpolation von Nutzereingaben.
- Globale Filter (`filter=platform:ios`) auf allen Query-Endpoints.
- `GET /v1/query/breakdown?key=…` — Ranking nach beliebiger Dimension.
- `GET /v1/query/properties` + `/values` — welche Dimensionen gibt es überhaupt.
- `breakdown` auf Funnel → Funnel je Property-Wert (Segmentvergleich).

**Erledigt.** Alle Query-Endpoints akzeptieren `filter=key:value`; neue Endpoints
`/v1/query/breakdown` und `/v1/query/dimensions`; Funnel akzeptiert `breakdown=`
und liefert einen Funnel je Segment. Dashboard hat eine globale Filterleiste,
eine Breakdown-Seite und einen Funnel-Segmentvergleich. Injection-Schutz durch
9 Dimension-Tests plus einen Integrationstest, der eine SQL-Injection durch den
gesamten Stack schickt.

---

## ✅ Punkt 4 — Identity-Merge + DAU/WAU/MAU

**Problem A:** Nach `identify()` bleiben die anonymen Vor-Login-Events unverknüpft;
nach `reset()` entsteht eine neue anonyme ID. Derselbe Mensch wird mehrfach gezählt.
**Problem B:** Timeseries zählt Events, nicht Menschen — es gibt keine echte
Aktive-Nutzer-Kurve.

**Lösung:**
- Migration: Tabelle `identities` (project_id, anonymous_id → user_id) +
  View `events_resolved` mit `person_id = COALESCE(identity, user_id, anonymous_id)`.
  Kein Umschreiben historischer Zeilen nötig.
- Ingestion schreibt bei `identify` in `identities` (Upsert).
- Alle Queries laufen über `events_resolved` / `person_id`.
- `GET /v1/query/active-users?interval=day|week|month` → DAU/WAU/MAU + Stickiness.

**Erledigt.** Migration 007 legt `identities` + View `events_resolved` an; alle
Queries zählen jetzt `person_id` statt Geräte. Ingestion verlinkt Identitäten
best-effort (ein Fehler dort lässt den Ingest nicht scheitern). Neuer Endpoint
`/v1/query/active-users` liefert DAU/WAU/MAU als rollierende Fenster plus
Stickiness; Dashboard zeigt die Kurve auf der Übersicht. Verifiziert mit 8
Integrationstests, u.a. Funnel über die Login-Grenze hinweg.

---

## ✅ Punkt 3 — Revenue als First-Class-Citizen

**Problem:** Das Tool kennt kein Geld. Ohne Umsatz keine Umsatz-Optimierung.

**Lösung:**
- Migration: Spalten `revenue NUMERIC(18,4)` + `currency` auf `events`.
- Enricher extrahiert Umsatz aus `properties.revenue` / `$revenue` beim Ingest.
- SDK: `trackRevenue(amount, currency, props)` + `$purchase`-Konvention.
- `GET /v1/query/revenue` — Umsatz, zahlende Nutzer, ARPU, ARPPU, Zeitreihe.
- Revenue als Metrik in Breakdown (Punkt 2) → "Umsatz je Plattform/Land/Version".
- Dashboard: Revenue-Seite + KPI.

**Erledigt.** Migration 008 gibt `events` echte Spalten `revenue`/`currency` mit
partiellem Index; der Enricher zieht den Betrag beim Ingest aus den Properties
(Zahl *oder* String, Refunds als negative Beträge). SDK bekommt
`trackRevenue(amount, currency, props, eventName)`. Neuer Endpoint
`/v1/query/revenue` liefert Umsatz, zahlende Nutzer, ARPU, ARPPU, AOV und
Zeitreihe — **immer in genau einer Währung**, nie über Währungen hinweg summiert.
Umsatz ist zusätzlich eine Metrik im Breakdown ("Umsatz je Land/Plattform") und
eine KPI auf der Übersicht. Neue Revenue-Seite im Dashboard.

---

## Ergebnis

| | vorher | nachher |
|---|---|---|
| Go Unit-Tests | 56 | **98** |
| Go Integrationstests (echtes PostgreSQL) | 0 | **42** |
| SDK-Tests | 107 | **119** |

Neue Query-Endpoints: `/v1/query/breakdown`, `/dimensions`, `/active-users`,
`/revenue`. Alle bestehenden Endpoints akzeptieren jetzt `filter=key:value`.

Die Integrationstests laufen gegen echte Migrationen in einer frisch angelegten
Datenbank, verifizieren also nebenbei, dass die Migrationen von null durchlaufen:

```bash
docker run -d --rm --name banana-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=bananatest -p 55432:5432 postgres:16-alpine
```

```bash
BANANA_TEST_DSN="postgres://postgres:test@localhost:55432/bananatest?sslmode=disable" go test -tags=integration ./...
```

---

## Punkt 5 — Launch-Blocker (offen, als Nächstes)

Device-Test der SDK, Passwort-Reset, Team-Invitations.

---

## Demo-Dashboard

Die Demo (`/demo/dashboard/*`) zeigt jetzt alle neuen Funktionen ohne Backend.

- **Filter wirken.** Vorher hat die Demo Filter ignoriert — wer segmentiert hat,
  sah identische Zahlen, das Hauptfeature wirkte kaputt. Die Demo-Daten haben
  jetzt eine Segment-Schicht: statt Zeilen zu filtern skalieren sie die Werte
  nach Anteil *und* Conversion-Stärke. `platform:ios` zeigt 62% der Events, aber
  77% des Umsatzes — genau der Unterschied, den das Tool aufdecken soll.
  Wo eine Ansicht durch Weglassen von Zeilen filtert (Karte auf ein Land,
  Ranking auf ein Event), behalten die verbleibenden Zeilen ihre Größe.
- **Kein Backend nötig.** `useProjects` liefert im Demo-Modus ein Stub-Projekt,
  statt `/api/projects` aufzurufen und zu scheitern. Damit funktioniert auch die
  Settings-Seite (Key-Verwaltung) in der Demo. Die Demo-Seiten machen jetzt
  **null** Backend-Requests.
- **Funnel vorbelegt** mit `breakdown=platform`, damit der Segmentvergleich
  sofort sichtbar ist. Sidebar, Seitentitel und Demo-Banner weisen auf die neuen
  Ansichten und die Filterleiste hin.

Verifiziert: alle 11 Demo-Routen liefern 200, und die Filterlogik wurde direkt
gegen `getDemoResponse` geprüft (Stats, Revenue, Breakdown, Geo, Top-Events,
Funnel-Segmente, Active Users, kombinierte Filter).

---

### Beim Arbeiten aufgefallen (noch offen)

- **Jest beendet sich nicht von selbst.** Mehrere SDK-Testdateien lassen das
  Batcher-Intervall laufen. Die CI umgeht das mit `--forceExit`; sauberer wäre
  `client.shutdown()` in `afterEach` (so gelöst in `__tests__/core/revenue.test.ts`).
- **Marketing-Claims prüfen.** Die FAQ auf der Landingpage nennt ein Dashboard für
  Push-Notifications — im SDK existiert kein Push-Tracking.
