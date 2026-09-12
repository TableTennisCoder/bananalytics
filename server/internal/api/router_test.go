package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/auth"
	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/ingestion"
	"github.com/bananalytics/server/internal/query"
	"github.com/bananalytics/server/internal/ratelimit"
	"github.com/bananalytics/server/internal/storage"
	"github.com/bananalytics/server/internal/userauth"
	"github.com/bananalytics/server/pkg/clock"
)

func hashKeyForTest(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// --- Mock Repositories ---

type mockEventRepo struct {
	events           []domain.Event
	lastBreakdown    *storage.BreakdownParams
	lastFunnel       *storage.FunnelParams
	lastRevenue      *storage.RevenueParams
	lastCohort       *storage.CohortRevenueParams
	revenueCalls     []storage.RevenueParams
	statsCalls       []storage.QueryParams
	linkedIdentities []storage.IdentityLink
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

func (m *mockEventRepo) QueryFunnel(_ context.Context, params storage.FunnelParams) ([]storage.FunnelStep, error) {
	m.lastFunnel = &params
	counts := make([]int, len(params.Steps))
	for i := range params.Steps {
		counts[i] = 100 - i*20
	}
	return storage.NewFunnelResult(params.Steps, counts, make([]*float64, len(params.Steps))), nil
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

func (m *mockEventRepo) QueryStats(_ context.Context, params storage.QueryParams) (*storage.StatsOverview, error) {
	m.statsCalls = append(m.statsCalls, params)
	// The second call is the comparison window; give it different numbers so a
	// test can tell which window a figure came from.
	if len(m.statsCalls) > 1 {
		return &storage.StatsOverview{TotalEvents: 80, UniqueUsers: 8, TopCountry: "Germany"}, nil
	}
	return &storage.StatsOverview{TotalEvents: 100, UniqueUsers: 10, ActiveSessions: 3, EventsPerMinute: 5.0, TopCountry: "Germany"}, nil
}
func (m *mockEventRepo) QueryTimeseries(_ context.Context, _ storage.QueryParams, _ string) ([]storage.TimeseriesPoint, error) {
	return []storage.TimeseriesPoint{{Bucket: "2026-04-14T10:00:00Z", Count: 42, UniqueUsers: 7}}, nil
}
func (m *mockEventRepo) QueryTopEvents(_ context.Context, _ storage.QueryParams, _ int) ([]storage.TopEvent, error) {
	return []storage.TopEvent{{Event: "button_clicked", Count: 100, UniqueUsers: 25}}, nil
}
func (m *mockEventRepo) QueryEventNames(_ context.Context, _ string) ([]string, error) {
	return []string{"button_clicked", "$screen"}, nil
}
func (m *mockEventRepo) QueryGeo(_ context.Context, _ storage.QueryParams, _ string) ([]storage.GeoData, error) {
	return []storage.GeoData{{Country: "Germany", CountryCode: "DE", Count: 50, UniqueUsers: 10, Lat: 52.52, Lng: 13.40}}, nil
}

// lastBreakdown records what the handler asked for so tests can assert on it.
func (m *mockEventRepo) QueryBreakdown(_ context.Context, params storage.BreakdownParams) ([]storage.BreakdownBucket, error) {
	m.lastBreakdown = &params
	return []storage.BreakdownBucket{
		{Value: "ios", Count: 700, UniqueUsers: 120},
		{Value: "android", Count: 300, UniqueUsers: 80},
	}, nil
}

func (m *mockEventRepo) QueryPropertyKeys(_ context.Context, _ string, _, _ time.Time) ([]string, error) {
	return []string{"plan", "source"}, nil
}

func (m *mockEventRepo) QueryActiveUsers(_ context.Context, _ storage.QueryParams) ([]storage.ActiveUsersPoint, error) {
	return []storage.ActiveUsersPoint{
		{Bucket: "2026-03-01", DAU: 120, WAU: 480, MAU: 1500, Stickiness: 8},
		{Bucket: "2026-03-02", DAU: 135, WAU: 495, MAU: 1520, Stickiness: 8.9},
	}, nil
}

func (m *mockEventRepo) LinkIdentities(_ context.Context, links []storage.IdentityLink) error {
	m.linkedIdentities = append(m.linkedIdentities, links...)
	return nil
}

func (m *mockEventRepo) QueryCohortRevenue(_ context.Context, params storage.CohortRevenueParams) (*storage.CohortRevenueReport, error) {
	m.lastCohort = &params
	perPerson := 2.5
	return &storage.CohortRevenueReport{
		Currency:            "EUR",
		AvailableCurrencies: []string{"EUR"},
		Ages:                storage.CohortAges,
		Interval:            params.Interval,
		Cohorts: []storage.CohortRevenue{
			{Cohort: "2026-03-02", People: 120, PerPerson: []*float64{&perPerson}, Total: 3.10},
		},
	}, nil
}

func (m *mockEventRepo) QueryRevenue(_ context.Context, params storage.RevenueParams) (*storage.RevenueSummary, error) {
	m.lastRevenue = &params
	m.revenueCalls = append(m.revenueCalls, params)
	return &storage.RevenueSummary{
		Currency:            "EUR",
		AvailableCurrencies: []string{"EUR", "USD"},
		TotalRevenue:        1250.50,
		Transactions:        84,
		PayingUsers:         61,
		ActiveUsers:         1200,
		ARPU:                1.04,
		ARPPU:               20.50,
		AverageOrderValue:   14.89,
		PayingShare:         5.08,
		Timeseries: []storage.RevenuePoint{
			{Bucket: "2026-03-01", Revenue: 620.25, Transactions: 41, PayingUsers: 30},
			{Bucket: "2026-03-02", Revenue: 630.25, Transactions: 43, PayingUsers: 31},
		},
	}, nil
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

func (m *mockProjectRepo) FindByWriteKeyPrefix(_ context.Context, prefix string) ([]storage.ProjectWithHash, error) {
	var results []storage.ProjectWithHash
	for _, p := range m.projects {
		if len(p.WriteKey) >= 8 && p.WriteKey[:8] == prefix {
			results = append(results, storage.ProjectWithHash{Project: *p, KeyHash: hashKeyForTest(p.WriteKey)})
		}
	}
	return results, nil
}

func (m *mockProjectRepo) FindBySecretKeyPrefix(_ context.Context, prefix string) ([]storage.ProjectWithHash, error) {
	var results []storage.ProjectWithHash
	for _, p := range m.projects {
		if len(p.SecretKey) >= 8 && p.SecretKey[:8] == prefix {
			results = append(results, storage.ProjectWithHash{Project: *p, KeyHash: hashKeyForTest(p.SecretKey)})
		}
	}
	return results, nil
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

// --- User auth mocks ---

type mockUserRepo struct {
	users map[string]*domain.User // keyed by ID
}

func newMockUserRepo() *mockUserRepo { return &mockUserRepo{users: map[string]*domain.User{}} }

func (m *mockUserRepo) Create(_ context.Context, u *domain.User) error {
	m.users[u.ID] = u
	return nil
}
func (m *mockUserRepo) FindByID(_ context.Context, id string) (*domain.User, error) {
	if u, ok := m.users[id]; ok {
		return u, nil
	}
	return nil, &domain.ErrNotFound{Resource: "user", ID: id}
}
func (m *mockUserRepo) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, &domain.ErrNotFound{Resource: "user", ID: email}
}
func (m *mockUserRepo) Count(_ context.Context) (int, error) { return len(m.users), nil }

type mockSessionRepo struct {
	sessions map[string]*domain.Session // keyed by token_hash
}

func newMockSessionRepo() *mockSessionRepo {
	return &mockSessionRepo{sessions: map[string]*domain.Session{}}
}

func (m *mockSessionRepo) Create(_ context.Context, s *domain.Session) error {
	m.sessions[s.TokenHash] = s
	return nil
}
func (m *mockSessionRepo) FindByTokenHash(_ context.Context, h string) (*domain.Session, error) {
	if s, ok := m.sessions[h]; ok {
		return s, nil
	}
	return nil, &domain.ErrNotFound{Resource: "session", ID: h[:8]}
}
func (m *mockSessionRepo) DeleteByTokenHash(_ context.Context, h string) error {
	delete(m.sessions, h)
	return nil
}
func (m *mockSessionRepo) DeleteExpired(_ context.Context) (int, error) { return 0, nil }

type mockMemberRepo struct {
	members []domain.ProjectMember
}

func newMockMemberRepo() *mockMemberRepo { return &mockMemberRepo{} }

func (m *mockMemberRepo) AddMember(_ context.Context, userID, projectID, role string) error {
	m.members = append(m.members, domain.ProjectMember{
		UserID: userID, ProjectID: projectID, Role: role, CreatedAt: time.Now(),
	})
	return nil
}
func (m *mockMemberRepo) ListUserProjects(_ context.Context, userID string) ([]domain.Project, error) {
	return nil, nil
}
func (m *mockMemberRepo) IsMember(_ context.Context, userID, projectID string) (bool, string, error) {
	for _, mem := range m.members {
		if mem.UserID == userID && mem.ProjectID == projectID {
			return true, mem.Role, nil
		}
	}
	return false, "", nil
}

// --- Test Setup ---

type testServer struct {
	handler     http.Handler
	projectRepo *mockProjectRepo
	eventRepo   *mockEventRepo
	userRepo    *mockUserRepo
	sessionRepo *mockSessionRepo
	memberRepo  *mockMemberRepo
	project     *domain.Project
}

func setupTestServer() *testServer {
	logger := slog.Default()
	eventRepo := &mockEventRepo{}
	projectRepo := &mockProjectRepo{}
	userRepo := newMockUserRepo()
	sessionRepo := newMockSessionRepo()
	memberRepo := newMockMemberRepo()

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
	userAuthHandlers := userauth.NewHandlers(userRepo, sessionRepo, logger, false)

	router := NewRouter(RouterConfig{
		Logger:      logger,
		Keystore:    ks,
		RateLimiter: rl,
		Ingestion:   ingestionHandler,
		Query:       queryHandler,
		Projects:    projectRepo,
		Members:     memberRepo,
		Users:       userRepo,
		Sessions:    sessionRepo,
		UserAuth:    userAuthHandlers,
		CORSOrigins: "*",
	})

	return &testServer{
		handler:     router,
		projectRepo: projectRepo,
		eventRepo:   eventRepo,
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		memberRepo:  memberRepo,
		project:     project,
	}
}

// authenticateAs creates a test user + session and returns the session cookie value.
func authenticateAs(t *testing.T, ts *testServer, email string) string {
	t.Helper()
	user := &domain.User{
		ID:           "user-" + email,
		Email:        email,
		PasswordHash: "ignored",
		Name:         "Test User",
		IsAdmin:      true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	ts.userRepo.users[user.ID] = user

	token, _ := userauth.GenerateToken()
	session := &domain.Session{
		ID:        "sess-" + email,
		UserID:    user.ID,
		TokenHash: userauth.HashToken(token),
		ExpiresAt: time.Now().Add(time.Hour),
		CreatedAt: time.Now(),
	}
	ts.sessionRepo.sessions[session.TokenHash] = session
	return token
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
	token := authenticateAs(t, ts, "test@example.com")

	body := []byte(`{"name":"New Project"}`)
	req := httptest.NewRequest("POST", "/v1/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: userauth.SessionCookieName, Value: token})

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

func TestCreateProjectRequiresAuth(t *testing.T) {
	ts := setupTestServer()

	body := []byte(`{"name":"New Project"}`)
	req := httptest.NewRequest("POST", "/v1/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without session, got %d", rec.Code)
	}
}

func TestCreateProjectMissingName(t *testing.T) {
	ts := setupTestServer()
	token := authenticateAs(t, ts, "test@example.com")

	body := []byte(`{"name":""}`)
	req := httptest.NewRequest("POST", "/v1/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: userauth.SessionCookieName, Value: token})

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
		WriteKey: "rk_ratelimit_test", SecretKey: "sk_ratelimit_test",
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
	req.Header.Set("Authorization", "Bearer rk_ratelimit_test")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", rec.Code)
	}

	// Second request should be rate limited
	req = httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(validBody))
	req.Header.Set("Authorization", "Bearer rk_ratelimit_test")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("second request: expected 429, got %d", rec.Code)
	}
}

func TestQueryFunnelRejectsSingleStep(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/funnel?steps=signup_start", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("a funnel needs at least 2 steps: expected 400, got %d", rec.Code)
	}
}

func TestQueryFunnelRejectsTooManySteps(t *testing.T) {
	ts := setupTestServer()

	steps := make([]string, storage.MaxFunnelSteps+1)
	for i := range steps {
		steps[i] = fmt.Sprintf("step_%d", i)
	}

	req := httptest.NewRequest("GET", "/v1/query/funnel?steps="+strings.Join(steps, ","), nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 above the step cap, got %d", rec.Code)
	}
}

func TestQueryFunnelWindowParameter(t *testing.T) {
	ts := setupTestServer()

	tests := []struct {
		window   string
		wantCode int
		wantSecs float64
	}{
		{"", http.StatusOK, 7 * 24 * 3600},
		{"24h", http.StatusOK, 24 * 3600},
		{"30m", http.StatusOK, 1800},
		{"2w", http.StatusOK, 14 * 24 * 3600},
		{"none", http.StatusOK, 0},
		{"365d", http.StatusBadRequest, 0},
		{"soon", http.StatusBadRequest, 0},
		{"-5d", http.StatusBadRequest, 0},
	}

	for _, tt := range tests {
		req := httptest.NewRequest("GET", "/v1/query/funnel?steps=a,b&window="+tt.window, nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")

		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != tt.wantCode {
			t.Errorf("window=%q: expected %d, got %d: %s", tt.window, tt.wantCode, rec.Code, rec.Body.String())
			continue
		}
		if tt.wantCode != http.StatusOK {
			continue
		}

		var result map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatalf("window=%q: %v", tt.window, err)
		}
		if got, _ := result["window_seconds"].(float64); got != tt.wantSecs {
			t.Errorf("window=%q: expected %.0f seconds, got %.0f", tt.window, tt.wantSecs, got)
		}
	}
}

func TestQueryFunnelNeverGrowsBetweenSteps(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/funnel?steps=a,b,c", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	var result struct {
		Funnel []storage.FunnelStep `json:"funnel"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode funnel: %v", err)
	}
	if len(result.Funnel) != 3 {
		t.Fatalf("expected 3 steps, got %d", len(result.Funnel))
	}

	for i, step := range result.Funnel {
		if i > 0 && step.Count > result.Funnel[i-1].Count {
			t.Errorf("step %d reports more people (%d) than step %d (%d)",
				i+1, step.Count, i, result.Funnel[i-1].Count)
		}
		if step.ConversionRate > 100 {
			t.Errorf("step %d: conversion above 100%%: %.1f", i+1, step.ConversionRate)
		}
	}
}

func TestQueryBreakdownEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/breakdown?key=platform", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		Key       string                    `json:"key"`
		Breakdown []storage.BreakdownBucket `json:"breakdown"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode breakdown: %v", err)
	}
	if result.Key != "platform" {
		t.Errorf("expected the dimension echoed back, got %q", result.Key)
	}
	if len(result.Breakdown) != 2 {
		t.Errorf("expected 2 buckets, got %d", len(result.Breakdown))
	}
}

func TestQueryBreakdownRejectsUnknownDimension(t *testing.T) {
	ts := setupTestServer()

	for _, key := range []string{"", "nonsense", "users.password", "properties.a' OR '1'='1"} {
		req := httptest.NewRequest("GET", "/v1/query/breakdown?key="+url.QueryEscape(key), nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")

		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("key=%q: expected 400, got %d", key, rec.Code)
		}
	}
}

func TestQueryDimensionsEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/dimensions", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		Dimensions []storage.Dimension `json:"dimensions"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode dimensions: %v", err)
	}

	keys := map[string]bool{}
	for _, dim := range result.Dimensions {
		keys[dim.Key] = true
	}
	// Built-in shorthands plus the custom properties the mock reports in use.
	for _, want := range []string{"platform", "country", "app_version", "properties.plan", "properties.source"} {
		if !keys[want] {
			t.Errorf("expected dimension %q to be offered", want)
		}
	}
}

