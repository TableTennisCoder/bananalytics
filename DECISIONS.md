# Entscheidungen

Warum die Dinge so sind, wie sie sind — mit den Messwerten, auf denen die
Entscheidung beruht. Neue Einträge oben. Was daraus gebaut wird, steht in
[PLAN.md](PLAN.md).

Diese Datei ist auch der Rohstoff für Docs und Blogposts: die Zahlen hier sind
gemessen, nicht geschätzt.

---

## 2026-09-15 — Landingpage: Umsatz zuerst, Ownership zuletzt

**Entscheidung:** Die Seite führt mit „Find where your app loses money." Privacy,
Self-Hosting und Preis bleiben — als Trust-Zeile unter dem Button, als
Pricing-Argument, als FAQ. Nicht mehr als Überschrift.

**Warum.** Die alte Seite sprach den Privacy-Käufer an: „Own your analytics
stack", „Your users' data never leaves", GDPR als Chip im Hero. Der Mensch, der
das Produkt tatsächlich braucht, ist der Founder einer Paywall-App, der wissen
will, wo Nutzer vor dem Bezahlen abspringen und ob das letzte Release es
schlimmer gemacht hat — die Person, die Bananalytics gebaut hat, zwei Wochen
zuvor auf PostHog. Für sie ist Datensouveränität ein Grund zu vertrauen, kein
Grund zu kaufen. Die Reihenfolge war exakt verkehrt.

Festgehalten in `.agents/product-marketing-context.md`: wer der ICP ist, wie er
über seine App redet, welche Zahlen gemessen sind.

**Features wurden zu Fragen.** Niemand sucht „Retention Cohorts", jeder sucht
„Are they coming back?". Rausgeflogen als Feature-Karte: der 3D-Globus (hübsch,
keine Founder-Frage) und Offline-First (SDK-Qualität, kein Ergebnis — jetzt FAQ).

**Die Vergleichstabelle wurde kürzer und ehrlicher.** Mixpanel, Amplitude und
PostHog haben alle Funnels, Revenue und Cohorts. Eine Tabelle, in der
Bananalytics bei diesen Zeilen „gewinnt", wäre gelogen. Übrig sind die Zeilen,
die stimmen: React-Native-first, um den Paywall-Funnel gebaut, Self-Hosting mit
einem Kommando, Offline-Queue, Open Source, eigener Server, Festpreis.

**Die Befund-Karte zeigt Beispielzahlen — und sagt es.** Die Zahlen (iOS 24,8 %,
Android 10 %) stammen aus den *synthetischen* Audit-Daten. Sie stehen unter
einem sichtbaren „Example data"-Label mit Fußnote; `FINDING.isExample` schaltet
Label und Überschrift. Wenn echte Hairu-Zahlen aus PostHog da sind, werden sie
eingetragen und der Schalter umgelegt. Nichts Synthetisches erscheint als
Ergebnis — das ist die eine Regel, die eine Analytics-Firma nicht brechen darf.

**Beim Umschreiben gefundene Fehler**, alle vorher live:
- Hero-Code zeigte `track('purchase_complete', { amount: 49.99 })` — der Server
  liest `revenue`. Die Startseite zeigte ein Property, das das Produkt ignoriert
- FAQ: „12 KB gzipped" — gemessen 17 kB (dist ohne uuid)
- FAQ: ein Push-Notification-Dashboard, das nicht existiert
- Setup-Schritt 1: `docker-compose up -d` statt des Installers
- Footer: `https://github.com` ohne Repo
- Demo- und Login-Button zeigten auf `app.bananalytics.xyz` — kein Zertifikat,
  tot. Notlösung: Fallback auf `test.`, bis `app.` in der Caddy-Adresse steht

---

## 2026-09-14 — Kein Session Replay, stattdessen Taps und Zeiten

**Entscheidung:** Bananalytics bekommt kein Video-basiertes Session Replay.
Stattdessen Autocapture von Tap-Koordinaten und Verweildauern.

**Warum.** Mobile Session Replay ist technisch ein anderes Problem als im Web.
Es gibt kein DOM, also braucht es native Module, die die View-Hierarchie beim
Zeichnen abgreifen — bei PostHog Swift und Kotlin, Expo Go wird dadurch
unmöglich, es braucht einen Development Build. Dazu ein Aufnahmeformat, Ingest
für Blobs statt Events, Object Storage, Retention für große Dateien und ein
Player im Dashboard. Realistisch 2–4 Monate für eine Person.

Der stärkere Grund ist aber inhaltlich: bei einer Hairstyle-Try-on-App *ist* der
Bildschirminhalt das Gesicht des Nutzers. Maskiert sieht man nichts Nützliches,
unmaskiert speichert man biometrienahe Daten. Für ein Tool, das mit „deine Daten
bleiben auf deinem Server" wirbt, ist das eine Position, keine Lücke.

