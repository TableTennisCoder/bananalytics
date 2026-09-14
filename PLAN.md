# Plan — was als Nächstes gebaut wird

Stand: 2026-09-14

Das *Warum* hinter den Entscheidungen steht in [DECISIONS.md](DECISIONS.md).
Was schon produktionsreif steht, in [ROADMAP.md](ROADMAP.md).

**Produktziel, an dem alles hier gemessen wird:** der Nutzer bekommt einfach
Insights, findet damit Schwachstellen in seiner App, dreht daran und macht mehr
Umsatz. Die Oberfläche erklärt sich selbst, und möglichst viel passiert
automatisch. Alles, was den Nutzer zum Query-Bauen zwingt, arbeitet gegen dieses
Ziel.

---

## Hauptstrang — in dieser Reihenfolge

Die Reihenfolge ist nicht beliebig: jeder Punkt macht den nächsten billiger.

### 1. Lesender SQL-Zugang

Der Hebel. Ohne ihn ist jede Frage, die nicht schon als Endpoint existiert, gar
nicht stellbar — zwei von drei Testabfragen aus dem Audit sind daran gescheitert,
obwohl die Daten da lagen. Damit werden Quantile, Set-Analysen,
Events-pro-Person, die Geo-Geräte-Matrix und der halbe Alarm-Bereich zu
Abfragen statt zu Features.

- [ ] Eigene Datenbankrolle, nur `SELECT`, nur auf `events_resolved` und die Rollup-Tabellen
- [ ] Row-Level Security mit der Projekt-ID als Session-Variable → beliebiges SQL ist automatisch auf ein Projekt beschränkt
- [ ] `statement_timeout`, Zeilenlimit, Pflicht-Zeitfenster
- [ ] `POST /v1/query/sql`, Secret-Key-Auth wie die übrigen Query-Endpoints
- [ ] Ergebnis kompakt (Spalten + Zeilen), nicht als verschachteltes JSON

*Nicht* als Textfeld, das SQL durchreicht. Die Abschottung ist der Punkt, an dem
das steht oder fällt — und sie wird für Managed Hosting sowieso gebraucht.

### 2. MCP-Server

- [ ] Lokaler stdio-Prozess (`npx @bananalytics/mcp`), kein gehosteter Worker
- [ ] Konfiguration: `BANANALYTICS_HOST` + `BANANALYTICS_SECRET_KEY`
- [ ] `describe_schema` — Events, Properties, Dimensionen
- [ ] `run_sql`
- [ ] `query_funnel` — Reihenfolge/Window/pro-Person soll der Agent nicht nachbauen müssen
- [ ] `query_revenue` — ARPU/ARPPU/Währungslogik steckt im Backend
- [ ] `list_insights` / `save_insight` (nach Punkt 4)

Höchstens sechs bis acht Tools. Wenn die Liste über zehn wächst, auf ein
einzelnes `exec`-Tool mit `learn`/`search`/`info`/`call` umstellen.

### 3. Autocapture: Taps und Zeiten

Das Rohmaterial, das Session Replay liefern würde — ohne Video, ohne native
Module, ohne Gesichter.

- [ ] `$tap` mit `screen, x, y, screen_w, screen_h` — globaler Touch-Beobachter am Wurzel-View über `onStartShouldSetResponderCapture`, der Touches mitliest ohne sie abzufangen
- [ ] `$screen_leave` mit `screen, dwell_ms, scroll_depth`
- [ ] Sampling-Schalter (Taps verdoppeln das Eventvolumen, ~5 GB/Monat bei Hairu-Größe)
- [ ] Abgeleitet: Rage-Taps (3 Taps binnen 2 s im Umkreis von 40 px)
- [ ] Abgeleitet: tote Taps (Tap ohne Folge-Event binnen 1 s) — der kaputte Knopf, der nichts loggt
- [ ] Abgeleitet: Heatmap pro Screen
- [ ] Später: Screen-Bauplan einmal pro Screen und App-Version über `onLayout` — dann weiß die Auswertung nicht nur *wo* getippt wurde, sondern *worauf*

