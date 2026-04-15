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

	apiPkg "github.com/rochade-analytics/server/internal/api"
	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/config"
	"github.com/rochade-analytics/server/internal/geo"
	"github.com/rochade-analytics/server/internal/ingestion"
	"github.com/rochade-analytics/server/internal/query"
	"github.com/rochade-analytics/server/internal/ratelimit"
	"github.com/rochade-analytics/server/internal/storage/postgres"
	"github.com/rochade-analytics/server/internal/storage/postgres/partitions"
	"github.com/rochade-analytics/server/pkg/clock"
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

	// Auto-create partitions (3 months ahead, checks daily)
	partitionMgr := partitions.NewManager(pool, logger)
	partitionMgr.StartAutoCreation(ctx)

	// Initialize stores
	eventStore := postgres.NewEventStore(pool)
	projectStore := postgres.NewProjectStore(pool)

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
	enricher := ingestion.NewEnricher(clk, geoResolver)
	ingestionHandler := ingestion.NewHandler(eventStore, enricher, logger)
	queryService := query.NewService(eventStore)
	queryHandler := query.NewHandler(queryService, logger)

	// Set up router
	router := apiPkg.NewRouter(apiPkg.RouterConfig{
		Logger:        logger,
		Keystore:      keystore,
		RateLimiter:   rateLimiter,
		IPRateLimiter: ipRateLimiter,
		Ingestion:     ingestionHandler,
		Query:         queryHandler,
		Projects:      projectStore,
		CORSOrigins:   cfg.CORSOrigins,
		DB:            pool,
	})

	// Warn if CORS is wide open
	if cfg.CORSOrigins == "*" {
		logger.Warn("CORS is set to '*' — restrict ROCHADE_CORS_ORIGINS in production")
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
