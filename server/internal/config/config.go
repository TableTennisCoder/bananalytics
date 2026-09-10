// Package config handles environment-based configuration loading.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration.
type Config struct {
	Port         int
	DBDSN        string
	LogLevel     string
	RateLimitRPM int
	CORSOrigins  string

	// Connection pool settings
	DBMaxConns        int32
	DBMinConns        int32
	DBMaxConnLifetime time.Duration
	DBMaxConnIdleTime time.Duration

	// IP-based rate limit (requests per minute per IP)
	IPRateLimitRPM int

	// Stricter rate limit for sensitive unauthenticated endpoints (project creation)
	ProjectCreateRPM int

	// GeoIP database path (MaxMind GeoLite2-City.mmdb)
	GeoIPDBPath string

	// How often the daily rollups are rebuilt. This is what bounds how stale a
	// dashboard number can be: an ingested event shows up in the aggregates
	// within one interval. Real-time views read raw events and are unaffected.
	RollupInterval time.Duration

	// How many months of raw events to keep. Zero means keep them forever,
	// which is the default: a self-hosted install should never delete its
	// owner's data because of a setting they did not choose.
	//
	// When set, whole monthly partitions older than the window are dropped once
	// the rollups covering them are built. Aggregate views keep their full
	// history; cohorts, funnels, sessions and the event explorer only reach as
	// far back as the raw window.
	RawRetentionMonths int
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Port:              8080,
		LogLevel:          "info",
		RateLimitRPM:      1000,
		CORSOrigins:       "*",
		DBMaxConns:        25,
		DBMinConns:        5,
		DBMaxConnLifetime: 30 * time.Minute,
		DBMaxConnIdleTime: 5 * time.Minute,
		IPRateLimitRPM:    300,
		ProjectCreateRPM:  5, // very strict — 5 projects per minute per IP
		RollupInterval:    60 * time.Second,
	}

	if v := os.Getenv("BANANA_PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_PORT %q: %w", v, err)
		}
		cfg.Port = port
	}

	cfg.DBDSN = os.Getenv("BANANA_DB_DSN")
	if cfg.DBDSN == "" {
		return nil, fmt.Errorf("BANANA_DB_DSN is required")
	}

	if v := os.Getenv("BANANA_LOG_LEVEL"); v != "" {
		cfg.LogLevel = v
	}

	if v := os.Getenv("BANANA_RATE_LIMIT_RPM"); v != "" {
		rpm, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_RATE_LIMIT_RPM %q: %w", v, err)
		}
		cfg.RateLimitRPM = rpm
	}

	if v := os.Getenv("BANANA_CORS_ORIGINS"); v != "" {
		cfg.CORSOrigins = v
	}

	if v := os.Getenv("BANANA_DB_MAX_CONNS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_DB_MAX_CONNS %q: %w", v, err)
		}
		cfg.DBMaxConns = int32(n)
	}

	if v := os.Getenv("BANANA_DB_MIN_CONNS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_DB_MIN_CONNS %q: %w", v, err)
		}
		cfg.DBMinConns = int32(n)
	}

	cfg.GeoIPDBPath = os.Getenv("BANANA_GEOIP_DB")

	if v := os.Getenv("BANANA_IP_RATE_LIMIT_RPM"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_IP_RATE_LIMIT_RPM %q: %w", v, err)
		}
		cfg.IPRateLimitRPM = n
	}

	if v := os.Getenv("BANANA_PROJECT_CREATE_RPM"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_PROJECT_CREATE_RPM %q: %w", v, err)
		}
		cfg.ProjectCreateRPM = n
	}

	if v := os.Getenv("BANANA_RAW_RETENTION_MONTHS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_RAW_RETENTION_MONTHS %q: %w", v, err)
		}
		if n < 0 {
			return nil, fmt.Errorf("invalid BANANA_RAW_RETENTION_MONTHS %q: must not be negative", v)
		}
		// The lower bound belongs to the partitions package, which owns the
		// rule; it is checked at startup before the worker is allowed to run.
		cfg.RawRetentionMonths = n
	}

	if v := os.Getenv("BANANA_ROLLUP_INTERVAL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("invalid BANANA_ROLLUP_INTERVAL %q: %w", v, err)
		}
		if d < time.Second {
			return nil, fmt.Errorf("invalid BANANA_ROLLUP_INTERVAL %q: must be at least 1s", v)
		}
		cfg.RollupInterval = d
	}

	return cfg, nil
}
