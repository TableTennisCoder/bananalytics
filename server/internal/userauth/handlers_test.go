package userauth

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/domain"
)

// --- Mocks ---

type mockUserStore struct {
	users map[string]*domain.User
}

func newMockUserStore() *mockUserStore {
	return &mockUserStore{users: map[string]*domain.User{}}
}

func (m *mockUserStore) Create(_ context.Context, u *domain.User) error {
	m.users[u.ID] = u
	return nil
}
func (m *mockUserStore) FindByID(_ context.Context, id string) (*domain.User, error) {
	if u, ok := m.users[id]; ok {
		return u, nil
	}
	return nil, &domain.ErrNotFound{Resource: "user", ID: id}
}
func (m *mockUserStore) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, &domain.ErrNotFound{Resource: "user", ID: email}
}
func (m *mockUserStore) Count(_ context.Context) (int, error) { return len(m.users), nil }

type mockSessionStore struct {
	sessions map[string]*domain.Session
}

func newMockSessionStore() *mockSessionStore {
	return &mockSessionStore{sessions: map[string]*domain.Session{}}
}

func (m *mockSessionStore) Create(_ context.Context, s *domain.Session) error {
	m.sessions[s.TokenHash] = s
	return nil
}
func (m *mockSessionStore) FindByTokenHash(_ context.Context, h string) (*domain.Session, error) {
	if s, ok := m.sessions[h]; ok {
		return s, nil
	}
	return nil, &domain.ErrNotFound{Resource: "session", ID: h}
}
func (m *mockSessionStore) DeleteByTokenHash(_ context.Context, h string) error {
	delete(m.sessions, h)
	return nil
}
func (m *mockSessionStore) DeleteExpired(_ context.Context) (int, error) { return 0, nil }

func newTestHandlers() (*Handlers, *mockUserStore, *mockSessionStore) {
	users := newMockUserStore()
	sessions := newMockSessionStore()
	h := NewHandlers(users, sessions, slog.Default(), false)
	return h, users, sessions
}

// --- Status tests ---

