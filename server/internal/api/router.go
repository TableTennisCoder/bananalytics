package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"

	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/ingestion"
	"github.com/rochade-analytics/server/internal/query"
	"github.com/rochade-analytics/server/internal/ratelimit"
	"github.com/rochade-analytics/server/internal/storage"
)

// HealthChecker can verify database connectivity.
type HealthChecker interface {
	Ping(ctx context.Context) error
}

// RouterConfig holds dependencies for setting up the HTTP router.
type RouterConfig struct {
	Logger        *slog.Logger
	Keystore      *auth.Keystore
	RateLimiter   *ratelimit.TokenBucket   // per API key
	IPRateLimiter *ratelimit.TokenBucket   // per client IP
	Ingestion     *ingestion.Handler
	Query         *query.Handler
	Projects      storage.ProjectRepository
	CORSOrigins   string
	DB            HealthChecker // for /health endpoint
}

// NewRouter creates and configures the HTTP router with all routes.
func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(PanicRecovery(cfg.Logger))
	r.Use(RequestID)
	r.Use(Logger(cfg.Logger))

	// IP-based rate limiting — applies to all requests before auth
	if cfg.IPRateLimiter != nil {
		r.Use(ratelimit.IPMiddleware(cfg.IPRateLimiter))
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   strings.Split(cfg.CORSOrigins, ","),
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check — verifies database connectivity
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		httpStatus := http.StatusOK
		dbStatus := "connected"

		if cfg.DB != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := cfg.DB.Ping(ctx); err != nil {
				status = "unhealthy"
				httpStatus = http.StatusServiceUnavailable
				dbStatus = "unreachable"
				cfg.Logger.Error("health check failed", "error", err)
			}
		}

		JSON(w, httpStatus, map[string]string{
			"status":   status,
			"database": dbStatus,
		})
	})

	// API v1
	r.Route("/v1", func(r chi.Router) {
		// Ingestion (write key auth)
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(cfg.Keystore))
			r.Use(auth.RequireKeyType(domain.KeyTypeWrite))
			r.Use(ratelimit.Middleware(cfg.RateLimiter, extractAPIKey))
			r.Post("/ingest", cfg.Ingestion.HandleIngest)
		})

		// Query API (secret key auth)
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(cfg.Keystore))
			r.Use(auth.RequireKeyType(domain.KeyTypeSecret))
			r.Get("/query/events", cfg.Query.HandleEvents)
			r.Get("/query/events/timeseries", cfg.Query.HandleTimeseries)
			r.Get("/query/events/top", cfg.Query.HandleTopEvents)
			r.Get("/query/events/names", cfg.Query.HandleEventNames)
			r.Get("/query/funnel", cfg.Query.HandleFunnel)
			r.Get("/query/sessions", cfg.Query.HandleSessions)
			r.Get("/query/retention", cfg.Query.HandleRetention)
			r.Get("/query/stats", cfg.Query.HandleStats)
			r.Get("/query/geo", cfg.Query.HandleGeo)
			r.Get("/query/live", cfg.Query.HandleLive)
		})

		// Project management (secret key auth for existing, no auth for creation)
		r.Post("/projects", handleCreateProject(cfg.Projects, cfg.Logger))

		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(cfg.Keystore))
			r.Use(auth.RequireKeyType(domain.KeyTypeSecret))
			r.Get("/projects/{id}/keys", handleGetKeys(cfg.Projects, cfg.Logger))
		})
	})

	return r
}

func extractAPIKey(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	return ""
}

func handleCreateProject(projects storage.ProjectRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if req.Name == "" {
			Error(w, http.StatusBadRequest, "name is required")
			return
		}

		project := &domain.Project{
			ID:        uuid.New().String(),
			Name:      req.Name,
			WriteKey:  "rk_" + uuid.New().String(),
			SecretKey: "sk_" + uuid.New().String(),
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		}

		if err := projects.Create(r.Context(), project); err != nil {
			logger.Error("failed to create project", "error", err)
			Error(w, http.StatusInternalServerError, "failed to create project")
			return
		}

		JSON(w, http.StatusCreated, project)
	}
}

func handleGetKeys(projects storage.ProjectRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		project, err := projects.FindByID(r.Context(), id)
		if err != nil {
			logger.Error("failed to find project", "error", err)
			Error(w, http.StatusNotFound, "project not found")
			return
		}

		// Rotate keys
		newWriteKey := "rk_" + uuid.New().String()
		newSecretKey := "sk_" + uuid.New().String()
		if err := projects.RotateKeys(r.Context(), project.ID, newWriteKey, newSecretKey); err != nil {
			logger.Error("failed to rotate keys", "error", err)
			Error(w, http.StatusInternalServerError, "failed to rotate keys")
			return
		}

		JSON(w, http.StatusOK, map[string]string{
			"write_key":  newWriteKey,
			"secret_key": newSecretKey,
		})
	}
}
