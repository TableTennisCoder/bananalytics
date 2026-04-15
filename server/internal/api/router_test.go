package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/ingestion"
	"github.com/rochade-analytics/server/internal/query"
	"github.com/rochade-analytics/server/internal/ratelimit"
	"github.com/rochade-analytics/server/internal/storage"
	"github.com/rochade-analytics/server/pkg/clock"
)

// --- Mock Repositories ---

type mockEventRepo struct {
	events []domain.Event
}

func (m *mockEventRepo) InsertBatch(_ context.Context, events []domain.Event) (int, error) {
	m.events = append(m.events, events...)
	return len(events), nil
}

func (m *mockEventRepo) QueryEvents(_ context.Context, filter storage.EventFilter) ([]domain.Event, error) {
	var result []domain.Event
	for _, e := range m.events {
		if filter.ProjectID != "" && e.ProjectID != filter.ProjectID {
			continue
		}
		if filter.Event != "" && e.EventName != filter.Event {
			continue
		}
		result = append(result, e)
	}
	return result, nil
}

func (m *mockEventRepo) QueryFunnel(_ context.Context, _ string, steps []string, _, _ time.Time) ([]storage.FunnelStep, error) {
	result := make([]storage.FunnelStep, len(steps))
	for i, s := range steps {
		result[i] = storage.FunnelStep{Step: s, Count: 100 - i*20}
	}
	return result, nil
}

func (m *mockEventRepo) QuerySessions(_ context.Context, _, userID string) ([]storage.Session, error) {
	return []storage.Session{
		{SessionID: "sess-1", StartedAt: time.Now(), EventCount: 5},
	}, nil
}

func (m *mockEventRepo) QueryRetention(_ context.Context, _ string, _, _ time.Time) ([]storage.RetentionCohort, error) {
	return []storage.RetentionCohort{
		{Cohort: "2025-01-06", CohortSize: 100, Period: 0, Retained: 100},
		{Cohort: "2025-01-06", CohortSize: 100, Period: 1, Retained: 60},
	}, nil
}

func (m *mockEventRepo) QueryStats(_ context.Context, _ string, _, _ time.Time) (*storage.StatsOverview, error) {
	return &storage.StatsOverview{TotalEvents: 100, UniqueUsers: 10, ActiveSessions: 3, EventsPerMinute: 5.0, TopCountry: "Germany"}, nil
}
func (m *mockEventRepo) QueryTimeseries(_ context.Context, _ string, _, _ time.Time, _ string, _ string) ([]storage.TimeseriesPoint, error) {
	return []storage.TimeseriesPoint{{Bucket: "2026-04-14T10:00:00Z", Count: 42}}, nil
}
func (m *mockEventRepo) QueryTopEvents(_ context.Context, _ string, _, _ time.Time, _ int) ([]storage.TopEvent, error) {
	return []storage.TopEvent{{Event: "button_clicked", Count: 100}}, nil
}
func (m *mockEventRepo) QueryEventNames(_ context.Context, _ string) ([]string, error) {
	return []string{"button_clicked", "$screen"}, nil
}
func (m *mockEventRepo) QueryGeo(_ context.Context, _ string, _, _ time.Time, _ string) ([]storage.GeoData, error) {
	return []storage.GeoData{{Country: "Germany", CountryCode: "DE", Count: 50, UniqueUsers: 10, Lat: 52.52, Lng: 13.40}}, nil
}
func (m *mockEventRepo) QueryLive(_ context.Context, _ string) (*storage.LiveData, error) {
	return &storage.LiveData{ActiveUsers: 5, EventsLastMinute: 12, RecentEvents: nil}, nil
}

type mockProjectRepo struct {
	projects []*domain.Project
}

func (m *mockProjectRepo) Create(_ context.Context, p *domain.Project) error {
	m.projects = append(m.projects, p)
	return nil
}

func (m *mockProjectRepo) FindByWriteKey(_ context.Context, key string) (*domain.Project, error) {
	for _, p := range m.projects {
		if p.WriteKey == key {
			return p, nil
		}
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: key}
}

func (m *mockProjectRepo) FindBySecretKey(_ context.Context, key string) (*domain.Project, error) {
	for _, p := range m.projects {
		if p.SecretKey == key {
			return p, nil
		}
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: key}
}

func (m *mockProjectRepo) FindByID(_ context.Context, id string) (*domain.Project, error) {
	for _, p := range m.projects {
		if p.ID == id {
			return p, nil
		}
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: id}
}

func (m *mockProjectRepo) RotateKeys(_ context.Context, id string, newWrite, newSecret string) error {
	for _, p := range m.projects {
		if p.ID == id {
			p.WriteKey = newWrite
			p.SecretKey = newSecret
			return nil
		}
	}
	return &domain.ErrNotFound{Resource: "project", ID: id}
}

// --- Test Setup ---

type testServer struct {
	handler     http.Handler
	projectRepo *mockProjectRepo
	eventRepo   *mockEventRepo
	project     *domain.Project
}

