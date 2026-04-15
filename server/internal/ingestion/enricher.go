// Package ingestion handles event ingestion from the SDK.
package ingestion

import (
	"encoding/json"
	"time"

	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/geo"
	"github.com/rochade-analytics/server/pkg/clock"
)

// Enricher adds server-side data to events.
type Enricher struct {
	clock clock.Clock
	geo   *geo.Resolver
}

// NewEnricher creates a new Enricher.
func NewEnricher(c clock.Clock, geoResolver *geo.Resolver) *Enricher {
	return &Enricher{clock: c, geo: geoResolver}
}

// Enrich adds server timestamp, session ID, and geo data to the event.
func (e *Enricher) Enrich(event *domain.Event, projectID string, clientIP string) {
	event.ProjectID = projectID
	event.ServerTS = e.clock.Now().UTC().Truncate(time.Microsecond)

	if event.SessionID == "" {
		event.SessionID = extractSessionID(event.Context)
	}

	// GeoIP lookup from client IP
	if e.geo != nil && event.Geo == nil {
		event.Geo = e.geo.Lookup(clientIP)
	}
}

func extractSessionID(contextJSON json.RawMessage) string {
	if len(contextJSON) == 0 {
		return ""
	}

	var ctx struct {
		Session struct {
			ID string `json:"id"`
		} `json:"session"`
	}
	if err := json.Unmarshal(contextJSON, &ctx); err != nil {
		return ""
	}
	return ctx.Session.ID
}
