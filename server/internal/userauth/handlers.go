package userauth

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
)

// Handlers groups all user auth HTTP handlers.
type Handlers struct {
	users    storage.UserRepository
	sessions storage.SessionRepository
	logger   *slog.Logger
	secure   bool // sets Secure flag on cookies (true in production)
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(users storage.UserRepository, sessions storage.SessionRepository, logger *slog.Logger, secure bool) *Handlers {
	return &Handlers{users: users, sessions: sessions, logger: logger, secure: secure}
}

type setupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userResponse struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	IsAdmin bool   `json:"is_admin"`
}

func toUserResponse(u *domain.User) userResponse {
	return userResponse{ID: u.ID, Email: u.Email, Name: u.Name, IsAdmin: u.IsAdmin}
}

// HandleStatus reports the auth state of the system and the request:
//   { "status": "needs_setup" }   — no users exist yet
//   { "status": "unauthenticated" } — users exist but no session
//   { "status": "authenticated", "user": {...} } — valid session
func (h *Handlers) HandleStatus(w http.ResponseWriter, r *http.Request) {
	count, err := h.users.Count(r.Context())
	if err != nil {
		h.logger.Error("failed to count users", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "INTERNAL_ERROR", "message": "failed to query"})
		return
	}

	if count == 0 {
		writeJSON(w, http.StatusOK, map[string]string{"status": "needs_setup"})
		return
	}

	user, err := AuthenticateRequest(r, h.users, h.sessions)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "unauthenticated"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "authenticated",
		"user":   toUserResponse(user),
	})
}

// HandleSetup creates the first admin user. Returns 410 Gone if a user already exists.
func (h *Handlers) HandleSetup(w http.ResponseWriter, r *http.Request) {
	count, err := h.users.Count(r.Context())
	if err != nil {
		h.logger.Error("failed to count users", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "INTERNAL_ERROR", "message": "failed to query"})
		return
	}
	if count > 0 {
		writeJSON(w, http.StatusGone, map[string]string{"code": "ALREADY_INITIALIZED", "message": "setup has already been completed"})
		return
	}

	var req setupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "BAD_REQUEST", "message": "invalid JSON"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if !isValidEmail(req.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "VALIDATION_FAILED", "message": "invalid email"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "VALIDATION_FAILED", "message": "name is required"})
		return
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "VALIDATION_FAILED", "message": err.Error()})
		return
	}

	now := time.Now().UTC()
	user := &domain.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: hash,
		Name:         req.Name,
		IsAdmin:      true, // first user is always admin
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := h.users.Create(r.Context(), user); err != nil {
		h.logger.Error("failed to create first user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "INTERNAL_ERROR", "message": "failed to create user"})
		return
	}

	if err := h.startSession(w, r, user); err != nil {
		h.logger.Error("failed to start session", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "INTERNAL_ERROR", "message": "failed to start session"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"user": toUserResponse(user)})
}

// HandleLogin authenticates a user and starts a session.
func (h *Handlers) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"code": "BAD_REQUEST", "message": "invalid JSON"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	user, err := h.users.FindByEmail(r.Context(), req.Email)
	if err != nil {
		// Run a dummy bcrypt to mitigate timing attacks
		_ = VerifyPassword(req.Password, "$2a$12$abcdefghijklmnopqrstuv")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "UNAUTHORIZED", "message": "invalid email or password"})
		return
	}

	if !VerifyPassword(req.Password, user.PasswordHash) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "UNAUTHORIZED", "message": "invalid email or password"})
		return
	}

	if err := h.startSession(w, r, user); err != nil {
		h.logger.Error("failed to start session", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "INTERNAL_ERROR", "message": "failed to start session"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": toUserResponse(user)})
}

// HandleLogout revokes the current session.
func (h *Handlers) HandleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(SessionCookieName)
	if err == nil && cookie.Value != "" {
		tokenHash := HashToken(cookie.Value)
		_ = h.sessions.DeleteByTokenHash(r.Context(), tokenHash)
	}

	// Clear cookie on client side
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secure,
		SameSite: http.SameSiteStrictMode,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

// HandleMe returns the current authenticated user.
func (h *Handlers) HandleMe(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "UNAUTHORIZED", "message": "not authenticated"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserResponse(user)})
}

// startSession creates a session in the DB and sets the cookie.
func (h *Handlers) startSession(w http.ResponseWriter, r *http.Request, user *domain.User) error {
	token, err := GenerateToken()
	if err != nil {
		return err
	}

	session := &domain.Session{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: HashToken(token),
		ExpiresAt: SessionExpiry(),
		CreatedAt: time.Now().UTC(),
		UserAgent: r.UserAgent(),
		IP:        clientIP(r),
	}

	if err := h.sessions.Create(r.Context(), session); err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   h.secure,
		SameSite: http.SameSiteStrictMode,
	})

	return nil
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}

func isValidEmail(email string) bool {
	if len(email) < 3 || len(email) > 255 {
		return false
	}
	at := strings.IndexByte(email, '@')
	if at < 1 || at >= len(email)-1 {
		return false
	}
	if !strings.Contains(email[at+1:], ".") {
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
