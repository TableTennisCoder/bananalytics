package ingestion

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"log/slog"

	"github.com/bananalytics/server/internal/auth"
	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
	"github.com/bananalytics/server/pkg/clock"
)

type mockEventRepo struct {
	insertedEvents   []domain.Event
	insertErr        error
	linkedIdentities []storage.IdentityLink
	linkErr          error
}

func (m *mockEventRepo) InsertBatch(_ context.Context, events []domain.Event) (int, error) {
	if m.insertErr != nil {
		return 0, m.insertErr
	}
	m.insertedEvents = append(m.insertedEvents, events...)
	return len(events), nil
}

func (m *mockEventRepo) QueryEvents(_ context.Context, _ storage.EventFilter) ([]domain.Event, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryFunnel(_ context.Context, _ storage.FunnelParams) ([]storage.FunnelStep, error) {
	return nil, nil
}
func (m *mockEventRepo) QuerySessions(_ context.Context, _, _ string) ([]storage.Session, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryRetention(_ context.Context, _ string, _, _ time.Time) ([]storage.RetentionCohort, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryStats(_ context.Context, _ storage.QueryParams) (*storage.StatsOverview, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryTimeseries(_ context.Context, _ storage.QueryParams, _ string) ([]storage.TimeseriesPoint, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryTopEvents(_ context.Context, _ storage.QueryParams, _ int) ([]storage.TopEvent, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryEventNames(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryGeo(_ context.Context, _ storage.QueryParams, _ string) ([]storage.GeoData, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryBreakdown(_ context.Context, _ storage.BreakdownParams) ([]storage.BreakdownBucket, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryPropertyKeys(_ context.Context, _ string, _, _ time.Time) ([]string, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryActiveUsers(_ context.Context, _ storage.QueryParams) ([]storage.ActiveUsersPoint, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryRevenue(_ context.Context, _ storage.RevenueParams) (*storage.RevenueSummary, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryCohortRevenue(_ context.Context, _ storage.CohortRevenueParams) (*storage.CohortRevenueReport, error) {
	return nil, nil
}

// LinkIdentities records what the handler linked so tests can assert on it.
func (m *mockEventRepo) LinkIdentities(_ context.Context, links []storage.IdentityLink) error {
	if m.linkErr != nil {
		return m.linkErr
	}
	m.linkedIdentities = append(m.linkedIdentities, links...)
	return nil
}
func (m *mockEventRepo) QueryLive(_ context.Context, _ string) (*storage.LiveData, error) {
	return nil, nil
}

// mockProjectRepo for auth keystore in tests.
type mockProjectRepo struct {
	project *domain.Project
}

func (m *mockProjectRepo) Create(_ context.Context, _ *domain.Project) error { return nil }
func (m *mockProjectRepo) FindByWriteKey(_ context.Context, key string) (*domain.Project, error) {
	if m.project != nil && m.project.WriteKey == key {
		return m.project, nil
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: key}
}
func (m *mockProjectRepo) FindBySecretKey(_ context.Context, _ string) (*domain.Project, error) {
	return nil, &domain.ErrNotFound{Resource: "project", ID: ""}
}
func (m *mockProjectRepo) FindByWriteKeyPrefix(_ context.Context, prefix string) ([]storage.ProjectWithHash, error) {
	if m.project != nil && len(m.project.WriteKey) >= 8 && m.project.WriteKey[:8] == prefix {
		h := sha256.Sum256([]byte(m.project.WriteKey))
		return []storage.ProjectWithHash{{Project: *m.project, KeyHash: hex.EncodeToString(h[:])}}, nil
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: prefix}
}
func (m *mockProjectRepo) FindBySecretKeyPrefix(_ context.Context, _ string) ([]storage.ProjectWithHash, error) {
	return nil, &domain.ErrNotFound{Resource: "project", ID: ""}
}
func (m *mockProjectRepo) FindByID(_ context.Context, _ string) (*domain.Project, error) {
	return nil, &domain.ErrNotFound{Resource: "project", ID: ""}
}
func (m *mockProjectRepo) RotateKeys(_ context.Context, _ string, _, _ string) error { return nil }

func makeAuthenticatedRequest(t *testing.T, body any) *http.Request {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer rk_testkey123")
	return req
}

func validEvent() domain.Event {
	return domain.Event{
		MessageID:   "msg-1",
		EventName:   "button_clicked",
		Type:        "track",
		Properties:  json.RawMessage(`{"button":"signup"}`),
		Context:     json.RawMessage(`{"session":{"id":"sess-1"}}`),
		AnonymousID: "anon-1",
		ClientTS:    time.Now().UTC(),
	}
}

func setupHandler(t *testing.T, repo *mockEventRepo) (http.Handler, *mockEventRepo) {
	t.Helper()
	if repo == nil {
		repo = &mockEventRepo{}
	}

	project := &domain.Project{ID: "proj-123", Name: "Test", WriteKey: "rk_testkey123"}
	projectRepo := &mockProjectRepo{project: project}
	ks := auth.NewKeystore(projectRepo)

	clk := clock.Mock{NowFunc: func() time.Time { return time.Date(2025, 6, 1, 12, 0, 0, 0, time.UTC) }}
	enricher := NewEnricher(clk, nil)
	handler := NewHandler(repo, enricher, slog.Default())

	// Wrap with auth middleware
	wrapped := auth.Middleware(ks)(http.HandlerFunc(handler.HandleIngest))
	return wrapped, repo
}

func TestHandleIngest_ValidBatch(t *testing.T) {
	handler, repo := setupHandler(t, nil)

	body := domain.IngestRequest{
		Batch: []domain.Event{validEvent()},
	}
	req := makeAuthenticatedRequest(t, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp domain.IngestResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.Success {
		t.Error("expected success=true")
	}
	if resp.Accepted != 1 {
		t.Errorf("expected 1 accepted, got %d", resp.Accepted)
	}
	if len(repo.insertedEvents) != 1 {
		t.Errorf("expected 1 inserted event, got %d", len(repo.insertedEvents))
	}
}

func TestHandleIngest_InvalidJSON(t *testing.T) {
	handler, _ := setupHandler(t, nil)

	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader([]byte(`{invalid`)))
	req.Header.Set("Authorization", "Bearer rk_testkey123")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandleIngest_EmptyBatch(t *testing.T) {
	handler, _ := setupHandler(t, nil)

	body := domain.IngestRequest{Batch: []domain.Event{}}
	req := makeAuthenticatedRequest(t, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandleIngest_MixedValidInvalid(t *testing.T) {
	handler, repo := setupHandler(t, nil)

	invalid := domain.Event{
		MessageID:   "msg-2",
		EventName:   "",
		Type:        "track",
		AnonymousID: "anon-1",
		ClientTS:    time.Now().UTC(),
	}

	body := domain.IngestRequest{
		Batch: []domain.Event{validEvent(), invalid},
	}
	req := makeAuthenticatedRequest(t, body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp domain.IngestResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Accepted != 1 {
		t.Errorf("expected 1 accepted, got %d", resp.Accepted)
	}
	if resp.Rejected != 1 {
		t.Errorf("expected 1 rejected, got %d", resp.Rejected)
	}
	if len(repo.insertedEvents) != 1 {
		t.Errorf("expected 1 inserted event, got %d", len(repo.insertedEvents))
	}
}

func TestHandleIngest_NoAuth(t *testing.T) {
	handler, _ := setupHandler(t, nil)

	req := httptest.NewRequest("POST", "/v1/ingest", bytes.NewReader([]byte(`{"batch":[]}`)))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestIdentityLinksFromBatch(t *testing.T) {
	userA := "user-1"
	userB := "user-2"
	empty := ""

	events := []domain.Event{
		{AnonymousID: "anon-1", UserID: &userA},
		// Duplicate pair — must be collapsed into one link.
		{AnonymousID: "anon-1", UserID: &userA},
		{AnonymousID: "anon-2", UserID: &userB},
		// Anonymous events carry no identity to link.
		{AnonymousID: "anon-3", UserID: nil},
		// An empty user ID is not an identity.
		{AnonymousID: "anon-4", UserID: &empty},
	}

	links := identityLinks(events, "project-1")

	if len(links) != 2 {
		t.Fatalf("expected 2 links, got %d: %+v", len(links), links)
	}
	for _, link := range links {
		if link.ProjectID != "project-1" {
			t.Errorf("expected the project to be carried through, got %q", link.ProjectID)
		}
	}
	if links[0].AnonymousID != "anon-1" || links[0].UserID != "user-1" {
		t.Errorf("unexpected first link: %+v", links[0])
	}
	if links[1].AnonymousID != "anon-2" || links[1].UserID != "user-2" {
		t.Errorf("unexpected second link: %+v", links[1])
	}
}

// identifiedEvent is a valid event carrying a user ID, which is what reveals an
// anonymous-to-user mapping.
func identifiedEvent() domain.Event {
	userID := "user-7"
	event := validEvent()
	event.EventName = "login"
	event.Type = "identify"
	event.UserID = &userID
	return event
}

func TestIngestLinksIdentities(t *testing.T) {
	handler, repo := setupHandler(t, nil)

	req := makeAuthenticatedRequest(t, domain.IngestRequest{Batch: []domain.Event{identifiedEvent()}})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(repo.linkedIdentities) != 1 {
		t.Fatalf("expected 1 identity link, got %d", len(repo.linkedIdentities))
	}

	link := repo.linkedIdentities[0]
	if link.AnonymousID != "anon-1" || link.UserID != "user-7" {
		t.Errorf("unexpected link: %+v", link)
	}
	if link.ProjectID != "proj-123" {
		t.Errorf("expected the authenticated project, got %q", link.ProjectID)
	}
}

func TestIngestWithoutUserIDLinksNothing(t *testing.T) {
	handler, repo := setupHandler(t, nil)

	req := makeAuthenticatedRequest(t, domain.IngestRequest{Batch: []domain.Event{validEvent()}})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(repo.linkedIdentities) != 0 {
		t.Errorf("an anonymous batch reveals no identity, got %+v", repo.linkedIdentities)
	}
}

// TestIngestSucceedsWhenIdentityLinkFails pins the best-effort contract: the
// events are already stored, so a failing link must not fail the request.
func TestIngestSucceedsWhenIdentityLinkFails(t *testing.T) {
	repo := &mockEventRepo{linkErr: errors.New("identities table unavailable")}
	handler, _ := setupHandler(t, repo)

	req := makeAuthenticatedRequest(t, domain.IngestRequest{Batch: []domain.Event{identifiedEvent()}})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected the ingest to still succeed, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(repo.insertedEvents) != 1 {
		t.Errorf("expected the event to be stored, got %d", len(repo.insertedEvents))
	}
}