func TestStatus_NeedsSetup(t *testing.T) {
	h, _, _ := newTestHandlers()
	req := httptest.NewRequest("GET", "/v1/auth/status", nil)
	rec := httptest.NewRecorder()
	h.HandleStatus(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "needs_setup" {
		t.Errorf("expected needs_setup, got %v", body["status"])
	}
}

func TestStatus_Unauthenticated(t *testing.T) {
	h, users, _ := newTestHandlers()
	users.users["u1"] = &domain.User{ID: "u1", Email: "a@b.com"}

	req := httptest.NewRequest("GET", "/v1/auth/status", nil)
	rec := httptest.NewRecorder()
	h.HandleStatus(rec, req)

	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "unauthenticated" {
		t.Errorf("expected unauthenticated, got %v", body["status"])
	}
}

func TestStatus_Authenticated(t *testing.T) {
	h, users, sessions := newTestHandlers()
	user := &domain.User{ID: "u1", Email: "a@b.com", Name: "A"}
	users.users[user.ID] = user

	token, _ := GenerateToken()
	sessions.sessions[HashToken(token)] = &domain.Session{
		ID:        "s1",
		UserID:    user.ID,
		TokenHash: HashToken(token),
		ExpiresAt: time.Now().Add(time.Hour),
	}

	req := httptest.NewRequest("GET", "/v1/auth/status", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	rec := httptest.NewRecorder()
	h.HandleStatus(rec, req)

	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "authenticated" {
		t.Errorf("expected authenticated, got %v", body["status"])
	}
}

// --- Setup tests ---

func TestSetup_CreatesFirstUser(t *testing.T) {
	h, users, _ := newTestHandlers()

	body := []byte(`{"email":"admin@example.com","password":"password123","name":"Admin"}`)
	req := httptest.NewRequest("POST", "/v1/auth/setup", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleSetup(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(users.users) != 1 {
		t.Errorf("expected 1 user, got %d", len(users.users))
	}

	// Cookie should be set
	cookies := rec.Result().Cookies()
	hasSession := false
	for _, c := range cookies {
		if c.Name == SessionCookieName && c.Value != "" {
			hasSession = true
		}
	}
	if !hasSession {
		t.Error("expected session cookie to be set")
	}
}

func TestSetup_RejectedAfterFirstUser(t *testing.T) {
	h, users, _ := newTestHandlers()
	users.users["existing"] = &domain.User{ID: "existing"}

	body := []byte(`{"email":"second@example.com","password":"password123","name":"Two"}`)
	req := httptest.NewRequest("POST", "/v1/auth/setup", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleSetup(rec, req)

	if rec.Code != http.StatusGone {
		t.Errorf("expected 410, got %d", rec.Code)
	}
}

func TestSetup_RejectsShortPassword(t *testing.T) {
	h, _, _ := newTestHandlers()

	body := []byte(`{"email":"a@b.com","password":"short","name":"X"}`)
	req := httptest.NewRequest("POST", "/v1/auth/setup", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleSetup(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestSetup_RejectsInvalidEmail(t *testing.T) {
	h, _, _ := newTestHandlers()

	body := []byte(`{"email":"notanemail","password":"password123","name":"X"}`)
	req := httptest.NewRequest("POST", "/v1/auth/setup", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleSetup(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

// --- Login tests ---

func TestLogin_Succeeds(t *testing.T) {
	h, users, _ := newTestHandlers()

	hash, _ := HashPassword("correct-password")
	users.users["u1"] = &domain.User{
		ID: "u1", Email: "user@example.com", PasswordHash: hash, Name: "User",
	}

	body := []byte(`{"email":"user@example.com","password":"correct-password"}`)
	req := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleLogin(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	h, users, _ := newTestHandlers()

	hash, _ := HashPassword("correct-password")
	users.users["u1"] = &domain.User{
		ID: "u1", Email: "user@example.com", PasswordHash: hash,
	}

	body := []byte(`{"email":"user@example.com","password":"wrong-password"}`)
	req := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestLogin_UnknownUser(t *testing.T) {
	h, _, _ := newTestHandlers()

	body := []byte(`{"email":"nobody@example.com","password":"any-password"}`)
	req := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

// --- Logout test ---

func TestLogout_RevokesSession(t *testing.T) {
	h, _, sessions := newTestHandlers()

	token, _ := GenerateToken()
	sessions.sessions[HashToken(token)] = &domain.Session{
		ID:        "s1",
		UserID:    "u1",
		TokenHash: HashToken(token),
		ExpiresAt: time.Now().Add(time.Hour),
	}

	req := httptest.NewRequest("POST", "/v1/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	rec := httptest.NewRecorder()
	h.HandleLogout(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if _, ok := sessions.sessions[HashToken(token)]; ok {
		t.Error("expected session to be deleted")
	}
}

// --- Password tests ---

func TestPassword_HashAndVerify(t *testing.T) {
	hash, err := HashPassword("my-password-is-long-enough")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("my-password-is-long-enough", hash) {
		t.Error("expected verification to succeed")
	}
	if VerifyPassword("wrong-password-attempt", hash) {
		t.Error("expected verification to fail with wrong password")
	}
}

func TestPassword_RejectsShort(t *testing.T) {
	_, err := HashPassword("short")
	if err != ErrPasswordTooShort {
		t.Errorf("expected ErrPasswordTooShort, got %v", err)
	}
}

// --- Token tests ---

func TestToken_GenerateUnique(t *testing.T) {
	a, _ := GenerateToken()
	b, _ := GenerateToken()
	if a == b {
		t.Error("expected unique tokens")
	}
	if len(a) < 32 {
		t.Errorf("token too short: %d", len(a))
	}
}

func TestToken_HashConsistent(t *testing.T) {
	token := "test-token"
	if HashToken(token) != HashToken(token) {
		t.Error("expected hash to be consistent")
	}
}
