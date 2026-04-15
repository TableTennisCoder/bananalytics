package ingestion

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"log/slog"

	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/storage"
	"github.com/rochade-analytics/server/pkg/clock"
)

type mockEventRepo struct {
	insertedEvents []domain.Event
	insertErr      error
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
func (m *mockEventRepo) QueryFunnel(_ context.Context, _ string, _ []string, _, _ time.Time) ([]storage.FunnelStep, error) {
	return nil, nil
}
func (m *mockEventRepo) QuerySessions(_ context.Context, _, _ string) ([]storage.Session, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryRetention(_ context.Context, _ string, _, _ time.Time) ([]storage.RetentionCohort, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryStats(_ context.Context, _ string, _, _ time.Time) (*storage.StatsOverview, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryTimeseries(_ context.Context, _ string, _, _ time.Time, _ string, _ string) ([]storage.TimeseriesPoint, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryTopEvents(_ context.Context, _ string, _, _ time.Time, _ int) ([]storage.TopEvent, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryEventNames(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}
func (m *mockEventRepo) QueryGeo(_ context.Context, _ string, _, _ time.Time, _ string) ([]storage.GeoData, error) {
	return nil, nil
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
	req.Header.Set("Authorization", "Bearer rk_test")
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

	project := &domain.Project{ID: "proj-123", Name: "Test", WriteKey: "rk_test"}
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
	req.Header.Set("Authorization", "Bearer rk_test")
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