**Was stattdessen.** Die vier Fragen, für die Replays real angeschaut werden,
brauchen kein Video: wo tippt der Nutzer (Koordinaten), wo hängt er (Zeiten), wo
tippt er wütend mehrfach (beides), wo tippt er auf etwas Totes (Tap ohne
Folge-Event). Das ist alles mit Events darstellbar, in reinem TypeScript.

Das Einzige, was fehlt, ist der Zusammenhang zwischen Koordinate und Layout.
Dafür reicht ein Screen-Bauplan **einmal pro Screen und App-Version** über
`onLayout` — Kilobytes statt Screenshots im Sekundentakt.

**Kosten zum Vergleich.** PostHog nimmt für mobile Recordings das Doppelte von
Web, 2.500/Monat frei, grob $0,01 pro Recording am unteren Ende. Bei ~100k
Sessions/Monat sind das mehrere hundert Dollar monatlich bei Vollaufzeichnung.

---

## 2026-09-14 — MCP-Server: lokal, sechs Tools, SQL zuerst

**Entscheidung:** Der MCP-Server wird ein lokaler stdio-Prozess mit wenigen
Tools — und erst *nach* dem SQL-Zugang gebaut.

**Warum.** Ein MCP-Server ist eine dünne Schicht; er ist exakt so mächtig wie
das, was darunter liegt. Umhüllt er nur die 15 festen Endpoints, kann der Agent
genau das, was das Dashboard auch kann. Der Wert entsteht erst bei Fragen, die
nicht vorgebaut wurden.

**Warum lokal, anders als PostHog.** PostHog betreibt einen gehosteten
Cloudflare Worker mit OAuth, Regions-Routing und Redis-Sessions — weil sie SaaS
mit vielen Mandanten sind. Bananalytics ist self-hosted: die Instanz liegt auf
der Domain des Nutzers, der Schlüssel in seiner `.env`, und ein Secret Key
gehört zu genau einem Projekt. Was PostHog mit `switch-project` und
Redis-Sessions lösen muss, ist hier eine Umgebungsvariable.

**Tool-Zahl im Auge behalten.** Jedes MCP-Tool kostet Kontext, bevor eine Frage
gestellt wurde. PostHog hat das Problem bei dutzenden Tools gelöst, indem sie im
CLI-Modus ein einziges `exec`-Tool registrieren und den Agenten über
`learn`/`search`/`info`/`call` bei Bedarf entdecken lassen. Die Lösung ist
bekannt — bis dahin einfach wenige Tools.

---

## 2026-09-14 — Der Auto-Scan ist das Produkt, wird aber erst als Prompt getestet

**Entscheidung:** Vor dem Bauen wird die These mit einem Wegwerf-Skript geprüft.

**Warum.** Die riskanteste Annahme im ganzen Plan ist nicht technisch, sondern:
„ein automatischer Scan findet Schwachstellen, die wirklich welche sind". Das
lässt sich nicht durch Bauen herausfinden, nur durch Hinschauen. Mit SQL-Zugang
und MCP kann der Agent die Schleife von Hand fahren.

Zwei mögliche Ergebnisse, beide wertvoll: er nennt die Dinge, die von Hand
gefunden wurden — dann trägt die These. Oder er produziert fünfzehn Befunde, von
denen zwölf Rauschen sind — dann ist das Schwellen- und Signifikanzproblem *das
Produkt* und nicht ein Detail davon. Das für den Preis eines Prompts zu erfahren
ist eine gute Nachricht; in drei Monaten wäre es eine sehr schlechte.

**Die Maschine steht schon.** `GetSegmentedFunnel` nimmt eine Dimension, holt
ihre Top-Werte und fährt pro Wert einen vollen Funnel. Was fehlt, ist die
Schleife über `BuiltinDimensions()` und die Gewichtung mit ARPU.

---

## 2026-09-13 — Settings zeigt Zustand, geändert wird auf dem Server

**Entscheidung:** Die Backup-Karte im Dashboard ist **read-only**. Backup-Zeit,
Pfad und Remote ändert man auf dem Server.

**Warum.** Der Dashboard-Container hat **keine einzige `volumes:`-Zeile** — keine
`.env`, kein Host-Dateisystem, kein Docker-Socket. Er kann die Dinge nicht
einmal lesen. Damit die UI sie ändern könnte, bräuchte sie Host-Zugriff, und der
naheliegende Weg (Docker-Socket ins Dashboard) bedeutet: wer das Dashboard
kompromittiert, ist root auf dem Server. Bei einem Produkt, das mit „deine Daten
bleiben auf deinem Server" wirbt, ist das der falsche Tausch.

Diese Einstellungen ändert man ein- bis zweimal im Leben eines Servers. Zu
wissen, ob das Backup letzte Nacht lief, will man dagegen oft — also wird genau
das gezeigt.

**Der Weg nach innen: die Datenbank.** Sie ist das Einzige, was Host-Skript und
Container schon teilen. `backup.sh` schreibt sein Ergebnis in die Tabelle
`backup_runs` der Datenbank, die es gerade gedumpt hat.

