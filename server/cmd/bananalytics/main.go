package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	apiPkg "github.com/bananalytics/server/internal/api"
	"github.com/bananalytics/server/internal/auth"
	"github.com/bananalytics/server/internal/config"
	"github.com/bananalytics/server/internal/geo"
	"github.com/bananalytics/server/internal/ingestion"
	"github.com/bananalytics/server/internal/query"
	"github.com/bananalytics/server/internal/ratelimit"
	"github.com/bananalytics/server/internal/storage/postgres"
	"github.com/bananalytics/server/internal/storage/postgres/partitions"
	"github.com/bananalytics/server/internal/userauth"
	"github.com/bananalytics/server/pkg/clock"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Set log level
	var logLevel slog.Level
	switch cfg.LogLevel {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))

	// Connect to database with tuned pool settings
	ctx := context.Background()
	poolConfig, err := pgxpool.ParseConfig(cfg.DBDSN)
	if err != nil {
		logger.Error("failed to parse database DSN", "error", err)
		os.Exit(1)
	}
	poolConfig.MaxConns = cfg.DBMaxConns
	poolConfig.MinConns = cfg.DBMinConns
	poolConfig.MaxConnLifetime = cfg.DBMaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.DBMaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	logger.Info("database pool configured",
		"max_conns", cfg.DBMaxConns,
		"min_conns", cfg.DBMinConns,
	)

	if err := pool.Ping(ctx); err != nil {
		logger.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	logger.Info("connected to database")

	// Run database migrations automatically.
	// Embedded SQL files under internal/storage/postgres/migrations/ are applied
	// in order. Already-applied migrations are skipped (tracked in schema_migrations table).
	// Server refuses to start if migrations fail — never run on a half-migrated DB.
	if err := postgres.RunMigrations(cfg.DBDSN, logger); err != nil {
		logger.Error("failed to run database migrations", "error", err)
		os.Exit(1)
	}

	// Auto-create partitions (3 months ahead, checks daily)
	partitionMgr := partitions.NewManager(pool, logger)
	partitionMgr.StartAutoCreation(ctx)

	// Initialize stores
	eventStore := postgres.NewEventStore(pool)
	projectStore := postgres.NewProjectStore(pool)
	userStore := postgres.NewUserStore(pool)
	sessionStore := postgres.NewSessionStore(pool)
	memberStore := postgres.NewProjectMemberStore(pool)

	// Initialize GeoIP resolver
	geoResolver := geo.NewResolver(cfg.GeoIPDBPath, logger)
	if geoResolver != nil {
		defer geoResolver.Close()
	}

	// Initialize services
	clk := clock.Real{}
	keystore := auth.NewKeystore(projectStore)
	rateLimiter := ratelimit.NewTokenBucket(cfg.RateLimitRPM)
	ipRateLimiter := ratelimit.NewTokenBucket(cfg.IPRateLimitRPM)
	authRateLimiter := ratelimit.NewTokenBucket(cfg.ProjectCreateRPM)
	enricher := ingestion.NewEnricher(clk, geoResolver)
	ingestionHandler := ingestion.NewHandler(eventStore, enricher, logger)
	queryService := query.NewService(eventStore)
	queryHandler := query.NewHandler(queryService, logger)

	// User auth handlers — secure flag is on in production (HTTPS)
	secureCookies := cfg.CORSOrigins != "*"
	userAuthHandlers := userauth.NewHandlers(userStore, sessionStore, logger, secureCookies)

	// Set up router
	router := apiPkg.NewRouter(apiPkg.RouterConfig{
		Logger:               logger,
		Keystore:             keystore,
		RateLimiter:          rateLimiter,
		IPRateLimiter:        ipRateLimiter,
		ProjectCreateLimiter: authRateLimiter,
		Ingestion:            ingestionHandler,
		Query:                queryHandler,
		Projects:             projectStore,
		Members:              memberStore,
		Users:                userStore,
		Sessions:             sessionStore,
		UserAuth:             userAuthHandlers,
		CORSOrigins:          cfg.CORSOrigins,
		DB:                   pool,
	})

	// Warn if CORS is wide open
	if cfg.CORSOrigins == "*" {
		logger.Warn("CORS is set to '*' — restrict BANANA_CORS_ORIGINS in production")
	}

	// Start server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info("server starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	logger.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("server shutdown failed", "error", err)
		os.Exit(1)
	}

	logger.Info("server stopped")
}
