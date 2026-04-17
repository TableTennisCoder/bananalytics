// Package query handles analytics query endpoints.
package query

import (
	"context"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// Service encapsulates analytics query logic.
type Service struct {
	events storage.EventRepository
}

// NewService creates a new query service.
func NewService(events storage.EventRepository) *Service {
	return &Service{events: events}
}

// GetEvents retrieves events with the given filter.
func (s *Service) GetEvents(ctx context.Context, filter storage.EventFilter) ([]storage.EventResult, error) {
	events, err := s.events.QueryEvents(ctx, filter)
	if err != nil {
		return nil, err
	}

	results := make([]storage.EventResult, 0, len(events))
	for _, e := range events {
		results = append(results, storage.EventResult{
			ID:          e.ID,
			Event:       e.EventName,
			Type:        e.Type,
			Properties:  e.Properties,
			UserID:      e.UserID,
			AnonymousID: e.AnonymousID,
			Timestamp:   e.ClientTS,
			SessionID:   e.SessionID,
		})
	}
	return results, nil
}

// GetFunnel computes funnel analysis.
func (s *Service) GetFunnel(ctx context.Context, projectID string, steps []string, from, to time.Time) ([]storage.FunnelStep, error) {
	return s.events.QueryFunnel(ctx, projectID, steps, from, to)
}

// GetSessions retrieves sessions for a user.
func (s *Service) GetSessions(ctx context.Context, projectID, userID string) ([]storage.Session, error) {
	return s.events.QuerySessions(ctx, projectID, userID)
}

// GetRetention computes retention cohorts.
func (s *Service) GetRetention(ctx context.Context, projectID string, from, to time.Time) ([]storage.RetentionCohort, error) {
	return s.events.QueryRetention(ctx, projectID, from, to)
}

// GetStats returns aggregated overview metrics.
func (s *Service) GetStats(ctx context.Context, projectID string, from, to time.Time) (*storage.StatsOverview, error) {
	return s.events.QueryStats(ctx, projectID, from, to)
}

// GetTimeseries returns event counts bucketed by time interval.
func (s *Service) GetTimeseries(ctx context.Context, projectID string, from, to time.Time, interval string, event string) ([]storage.TimeseriesPoint, error) {
	return s.events.QueryTimeseries(ctx, projectID, from, to, interval, event)
}

// GetTopEvents returns the top N events by count.
func (s *Service) GetTopEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]storage.TopEvent, error) {
	return s.events.QueryTopEvents(ctx, projectID, from, to, limit)
}

// GetEventNames returns distinct event names.
func (s *Service) GetEventNames(ctx context.Context, projectID string) ([]string, error) {
	return s.events.QueryEventNames(ctx, projectID)
}

// GetGeo returns geographic analytics data.
func (s *Service) GetGeo(ctx context.Context, projectID string, from, to time.Time, groupBy string) ([]storage.GeoData, error) {
	return s.events.QueryGeo(ctx, projectID, from, to, groupBy)
}

// GetLive returns real-time activity data.
func (s *Service) GetLive(ctx context.Context, projectID string) (*storage.LiveData, error) {
	return s.events.QueryLive(ctx, projectID)
}