### 4. Gespeicherte Objekte

Funnels leben heute in `useState` — Tab zu, Analyse weg. Das ist auch die
Voraussetzung dafür, dass der Agent etwas hinterlassen kann statt nur zu
antworten.

- [ ] Objektmodell `insight`, `funnel`, `dashboard` — jeweils mit `project_id` im Schlüssel, nicht als nachträglicher Filter
- [ ] CRUD-Endpoints
- [ ] Mehrere Funnels anlegen, benennen, wiederfinden
- [ ] Dashboards als Sammlungen mit Beschreibungstext
- [ ] Vorlagen: Paywall-Funnel, Onboarding-Funnel, Preset-Nutzung, Release-Vergleich, Geo/Gerät

### 5. Auto-Scan

Das eigentliche Produkt: nicht „hier ist ein Breakdown-Picker", sondern
*„Android verliert 14,8 Prozentpunkte zwischen Paywall und Kauf — das sind
~4.400 $/Monat."*

- [ ] **Zuerst als Prompt testen**, nicht als Feature bauen. Mit Punkt 1+2 kann Claude die Schleife von Hand fahren: über `BuiltinDimensions()` iterieren, `GetSegmentedFunnel` pro Dimension, gegen den Gesamt-Funnel vergleichen, nach verlorenem Umsatz sortieren
- [ ] Erst wenn die Befunde taugen: Nachtjob mit eigener Ergebnistabelle (~120 Funnel-Queries pro Lauf, kein Seitenaufruf)
- [ ] Mindest-Segmentgrößen und Konfidenz von Anfang an — drei Wochen Zufallsbefunde und niemand glaubt dem Tool mehr

---

## Query-Engine — Lücken aus dem Audit

Teile davon erledigen sich mit Punkt 1. Diese hier nicht:

- [ ] **Funnel-Schritte über Property-Werte** — heute ist ein Schritt ein Event-Name. Der Onboarding-Funnel über `onboarding_step_completed` mit `step_name` ist damit nicht baubar. Blockiert eine der sechs Analysen, die real gefahren wurden
- [ ] **Filter pro Schritt** statt global für alle Schritte
- [ ] **Quantile** p25/p75/p90 — heute nur p50 (`MedianSecondsFromPrev`)
- [ ] **Trends**: `week` als Intervall (nur minute/hour/day), Breakdown auf der Zeitreihe, Vorzeitraum-Vergleich (gibt es nur auf `/stats` und `/revenue`)
- [ ] **`revenue_usd`** — heute strikt eine Währung pro Abfrage. „Mehr Umsatz" braucht *eine* Zahl, sonst lässt sich nichts nach Geld sortieren
- [ ] **Mehrdimensionale Breakdowns** — `BreakdownParams.Dimension` ist Singular; Land × Hersteller kostet heute einen Aufruf pro Land
- [ ] **Obergrenze für `/query/events?limit=`** — Default 100, aber `limit=1000000` wird akzeptiert

---

## Datenqualität

Bei einem Tool, das automatisch urteilt, kritischer als bei einem, das nur
Diagramme zeigt: es gibt keinen Menschen, der bei einer komischen Zahl stutzt.

- [ ] **Event-Katalog** mit Typen und Beispielwerten, nicht nur Namen
- [ ] **Code ↔ Daten abgleichen** — „im Code definiert, feuert nie"
- [ ] **Property-Abdeckung** — „Property X fehlt auf Y % der Events"
- [ ] **Drift-Alarme** pro Event und App-Version — Event fällt nach einem Release auf null
- [ ] **Sequenz-Lint** — Event X ohne Folge-Event Y binnen N Sekunden. Gleiche Maschine wie der Auto-Scan
- [ ] **Events pro Person** als Verteilung (1×/2×/3+×), nicht nur als Ratio

---

