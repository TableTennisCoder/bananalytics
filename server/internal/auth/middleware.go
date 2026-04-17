package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/bananalytics/server/internal/domain"
)

type contextKey string

const (
	projectContextKey contextKey = "project"
	keyTypeContextKey contextKey = "keyType"
)

// Middleware returns an HTTP middleware that validates API keys.
func Middleware(ks *Keystore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearerToken(r)
			if token == "" {
				writeAuthError(w, "missing Authorization header")
				return
			}

			info, err := ks.Lookup(r.Context(), token)
			if err != nil {
				writeAuthError(w, "invalid_api_key")
				return
			}

			ctx := context.WithValue(r.Context(), projectContextKey, info.Project)
			ctx = context.WithValue(ctx, keyTypeContextKey, info.KeyType)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireKeyType returns middleware that ensures the authenticated key is of the given type.
func RequireKeyType(required domain.KeyType) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			kt, ok := r.Context().Value(keyTypeContextKey).(domain.KeyType)
			if !ok || kt != required {
				writeAuthError(w, "insufficient permissions for this endpoint")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ProjectFromContext extracts the authenticated project from the request context.
func ProjectFromContext(ctx context.Context) *domain.Project {
	project, _ := ctx.Value(projectContextKey).(*domain.Project)
	return project
}

func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(auth, "Bearer ")
}

func writeAuthError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"` + message + `"}`))
}
