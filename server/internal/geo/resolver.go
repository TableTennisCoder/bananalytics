// Package geo provides IP-to-location resolution using MaxMind GeoLite2.
package geo

import (
	"log/slog"
	"net"

	"github.com/oschwald/maxminddb-golang"

	"github.com/rochade-analytics/server/internal/domain"
)

// Resolver looks up geographic location from IP addresses.
type Resolver struct {
	db     *maxminddb.Reader
	logger *slog.Logger
}

// maxmindRecord matches the GeoLite2-City database schema.
type maxmindRecord struct {
	Country struct {
		ISOCode string            `maxminddb:"iso_code"`
		Names   map[string]string `maxminddb:"names"`
	} `maxminddb:"country"`
	City struct {
		Names map[string]string `maxminddb:"names"`
	} `maxminddb:"city"`
	Location struct {
		Latitude  float64 `maxminddb:"latitude"`
		Longitude float64 `maxminddb:"longitude"`
	} `maxminddb:"location"`
}

// NewResolver creates a GeoIP resolver from a MaxMind .mmdb file.
// Returns nil (no-op resolver) if the file path is empty or cannot be opened.
func NewResolver(dbPath string, logger *slog.Logger) *Resolver {
	if dbPath == "" {
		logger.Info("GeoIP disabled — no ROCHADE_GEOIP_DB path configured")
		return nil
	}

	db, err := maxminddb.Open(dbPath)
	if err != nil {
		logger.Error("failed to open GeoIP database, geo-location disabled", "path", dbPath, "error", err)
		return nil
	}

	logger.Info("GeoIP database loaded", "path", dbPath)
	return &Resolver{db: db, logger: logger}
}

// Lookup resolves an IP address to geographic location.
// Returns nil if the IP cannot be resolved (private IP, invalid, etc.).
func (r *Resolver) Lookup(ipStr string) *domain.GeoInfo {
	if r == nil || r.db == nil {
		return nil
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return nil
	}

	// Skip private/local IPs
	if ip.IsPrivate() || ip.IsLoopback() || ip.IsUnspecified() {
		return nil
	}

	var record maxmindRecord
	err := r.db.Lookup(ip, &record)
	if err != nil {
		r.logger.Debug("GeoIP lookup failed", "ip", ipStr, "error", err)
		return nil
	}

	country := record.Country.Names["en"]
	if country == "" {
		return nil
	}

	return &domain.GeoInfo{
		Country:     country,
		CountryCode: record.Country.ISOCode,
		City:        record.City.Names["en"],
		Lat:         record.Location.Latitude,
		Lng:         record.Location.Longitude,
	}
}

// Close closes the MaxMind database.
func (r *Resolver) Close() {
	if r != nil && r.db != nil {
		r.db.Close()
	}
}
