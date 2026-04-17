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

	"github.com/bananalytics/server/internal/auth"
	"github.com/bananalytics/server/internal/domain"
	"github.com/bananalytics/server/internal/ingestion"
	"github.com/bananalytics/server/internal/query"
	"github.com/bananalytics/server/internal/ratelimit"
	"github.com/bananalytics/server/internal/storage"
	"github.com/bananalytics/server/internal/userauth"
)

// HealthChecker can verify database connectivity.
type HealthChecker interface {
	Ping(ctx context.Context) error
}

// RouterConfig holds dependencies for setting up the HTTP router.
type RouterConfig struct {
	Logger               *slog.Logger
	Keystore             *auth.Keystore
	RateLimiter          *ratelimit.TokenBucket // per API key
	IPRateLimiter        *ratelimit.TokenBucket // per client IP (global)
	ProjectCreateLimiter *ratelimit.TokenBucket // strict limiter for setup/login (auth)
	Ingestion            *ingestion.Handler
	Query                *query.Handler
	Projects             storage.ProjectRepository
	Members              storage.ProjectMemberRepository
	Users                storage.UserRepository
	Sessions             storage.SessionRepository
	UserAuth             *userauth.Handlers
	CORSOrigins          string
	DB                   HealthChecker // for /health endpoint
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

		// User auth (no auth required, but setup/login are IP rate-limited extra strict)
		r.Group(func(r chi.Router) {
			if cfg.ProjectCreateLimiter != nil {
				r.Use(ratelimit.IPMiddleware(cfg.ProjectCreateLimiter))
			}
			r.Get("/auth/status", cfg.UserAuth.HandleStatus)
			r.Post("/auth/setup", cfg.UserAuth.HandleSetup)
			r.Post("/auth/login", cfg.UserAuth.HandleLogin)
		})

		// Authenticated user endpoints (require valid session)
		r.Group(func(r chi.Router) {
			r.Use(userauth.RequireUser(cfg.Users, cfg.Sessions))
			r.Post("/auth/logout", cfg.UserAuth.HandleLogout)
			r.Get("/auth/me", cfg.UserAuth.HandleMe)

			// Project management (requires authenticated user)
			r.Post("/projects", handleCreateProject(cfg.Projects, cfg.Members, cfg.Logger))
			r.Get("/projects", handleListProjects(cfg.Members, cfg.Logger))
			r.Get("/projects/{id}", handleGetProject(cfg.Projects, cfg.Members, cfg.Logger))
			r.Post("/projects/{id}/keys/rotate", handleRotateKeys(cfg.Projects, cfg.Members, cfg.Logger))
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

// handleCreateProject creates a new project owned by the authenticated user.
func handleCreateProject(projects storage.ProjectRepository, members storage.ProjectMemberRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := userauth.UserFromContext(r.Context())
		if user == nil {
			Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if strings.TrimSpace(req.Name) == "" {
			Error(w, http.StatusBadRequest, "name is required")
			return
		}

		project := &domain.Project{
			ID:        uuid.New().String(),
			Name:      strings.TrimSpace(req.Name),
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

		// Link the creator as project owner
		if err := members.AddMember(r.Context(), user.ID, project.ID, "owner"); err != nil {
			logger.Error("failed to add project member", "error", err, "user_id", user.ID, "project_id", project.ID)
			Error(w, http.StatusInternalServerError, "failed to assign ownership")
			return
		}

		JSON(w, http.StatusCreated, project)
	}
}

// handleListProjects returns all projects the authenticated user is a member of.
func handleListProjects(members storage.ProjectMemberRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := userauth.UserFromContext(r.Context())
		if user == nil {
			Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		projects, err := members.ListUserProjects(r.Context(), user.ID)
		if err != nil {
			logger.Error("failed to list user projects", "error", err)
			Error(w, http.StatusInternalServerError, "failed to list projects")
			return
		}
		if projects == nil {
			projects = []domain.Project{}
		}

		JSON(w, http.StatusOK, map[string]any{"projects": projects})
	}
}

// handleGetProject returns a single project (only if user is a member).
func handleGetProject(projects storage.ProjectRepository, members storage.ProjectMemberRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := userauth.UserFromContext(r.Context())
		if user == nil {
			Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		id := chi.URLParam(r, "id")

		isMember, _, err := members.IsMember(r.Context(), user.ID, id)
		if err != nil {
			logger.Error("failed to check membership", "error", err)
			Error(w, http.StatusInternalServerError, "failed to verify access")
			return
		}
		if !isMember {
			Error(w, http.StatusForbidden, "not a member of this project")
			return
		}

		project, err := projects.FindByID(r.Context(), id)
		if err != nil {
			Error(w, http.StatusNotFound, "project not found")
			return
		}

		JSON(w, http.StatusOK, project)
	}
}

// handleRotateKeys rotates the API keys for a project. The authenticated user
// must be a member of the project.
func handleRotateKeys(projects storage.ProjectRepository, members storage.ProjectMemberRepository, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := userauth.UserFromContext(r.Context())
		if user == nil {
			Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		id := chi.URLParam(r, "id")

		isMember, role, err := members.IsMember(r.Context(), user.ID, id)
		if err != nil {
			logger.Error("failed to check membership", "error", err)
			Error(w, http.StatusInternalServerError, "failed to verify access")
			return
		}
		if !isMember {
			Error(w, http.StatusForbidden, "not a member of this project")
			return
		}
		if role != "owner" {
			Error(w, http.StatusForbidden, "only owners can rotate keys")
			return
		}

		newWriteKey := "rk_" + uuid.New().String()
		newSecretKey := "sk_" + uuid.New().String()
		if err := projects.RotateKeys(r.Context(), id, newWriteKey, newSecretKey); err != nil {
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
