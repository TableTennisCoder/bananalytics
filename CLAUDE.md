# Bananalytics

Self-hosted product analytics für React Native. Go-Backend, PostgreSQL,
Next.js-Dashboard, TypeScript-SDK. Monorepo:

```
server/              Go-Backend, Migrationen, Backup-Skripte
packages/react-native/  @bananalytics/react-native (SDK)
packages/dashboard/  Next.js-Dashboard (Container, ohne Host-Zugriff)
packages/web/        Marketing-Seite + Docs, veröffentlicht install.sh
deploy/              docker-compose.yml + Caddyfile, die der Installer zieht
install.sh           Ein-Kommando-Installer
```

## Unterlagen

| Datei | Zweck |
|---|---|
| [PLAN.md](PLAN.md) | Was als Nächstes gebaut wird, in Reihenfolge, mit Haken |
| [DECISIONS.md](DECISIONS.md) | Warum etwas so ist — mit den Messwerten dahinter |
| [ROADMAP.md](ROADMAP.md) | Was produktionsreif steht |

## Am Ende einer Arbeitseinheit

Beides pflegen, sonst ist das Wissen nach der nächsten Session weg:

- **PLAN.md** — Erledigtes abhaken, Neues eintragen, Reihenfolge anpassen wenn sich Abhängigkeiten geändert haben.
- **DECISIONS.md** — einen Eintrag schreiben, wenn eine Entscheidung gefallen ist, die jemand später in Frage stellen könnte, oder wenn etwas *gemessen* wurde. Neue Einträge oben, mit Datum.

Ein Eintrag gehört nach DECISIONS.md, wenn er eine dieser Fragen beantwortet:

- Warum ist etwas **nicht** gebaut worden?
- Welche Zahl stützt eine Behauptung, die auf der Webseite steht oder stehen soll?
- Welcher Fehler war **still**, und woran hätte man ihn früher gemerkt?

Das ist gleichzeitig der Rohstoff für Docs und Blogposts. Alle Zahlen dort sind
gemessen, nicht geschätzt — das bitte so halten, sonst verliert die Datei ihren
Wert.

## Arbeitsweise

- **Messen statt schätzen.** Zahlen, die in Docs oder auf der Webseite landen, kommen aus einem Lauf gegen echte Daten. Wenn geschätzt wird, steht das dabei.
- **Verifizieren, nicht behaupten.** Installer-Änderungen in einem frischen Container, SDK-Änderungen gegen den echten Server, Dashboard-Änderungen im Browser.
- **Stille Fehler ernst nehmen.** Die vier schlimmsten Bugs dieser Codebasis haben alle nichts kaputt aussehen lassen, sondern etwas heil aussehen lassen, das es nicht war. Ein Pfad, der im Fehlerfall schweigt, ist ein Bug.
- **Zeilenenden:** `.gitattributes` erzwingt LF für `*.sh`. CRLF in einem Shell-Skript ergibt auf dem Server „bad interpreter".
- **Keine Geheimnisse committen.** `docker-compose.override.yml`, `.env`, `geoip/` und `backups/` sind ignoriert; vor jedem Commit prüfen.

## Testen

```bash
cd server && go test ./...
```

```bash
npm test --prefix packages/react-native
```

Integrationstests laufen gegen ein echtes PostgreSQL mit den echten
Migrationen — sie verifizieren nebenbei, dass die Migrationen von null
durchlaufen. Erst die Datenbank starten:

```bash
docker run -d --rm --name banana-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=bananatest -p 55432:5432 postgres:16-alpine
```

```bash
cd server && BANANA_TEST_DSN="postgres://postgres:test@localhost:55432/bananatest?sslmode=disable" go test -tags=integration ./...
```
