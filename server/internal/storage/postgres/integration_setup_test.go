//go:build integration

package postgres

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// These tests run the real queries against a real PostgreSQL server using the
// real migrations, which is the only way to prove the generated SQL is both
// valid and correct.
//
//	docker run -d --rm --name banana-funnel-test -e POSTGRES_PASSWORD=test \
//	    -e POSTGRES_DB=bananatest -p 55432:5432 postgres:16-alpine
//	BANANA_TEST_DSN="postgres://postgres:test@localhost:55432/bananatest?sslmode=disable" \
//	    go test -tags=integration ./internal/storage/postgres/...

// testDB is a migrated database with one project ready to receive events.
type testDB struct {
	pool      *pgxpool.Pool
	projectID string
}

// newTestDB resets the schema, applies every migration and creates a project.
// Starting from an empty schema each time also verifies the migrations
// themselves still apply cleanly from scratch.
func newTestDB(t *testing.T) *testDB {
	t.Helper()

	dsn := os.Getenv("BANANA_TEST_DSN")
	if dsn == "" {
		t.Skip("BANANA_TEST_DSN not set — skipping PostgreSQL integration tests")
	}

	ctx := context.Background()

	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if _, err := admin.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		admin.Close()
		t.Fatalf("reset schema: %v", err)
	}
	admin.Close()

	if err := RunMigrations(dsn, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect after migrate: %v", err)
	}
	t.Cleanup(pool.Close)

	projectID := uuid.New().String()
	_, err = pool.Exec(ctx, `
		INSERT INTO projects (id, name, write_key, secret_key, write_key_prefix, write_key_hash, secret_key_prefix, secret_key_hash, created_at, updated_at)
		VALUES ($1, 'Test Project', 'rk_test', 'sk_test', 'rk_test_', 'hash', 'sk_test_', 'hash', NOW(), NOW())`,
		projectID)
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	return &testDB{pool: pool, projectID: projectID}
}

// event describes a row to insert, with timestamps relative to a base time.
type event struct {
	person     string // becomes anonymous_id unless userID is set
	userID     string
	name       string
	offset     time.Duration
	properties map[string]any
	context    map[string]any
	geo        map[string]any
}

// insert writes the events, using the offset for both client_ts and created_at
// so partition routing and ordering agree.
func (db *testDB) insert(t *testing.T, base time.Time, events []event) {
	t.Helper()
	ctx := context.Background()

	for i, e := range events {
		ts := base.Add(e.offset)

		properties := mustJSON(t, e.properties)
		eventContext := mustJSON(t, e.context)

		var geo any
		if e.geo != nil {
			geo = mustJSON(t, e.geo)
		}

		var userID any
		if e.userID != "" {
			userID = e.userID
		}

		_, err := db.pool.Exec(ctx, `
			INSERT INTO events (message_id, project_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at, geo)
			VALUES ($1, $2, $3, 'track', $4, $5, $6, $7, $8, $8, $9, $8, $10)`,
			uuid.New().String(), db.projectID, e.name,
			properties, eventContext, userID, e.person, ts, "session-"+e.person, geo)
		if err != nil {
			t.Fatalf("insert event %d (%s): %v", i, e.name, err)
		}
	}
}

func mustJSON(t *testing.T, v map[string]any) []byte {
	t.Helper()
	if v == nil {
		return []byte(`{}`)
	}
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return raw
}

// deviceContext builds the context payload shape the SDK actually sends.
func deviceContext(platform, appVersion string) map[string]any {
	return map[string]any{
		"device": map[string]any{"os": platform, "osVersion": "17.0", "model": "Test"},
		"app":    map[string]any{"name": "TestApp", "version": appVersion, "build": "1"},
		"locale": "en-US",
	}
}