func TestQueryFiltersReachTheRepository(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/breakdown?key=country&filter=platform:ios&filter=properties.plan:pro", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	got := ts.eventRepo.lastBreakdown
	if got == nil {
		t.Fatal("expected the breakdown query to reach the repository")
	}
	if len(got.Filters) != 2 {
		t.Fatalf("expected 2 filters to be passed through, got %d", len(got.Filters))
	}
	if got.Filters[0].Dimension.Key != "platform" || got.Filters[0].Value != "ios" {
		t.Errorf("unexpected first filter: %+v", got.Filters[0])
	}
	if got.Filters[1].Dimension.Column != "properties" || got.Filters[1].Value != "pro" {
		t.Errorf("unexpected second filter: %+v", got.Filters[1])
	}
}

func TestQueryRejectsInvalidFilter(t *testing.T) {
	ts := setupTestServer()

	for _, filter := range []string{"platform", "nonsense:value", "users.password:x"} {
		req := httptest.NewRequest("GET", "/v1/query/stats?filter="+url.QueryEscape(filter), nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")

		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("filter=%q: expected 400, got %d", filter, rec.Code)
		}
	}
}

func TestQueryFunnelBreakdownReturnsSegments(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/funnel?steps=a,b&breakdown=platform", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		Funnel    []storage.FunnelStep    `json:"funnel"`
		Breakdown string                  `json:"breakdown"`
		Segments  []storage.FunnelSegment `json:"segments"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode funnel: %v", err)
	}

	if result.Breakdown != "platform" {
		t.Errorf("expected the breakdown echoed back, got %q", result.Breakdown)
	}
	if len(result.Segments) != 2 {
		t.Fatalf("expected one segment per platform value, got %d", len(result.Segments))
	}
	if result.Segments[0].Value != "ios" {
		t.Errorf("expected the largest segment first, got %q", result.Segments[0].Value)
	}
	for _, segment := range result.Segments {
		if len(segment.Steps) != 2 {
			t.Errorf("segment %q: expected 2 steps, got %d", segment.Value, len(segment.Steps))
		}
	}
	// The overall funnel is still returned alongside the segments.
	if len(result.Funnel) != 2 {
		t.Errorf("expected the overall funnel too, got %d steps", len(result.Funnel))
	}
}

func TestQueryFunnelSegmentCarriesItsFilter(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/funnel?steps=a,b&breakdown=platform", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	// The last funnel query is the unsegmented one, so it must carry no filter;
	// the segment queries before it each added exactly one.
	if got := ts.eventRepo.lastFunnel; got == nil || len(got.Filters) != 0 {
		t.Errorf("expected the overall funnel to run unfiltered, got %+v", got)
	}
}

func TestQueryRevenueEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/revenue", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var summary storage.RevenueSummary
	if err := json.Unmarshal(rec.Body.Bytes(), &summary); err != nil {
		t.Fatalf("decode revenue: %v", err)
	}
	if summary.Currency != "EUR" {
		t.Errorf("expected the currency to be reported, got %q", summary.Currency)
	}
	if summary.TotalRevenue != 1250.50 {
		t.Errorf("expected the total to survive the round trip, got %v", summary.TotalRevenue)
	}
	if len(summary.Timeseries) != 2 {
		t.Errorf("expected 2 timeseries points, got %d", len(summary.Timeseries))
	}
	if len(summary.AvailableCurrencies) != 2 {
		t.Errorf("expected both currencies to be listed, got %v", summary.AvailableCurrencies)
	}
}

func TestQueryRevenueCurrencyParameter(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/revenue?currency=usd", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if got := ts.eventRepo.lastRevenue; got == nil || got.Currency != "USD" {
		t.Errorf("expected the currency to be normalised to USD, got %+v", got)
	}
}

func TestQueryRevenueRejectsBadCurrency(t *testing.T) {
	ts := setupTestServer()

	for _, currency := range []string{"EUROS", "E", "12", "€"} {
		req := httptest.NewRequest("GET", "/v1/query/revenue?currency="+url.QueryEscape(currency), nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")

		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("currency=%q: expected 400, got %d", currency, rec.Code)
		}
	}
}

func TestQueryRevenueRejectsBadInterval(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/revenue?interval=fortnight", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an unsupported interval, got %d", rec.Code)
	}
}

func TestQueryRevenuePassesFilters(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/revenue?filter=platform:ios", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	got := ts.eventRepo.lastRevenue
	if got == nil || len(got.Filters) != 1 {
		t.Fatalf("expected the filter to reach the repository, got %+v", got)
	}
	if got.Filters[0].Dimension.Key != "platform" || got.Filters[0].Value != "ios" {
		t.Errorf("unexpected filter: %+v", got.Filters[0])
	}
}

func TestQueryActiveUsersEndpoint(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/active-users", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		ActiveUsers []storage.ActiveUsersPoint `json:"active_users"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode active users: %v", err)
	}
	if len(result.ActiveUsers) != 2 {
		t.Fatalf("expected 2 points, got %d", len(result.ActiveUsers))
	}
	if result.ActiveUsers[0].DAU != 120 || result.ActiveUsers[0].MAU != 1500 {
		t.Errorf("unexpected first point: %+v", result.ActiveUsers[0])
	}
}

