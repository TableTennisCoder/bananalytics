package userauth

import (
	"context"
	"net/http"
	"time"

	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/storage"
)

type contextKey string

const userContextKey contextKey = "user"

// RequireUser returns middleware that validates the session cookie.
// On success, the authenticated user is injected into the request context.
func RequireUser(users storage.UserRepository, sessions storage.SessionRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, err := AuthenticateRequest(r, users, sessions)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"code":    "UNAUTHORIZED",
					"message": "authentication required",
				})
				return
			}

			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AuthenticateRequest looks up the user from the session cookie. Returns nil + error
// if no valid session exists.
func AuthenticateRequest(r *http.Request, users storage.UserRepository, sessions storage.SessionRepository) (*domain.User, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil, &domain.ErrUnauthorized{Reason: "no session cookie"}
	}

	tokenHash := HashToken(cookie.Value)
	session, err := sessions.FindByTokenHash(r.Context(), tokenHash)
	if err != nil {
		return nil, &domain.ErrUnauthorized{Reason: "invalid session"}
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, &domain.ErrUnauthorized{Reason: "session expired"}
	}

	user, err := users.FindByID(r.Context(), session.UserID)
	if err != nil {
		return nil, &domain.ErrUnauthorized{Reason: "user not found"}
	}

	return user, nil
}

// UserFromContext retrieves the authenticated user from the request context.
// Returns nil if no user was authenticated.
func UserFromContext(ctx context.Context) *domain.User {
	user, _ := ctx.Value(userContextKey).(*domain.User)
	return user
}
