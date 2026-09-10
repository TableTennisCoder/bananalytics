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

// GetFunnel computes conversion through an ordered sequence of event steps.
func (s *Service) GetFunnel(ctx context.Context, params storage.FunnelParams) ([]storage.FunnelStep, error) {
	return s.events.QueryFunnel(ctx, params)
}

// GetSegmentedFunnel computes one funnel per value of a breakdown dimension, so
// segments can be compared side by side.
//
// The dimension's top values are resolved first and each segment then runs as its
// own funnel, which keeps the ordered-step semantics intact per segment.
func (s *Service) GetSegmentedFunnel(ctx context.Context, params storage.FunnelParams, dimension storage.Dimension, limit int) ([]storage.FunnelSegment, error) {
	buckets, err := s.events.QueryBreakdown(ctx, storage.BreakdownParams{
		ProjectID: params.ProjectID,
		Dimension: dimension,
		Event:     params.Steps[0],
		From:      params.From,
		To:        params.To,
		Filters:   params.Filters,
		Limit:     limit,
	})
	if err != nil {
		return nil, err
	}

	segments := make([]storage.FunnelSegment, 0, len(buckets))
	for _, bucket := range buckets {
		// "(not set)" stands for a missing value and cannot be filtered on.
		if bucket.Value == storage.NotSetValue {
			continue
		}

		segmentParams := params
		segmentParams.Filters = append(append([]storage.DimensionFilter{}, params.Filters...),
			storage.DimensionFilter{Dimension: dimension, Value: bucket.Value})

		steps, err := s.events.QueryFunnel(ctx, segmentParams)
		if err != nil {
			return nil, err
		}
		segments = append(segments, storage.FunnelSegment{Value: bucket.Value, Steps: steps})
	}
	return segments, nil
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
func (s *Service) GetStats(ctx context.Context, params storage.QueryParams) (*storage.StatsOverview, error) {
	return s.events.QueryStats(ctx, params)
}

// GetTimeseries returns event counts bucketed by time interval.
func (s *Service) GetTimeseries(ctx context.Context, params storage.QueryParams, interval string) ([]storage.TimeseriesPoint, error) {
	return s.events.QueryTimeseries(ctx, params, interval)
}

// GetTopEvents returns the top N events by count.
func (s *Service) GetTopEvents(ctx context.Context, params storage.QueryParams, limit int) ([]storage.TopEvent, error) {
	return s.events.QueryTopEvents(ctx, params, limit)
}

// GetEventNames returns distinct event names.
func (s *Service) GetEventNames(ctx context.Context, projectID string) ([]string, error) {
	return s.events.QueryEventNames(ctx, projectID)
}

// GetGeo returns geographic analytics data.
func (s *Service) GetGeo(ctx context.Context, params storage.QueryParams, groupBy string) ([]storage.GeoData, error) {
	return s.events.QueryGeo(ctx, params, groupBy)
}

// GetBreakdown groups events by a dimension.
func (s *Service) GetBreakdown(ctx context.Context, params storage.BreakdownParams) ([]storage.BreakdownBucket, error) {
	return s.events.QueryBreakdown(ctx, params)
}

// GetDimensions returns every dimension available for breakdowns and filters:
// the built-in shorthands plus the custom event properties actually in use.
func (s *Service) GetDimensions(ctx context.Context, projectID string, from, to time.Time) ([]storage.Dimension, error) {
	dimensions := storage.BuiltinDimensions()

	keys, err := s.events.QueryPropertyKeys(ctx, projectID, from, to)
	if err != nil {
		return nil, err
	}
	for _, key := range keys {
		if dim, err := storage.ParseDimension("properties." + key); err == nil {
			dimensions = append(dimensions, dim)
		}
	}
	return dimensions, nil
}

// GetActiveUsers returns the DAU/WAU/MAU curve — how many people actually use
// the app, as opposed to how many events they generate.
func (s *Service) GetActiveUsers(ctx context.Context, params storage.QueryParams) ([]storage.ActiveUsersPoint, error) {
	return s.events.QueryActiveUsers(ctx, params)
}

// GetRevenue aggregates what the project earned, plus the per-person averages
// that turn behaviour into money.
func (s *Service) GetRevenue(ctx context.Context, params storage.RevenueParams) (*storage.RevenueSummary, error) {
	return s.events.QueryRevenue(ctx, params)
}

// GetLive returns real-time activity data.
func (s *Service) GetLive(ctx context.Context, projectID string) (*storage.LiveData, error) {
	return s.events.QueryLive(ctx, projectID)
}
