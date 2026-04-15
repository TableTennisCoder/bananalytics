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
	Port          int
	DBDSN         string
	LogLevel      string
	RateLimitRPM  int
	CORSOrigins   string

	// Connection pool settings
	DBMaxConns        int32
	DBMinConns        int32
	DBMaxConnLifetime time.Duration
	DBMaxConnIdleTime time.Duration

	// IP-based rate limit (requests per minute per IP)
	IPRateLimitRPM int

	// GeoIP database path (MaxMind GeoLite2-City.mmdb)
	GeoIPDBPath string
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
	}

	if v := os.Getenv("ROCHADE_PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ROCHADE_PORT %q: %w", v, err)
		}
		cfg.Port = port
	}

	cfg.DBDSN = os.Getenv("ROCHADE_DB_DSN")
	if cfg.DBDSN == "" {
		return nil, fmt.Errorf("ROCHADE_DB_DSN is required")
	}

	if v := os.Getenv("ROCHADE_LOG_LEVEL"); v != "" {
		cfg.LogLevel = v
	}

	if v := os.Getenv("ROCHADE_RATE_LIMIT_RPM"); v != "" {
		rpm, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ROCHADE_RATE_LIMIT_RPM %q: %w", v, err)
		}
		cfg.RateLimitRPM = rpm
	}

	if v := os.Getenv("ROCHADE_CORS_ORIGINS"); v != "" {
		cfg.CORSOrigins = v
	}

	if v := os.Getenv("ROCHADE_DB_MAX_CONNS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ROCHADE_DB_MAX_CONNS %q: %w", v, err)
		}
		cfg.DBMaxConns = int32(n)
	}

	if v := os.Getenv("ROCHADE_DB_MIN_CONNS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ROCHADE_DB_MIN_CONNS %q: %w", v, err)
		}
		cfg.DBMinConns = int32(n)
	}

	cfg.GeoIPDBPath = os.Getenv("ROCHADE_GEOIP_DB")

	if v := os.Getenv("ROCHADE_IP_RATE_LIMIT_RPM"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid ROCHADE_IP_RATE_LIMIT_RPM %q: %w", v, err)
		}
		cfg.IPRateLimitRPM = n
	}

	return cfg, nil
}