**Nur echte Off-site-Kopien zählen.** Der erste Entwurf hätte das konfigurierte
Remote gespeichert, egal ob der Upload lief. Dann stünde ein Häkchen für eine
Kopie, die es nicht gibt — schlimmer als gar keine Anzeige.

---

## 2026-09-13 — Gemessenes zu Backups

- **62 Byte pro Event** im gzip-Dump (220.600 Events → 12,97 MB)
- Hochgerechnet: 1 Mio Events ≈ 0,06 GB pro Dump, 10 Mio ≈ 0,58 GB, 50 Mio ≈ 2,88 GB
- Bei 14 Tagen Aufbewahrung: 0,8 / 8,1 / 40,3 GB
- Off-site auf B2 kostet bei 10 Mio Events rund 0,05 $/Monat. Kosten sind kein Argument gegen eine zweite Kopie — B2 ist besser als S3, weil der Egress beim Zurückholen frei ist, und zurückholen will man genau dann, wenn der Tag ohnehin schlecht läuft

**Umzug auf einen neuen Server ist einfacher als gedacht:** der Dump enthält
`projects` inklusive `write_key` und `secret_key`. Nach dem Restore hat der neue
Server dieselben Keys — die App muss nicht angefasst werden, DNS umlegen reicht.
Nicht im Dump und auch nicht nötig: `.env` (wird neu erzeugt, das DB-Passwort
darf abweichen, weil die Rolle aus dem Compose kommt), TLS-Zertifikate (Caddy
holt neue), GeoIP-Datenbank.

---

## 2026-09-13 — Fehler, die beim Prüfen aufgefallen sind

Alle vier waren **still**: sie haben nichts kaputt aussehen lassen, sondern
etwas heil aussehen lassen, das es nicht war. Das ist die Fehlerklasse, die ein
Analytics-Tool für andere finden soll — umso peinlicher, sie selbst zu haben.

1. **Das SDK löschte den Offline-Backlog.** `flush()` schickte die ganze Queue in
   einem Request. Die Queue fasst 1000 Events, der Server nimmt 500 und lehnt
   mehr mit 400 ab — was als nicht wiederholbar gilt und verworfen wird. Ein
   Gerät, das lange genug offline war, verlor beim Wiederverbinden **alles**, und
   konnte sich nicht erholen: die persistierte Queue kam beim Neustart zurück und
   scheiterte identisch. *Verifiziert: 500 Events → accepted, 501 → 400.*
2. **Das SDK fragte bei jedem Flush Google**, ob das Gerät online ist — und gab
   „online" zurück, egal ob der Request klappte. Es entschied also nichts und
   kostete einen Request an einen Dritten pro Flush-Intervall. Aus einem SDK,
   dessen Punkt ist, dass Daten nur zum eigenen Server gehen.
3. **Abgewiesene Events wurden als Erfolg gemeldet.** Ein 200 heißt nicht, dass
   alles gespeichert wurde; der Server meldet Abweisungen im Body, das SDK prüfte
   nur `response.ok`.
4. **Kein Event beim Kaltstart.** Lifecycle-Tracking sah nur AppState-Übergänge,
   die ein frischer Start nicht erzeugt. Die Spitze jedes Funnels war um alle zu
   kurz, die die App öffneten und wieder gingen.

Dazu ein serverseitiger: **Events ohne `properties`/`context` wurden still
verworfen.** Beide Spalten sind NOT NULL, ein von Hand geschicktes Event passierte
die Validierung und starb dann in der Datenbank — die Antwort sagte nur
„rejected: 1" ohne Grund. Traf nur Leute, die über HTTP integrieren, also genau
die mit den wenigsten Anhaltspunkten.

**Und zwei im Installer:** eine gepinnte Version ließ sich nicht mehr lösen
(`--version latest` war von „kein Flag" nicht unterscheidbar, der Lauf sah aus
wie ein erfolgreiches Upgrade), und `--domain` auf einer bestehenden Installation
tat gar nichts — obwohl Docs und Installer beide dazu auffordern.

---

## 2026-09-13 — Positionierung: Antworten, keine Abfragen

**Entscheidung:** Features werden danach beurteilt, ob sie dem Nutzer eine
Antwort geben, nicht ob sie ihm ein Werkzeug geben.

**Warum.** Der Feature-Audit gegen PostHog lief gegen eine Liste, die aus der
Perspektive von jemandem geschrieben ist, der selbst Queries baut. Für dieses
Produkt ist das die falsche Messlatte: `C1 SQL-Zugang` ist für einen Analysten
die wichtigste Zeile und für den Zielnutzer eine Kapitulation. SQL wird gebraucht
— als Fundament für den Agenten und den Auto-Scan, nicht als Oberfläche.

Daraus folgt auch, was *nicht* gebaut wird: Person-Properties, Set-Analysen als
eigene Endpoints, Export-Formate. Das sind Analysten-Features.