func TestQueryActiveUsersRejectsHugeRange(t *testing.T) {
	ts := setupTestServer()

	url := fmt.Sprintf("/v1/query/active-users?from=%s&to=%s",
		time.Now().AddDate(-3, 0, 0).UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339),
	)
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")

	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for a multi-year range, got %d", rec.Code)
	}
}

// The comparison is opt-in, so the default must stay a single query. Asking for
// it must produce a second one covering the window immediately before.
func TestQueryStatsComparison(t *testing.T) {
	from := time.Date(2026, 9, 4, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 11, 0, 0, 0, 0, time.UTC)

	t.Run("off by default", func(t *testing.T) {
		ts := setupTestServer()
		url := fmt.Sprintf("/v1/query/stats?from=%s&to=%s",
			from.Format(time.RFC3339), to.Format(time.RFC3339))
		req := httptest.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")
		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if len(ts.eventRepo.statsCalls) != 1 {
			t.Errorf("expected one query without compare, got %d", len(ts.eventRepo.statsCalls))
		}
		if strings.Contains(rec.Body.String(), "previous") {
			t.Error("response carries a previous period that was not asked for")
		}
	})

	t.Run("compare=true adds the preceding window", func(t *testing.T) {
		ts := setupTestServer()
		url := fmt.Sprintf("/v1/query/stats?from=%s&to=%s&compare=true",
			from.Format(time.RFC3339), to.Format(time.RFC3339))
		req := httptest.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer sk_test_secret_key")
		rec := httptest.NewRecorder()
		ts.handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if len(ts.eventRepo.statsCalls) != 2 {
			t.Fatalf("expected two queries with compare, got %d", len(ts.eventRepo.statsCalls))
		}

		// Seven days back, ending where the current window opens.
		prev := ts.eventRepo.statsCalls[1]
		wantFrom := time.Date(2026, 8, 28, 0, 0, 0, 0, time.UTC)
		if !prev.From.Equal(wantFrom) {
			t.Errorf("comparison window starts %s, want %s", prev.From, wantFrom)
		}
		if !prev.To.Before(from) {
			t.Errorf("comparison window ends %s, which overlaps the current window", prev.To)
		}

		var got struct {
			TotalEvents int `json:"total_events"`
			Previous    *struct {
				TotalEvents int `json:"total_events"`
			} `json:"previous"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.Previous == nil {
			t.Fatal("response has no previous period")
		}
		if got.TotalEvents != 100 || got.Previous.TotalEvents != 80 {
			t.Errorf("current = %d, previous = %d; want 100 and 80",
				got.TotalEvents, got.Previous.TotalEvents)
		}
	})
}

func TestQueryCohortRevenueEndpoint(t *testing.T) {
	ts := setupTestServer()

	url := fmt.Sprintf("/v1/query/cohort-revenue?from=%s&to=%s&interval=month",
		time.Now().Add(-90*24*time.Hour).UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339),
	)
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")
	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if ts.eventRepo.lastCohort == nil {
		t.Fatal("the store was never asked for cohort revenue")
	}
	if ts.eventRepo.lastCohort.Interval != "month" {
		t.Errorf("interval = %q, want month", ts.eventRepo.lastCohort.Interval)
	}
}

func TestQueryCohortRevenueRejectsBadInterval(t *testing.T) {
	ts := setupTestServer()

	req := httptest.NewRequest("GET", "/v1/query/cohort-revenue?interval=fortnight", nil)
	req.Header.Set("Authorization", "Bearer sk_test_secret_key")
	rec := httptest.NewRecorder()
	ts.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an unsupported interval, got %d: %s", rec.Code, rec.Body.String())
	}
}