func setupTestServer() *testServer {
	logger := slog.Default()
	eventRepo := &mockEventRepo{}
	projectRepo := &mockProjectRepo{}

	// Pre-create a test project
	project := &domain.Project{
		ID:        "test-project-id",
		Name:      "Test Project",
		WriteKey:  "rk_test_write_key",
		SecretKey: "sk_test_secret_key",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	projectRepo.projects = append(projectRepo.projects, project)

	ks := auth.NewKeystore(projectRepo)
	rl := ratelimit.NewTokenBucket(1000)
	enricher := ingestion.NewEnricher(clock.Real{}, nil)
	ingestionHandler := ingestion.NewHandler(eventRepo, enricher, logger)
	queryService := query.NewService(eventRepo)
	queryHandler := query.NewHandler(queryService, logger)

	router := NewRouter(RouterConfig{
		Logger:      logger,
		Keystore:    ks,
		RateLimiter: rl,
		Ingestion:   ingestionHandler,
		Query:       queryHandler,
		Projects:    projectRepo,
		CORSOrigins: "*",
	})

	return &testServer{
		handler:     router,
		projectRepo: projectRepo,
		eventRepo:   eventRepo,
		project:     project,
	}
}

// --- Integration Tests ---

func TestHealthEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestIngestFlow(t *testing.T) {
	ts := setupTestServer()

	// Build a valid event batch
	batch := map[string]any{
		"batch": []map[string]any{
			{
				"event":       "button_clicked",
				"type":        "track",
				"messageId":   "msg-1",
				"anonymousId": "anon-1",
				"properties":  map[string]any{"button": "signup"},
				"context":     map[string]any{"session": map[string]any{"id": "sess-1"}},
				"timestamp":   time.Now().UTC().Format(time.RFC3339),
				"userId":      nil,
			},
		},
	}
	body, _ := json.Marshal(batch)

	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer rk_test_write_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("ingest expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp domain.IngestResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.Success || resp.Accepted != 1 {
		t.Errorf("expected success with 1 accepted, got %+v", resp)
	}
	if len(ts.eventRepo.events) != 1 {
		t.Errorf("expected 1 stored event, got %d", len(ts.eventRepo.events))
	}
}

func TestIngestUnauthorized(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"batch":[]}`)
	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer bad_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestIngestNoAuth(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"batch":[]}`)
	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(body))

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestIngestWithSecretKey_Forbidden(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"batch":[]}`)
	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 (wrong key type), got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQueryEventsEndpoint(t *testing.T) {
	ts := setupTestServer()

	// First ingest some events
	ts.eventRepo.events = append(ts.eventRepo.events, domain.Event{
		ProjectID:   "test-project-id",
		EventName:   "test_event",
		Type:        "track",
		AnonymousID: "anon-1",
	})

	req := httptest.NewRequest("GET", "/v1/query/events?event=test_event", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQueryEventsWithWriteKey_Forbidden(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/events", nil)
	req.Header.Set("Authorization", "Bearer rk_test_write_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestQueryFunnelEndpoint(t *testing.T) {
	ts := setupTestServer()

	url := fmt.Sprintf("/v1/query/funnel?steps=signup_start,signup_complete&from=%s&to=%s",
		time.Now().Add(-24*time.Hour).UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339),
	)
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result map[string]any
	json.Unmarshal(rec.Body.Bytes(), &result)
	funnel, ok := result["funnel"].([]any)
	if !ok || len(funnel) != 2 {
		t.Errorf("expected 2 funnel steps, got %v", result)
	}
}

func TestQuerySessionsEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/sessions?user_id=user-123", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQuerySessionsMissingUserID(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/sessions", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestQueryRetentionEndpoint(t *testing.T) {
	ts := setupTestServer()

	url := fmt.Sprintf("/v1/query/retention?from=%s&to=%s",
		time.Now().Add(-30*24*time.Hour).UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339),
	)
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateProject(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"name":"New Project"}`)
	req := httptest.NewRequest("POST", "/v1/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var project domain.Project
	if err := json.Unmarshal(rec.Body.Bytes(), &project); err != nil {
		t.Fatal(err)
	}
	if project.Name != "New Project" {
		t.Errorf("expected name 'New Project', got %q", project.Name)
	}
	if project.WriteKey == "" || project.SecretKey == "" {
		t.Error("expected generated write and secret keys")
	}
}

func TestCreateProjectMissingName(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"name":""}`)
	req := httptest.NewRequest("POST", "/v1/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestQueryFunnelMissingSteps(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/funnel", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQueryEventsInvalidTimestamp(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/events?from=not-a-date", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestRateLimiting(t *testing.T) {
	logger := slog.Default()
	eventRepo := &mockEventRepo{}
	projectRepo := &mockProjectRepo{}

	project := &domain.Project{
		ID: "rl-project", Name: "RL Test",
		WriteKey: "rk_rl", SecretKey: "sk_rl",
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	projectRepo.projects = append(projectRepo.projects, project)

	ks := auth.NewKeystore(projectRepo)
	rl := ratelimit.NewTokenBucket(1) // 1 RPM — very restrictive
	enricher := ingestion.NewEnricher(clock.Real{}, nil)
	ingestionHandler := ingestion.NewHandler(eventRepo, enricher, logger)
	queryService := query.NewService(eventRepo)
	queryHandler := query.NewHandler(queryService, logger)

	router := NewRouter(RouterConfig{
		Logger: logger, Keystore: ks, RateLimiter: rl,
		Ingestion: ingestionHandler, Query: queryHandler,
		Projects: projectRepo, CORSOrigins: "*",
	})

	validBody := []byte(`{"batch":[{"event":"test","type":"track","messageId":"m1","anonymousId":"a1","properties":{},"context":{},"timestamp":"2025-01-01T00:00:00Z"}]}`)

	// First request should succeed
	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(validBody))
	req.Header.Set("Authorization", "Bearer rk_rl")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", rec.Code)
	}

	// Second request should be rate limited
	req = httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(validBody))
	req.Header.Set("Authorization", "Bearer rk_rl")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("second request: expected 429, got %d", rec.Code)
	}
}