## Self-Hosting — offen vor dem nächsten fremden Nutzer

- [ ] **Passwort-Reset.** Ein vergessenes Passwort sperrt dich dauerhaft aus deiner eigenen Analytics aus. Es gibt null Wiederherstellungsweg. CLI-Befehl im Container reicht
- [ ] **Lösch-Endpoint pro Person** — Rechtspflicht, sobald echte Nutzerdaten drin sind
- [ ] **`bananalytics config`-CLI** — Backup-Zeit, -Pfad, -Remote ändern. Zweite Hälfte der Settings-Entscheidung
- [ ] **„Nächster Lauf" in der Backup-Karte** — braucht den Cron-Ausdruck in der `.env` und durchgereicht ans Backend
- [ ] **Release-Tag** für die Backup-Karte, sonst erreicht sie keine Installation

---

## SDK

- [ ] **Auf einem echten iOS-/Android-Gerät testen.** Ist nie passiert. AsyncStorage, Lifecycle und Netzwerk-Polyfills verhalten sich auf dem Gerät anders als in Jest
- [ ] **Expo-Router-Helfer** — `ScreenTracker` erwartet einen React-Navigation-Ref; für Expo Router schreibt man die paar Zeilen heute selbst
- [ ] **gzip** für große Batches
- [ ] **Eigene Super-Properties** — app_version/build/os/locale liegen fest im Context, alles andere muss pro Event mit

---

## Webseite und Infrastruktur

- [ ] **`app.bananalytics.xyz` liefert kein Zertifikat.** DNS zeigt auf den VPS, aber Caddy bedient nur `BANANA_DOMAIN` (= `test.`). Damit sind **Demo- und Login-Button auf der Startseite tot**
- [ ] **`www.bananalytics.xyz`** antwortet über HTTP, hat über HTTPS kein Zertifikat
- [ ] **Zwei nackte `https://github.com`-Links** ohne Repo — Footer und About-Seite
- [ ] Marketing-Claim prüfen: die FAQ nennt ein Push-Notification-Dashboard, im SDK gibt es kein Push-Tracking

---

## Technische Schulden

- [ ] **Jest beendet sich nicht von selbst.** Mehrere SDK-Testdateien lassen das Batcher-Intervall laufen („A worker process has failed to exit gracefully"). Die CI umgeht das mit `--forceExit`; sauberer wäre `client.shutdown()` in `afterEach`, so gelöst in `__tests__/core/revenue.test.ts`
- [ ] **Integrationstests laufen nicht in der CI** — es gibt keinen Postgres-Service-Container im Workflow
- [ ] **Die Projekt-ID fehlt in den React-Query-Schlüsseln.** `["stats", from, to]` statt `["stats", projectId, …]` — nach einem Projektwechsel zeigt das Dashboard kurz die Zahlen des vorigen Projekts. `useFirstEvent` macht es schon richtig
- [ ] **`useActiveProject` dreimal ausgeschrieben** — Cookie-Lesen in `project-switcher.tsx`, `settings/page.tsx` und dem Hook. Der Hook existiert jetzt, die beiden anderen ziehen nicht nach

---

## Bewusst nicht gebaut

Damit die Entscheidung nicht in drei Monaten neu diskutiert wird:

- **Session Replay mit Video.** Braucht native Module in Swift und Kotlin, schließt Expo Go aus, braucht Object Storage und einen eigenen Player — 2–4 Monate. Und bei einer Hairstyle-App zeichnet es Gesichter auf. „Kein Session Replay" ist für ein Privacy-Tool eine Position, kein Mangel
- **Person-Properties** (zum Event-Zeitpunkt vs. aktuell) — Analysten-Feature
- **Set-Analysen als eigener Endpoint** — erledigt Punkt 1 nebenbei
- **Team-Invitations** — blockiert keinen einzelnen Self-Hoster
- **Abgeleitete Dimensionen als UI** — Land→Tier wird für den Auto-Scan hartverdrahtet
