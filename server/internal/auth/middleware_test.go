package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/storage"
)

type mockProjectRepo struct {
	projects map[string]*domain.Project // keyed by write_key or secret_key
}

func (m *mockProjectRepo) Create(_ context.Context, p *domain.Project) error {
	return nil
}

func (m *mockProjectRepo) FindByWriteKey(_ context.Context, key string) (*domain.Project, error) {
	if p, ok := m.projects["w:"+key]; ok {
		return p, nil
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: key}
}

func (m *mockProjectRepo) FindBySecretKey(_ context.Context, key string) (*domain.Project, error) {
	if p, ok := m.projects["s:"+key]; ok {
		return p, nil
	}
	return nil, &domain.ErrNotFound{Resource: "project", ID: key}
}

func (m *mockProjectRepo) FindByID(_ context.Context, id string) (*domain.Project, error) {
	return nil, &domain.ErrNotFound{Resource: "project", ID: id}
}

func (m *mockProjectRepo) RotateKeys(_ context.Context, _ string, _, _ string) error {
	return nil
}

var _ storage.ProjectRepository = (*mockProjectRepo)(nil)

func TestMiddleware_ValidWriteKey(t *testing.T) {
	project := &domain.Project{ID: "p1", WriteKey: "rk_test"}
	repo := &mockProjectRepo{
		projects: map[string]*domain.Project{"w:rk_test": project},
	}
	ks := NewKeystore(repo)

	called := false
	handler := Middleware(ks)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		p := ProjectFromContext(r.Context())
		if p == nil || p.ID != "p1" {
			t.Error("expected project in context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer rk_test")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("handler was not called")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestMiddleware_MissingAuth(t *testing.T) {
	repo := &mockProjectRepo{projects: map[string]*domain.Project{}}
	ks := NewKeystore(repo)

	handler := Middleware(ks)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_InvalidKey(t *testing.T) {
	repo := &mockProjectRepo{projects: map[string]*domain.Project{}}
	ks := NewKeystore(repo)

	handler := Middleware(ks)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer bad_key")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestRequireKeyType_WriteKey(t *testing.T) {
	project := &domain.Project{ID: "p1", WriteKey: "rk_test"}
	repo := &mockProjectRepo{
		projects: map[string]*domain.Project{"w:rk_test": project},
	}
	ks := NewKeystore(repo)

	called := false
	handler := Middleware(ks)(RequireKeyType(domain.KeyTypeWrite)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer rk_test")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("handler was not called")
	}
}

func TestRequireKeyType_WrongType(t *testing.T) {
	project := &domain.Project{ID: "p1", WriteKey: "rk_test"}
	repo := &mockProjectRepo{
		projects: map[string]*domain.Project{"w:rk_test": project},
	}
	ks := NewKeystore(repo)

	handler := Middleware(ks)(RequireKeyType(domain.KeyTypeSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for wrong key type")
	})))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer rk_test")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}
