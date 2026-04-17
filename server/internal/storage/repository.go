// Package storage defines interfaces for data persistence.
package storage

import (
	"context"
	"encoding/json"
	"time"

	"github.com/bananalytics/server/internal/domain"
)

// EventRepository defines operations for event persistence.
type EventRepository interface {
	// InsertBatch inserts a batch of events, deduplicating on (project_id, message_id).
	// Returns the number of events actually inserted.
	InsertBatch(ctx context.Context, events []domain.Event) (int, error)

	// QueryEvents retrieves events matching the given filters.
	QueryEvents(ctx context.Context, filter EventFilter) ([]domain.Event, error)

	// QueryFunnel computes funnel conversion rates for a sequence of event steps.
	QueryFunnel(ctx context.Context, projectID string, steps []string, from, to time.Time) ([]FunnelStep, error)

	// QuerySessions retrieves session data for a user.
	QuerySessions(ctx context.Context, projectID string, userID string) ([]Session, error)

	// QueryRetention computes retention cohorts.
	QueryRetention(ctx context.Context, projectID string, from, to time.Time) ([]RetentionCohort, error)

	// QueryStats returns aggregated overview metrics.
	QueryStats(ctx context.Context, projectID string, from, to time.Time) (*StatsOverview, error)

	// QueryTimeseries returns event counts bucketed by time interval.
	QueryTimeseries(ctx context.Context, projectID string, from, to time.Time, interval string, event string) ([]TimeseriesPoint, error)

	// QueryTopEvents returns the top N events by count.
	QueryTopEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]TopEvent, error)

	// QueryEventNames returns distinct event names for a project.
	QueryEventNames(ctx context.Context, projectID string) ([]string, error)

	// QueryGeo returns event counts grouped by country or city.
	QueryGeo(ctx context.Context, projectID string, from, to time.Time, groupBy string) ([]GeoData, error)

	// QueryLive returns real-time activity data.
	QueryLive(ctx context.Context, projectID string) (*LiveData, error)
}

// ProjectRepository defines operations for project persistence.
type ProjectRepository interface {
	// Create creates a new project.
	Create(ctx context.Context, project *domain.Project) error

	// FindByWriteKey looks up a project by its write key (plaintext — legacy).
	FindByWriteKey(ctx context.Context, writeKey string) (*domain.Project, error)

	// FindBySecretKey looks up a project by its secret key (plaintext — legacy).
	FindBySecretKey(ctx context.Context, secretKey string) (*domain.Project, error)

	// FindByWriteKeyPrefix looks up projects matching the key prefix, returns hash for verification.
	FindByWriteKeyPrefix(ctx context.Context, prefix string) ([]ProjectWithHash, error)

	// FindBySecretKeyPrefix looks up projects matching the key prefix, returns hash for verification.
	FindBySecretKeyPrefix(ctx context.Context, prefix string) ([]ProjectWithHash, error)

	// FindByID looks up a project by its ID.
	FindByID(ctx context.Context, id string) (*domain.Project, error)

	// RotateKeys regenerates the write and secret keys for a project.
	RotateKeys(ctx context.Context, id string, newWriteKey, newSecretKey string) error
}

// ProjectWithHash is a project with its key hash for verification.
type ProjectWithHash struct {
	Project domain.Project
	KeyHash string
}

// UserRepository defines operations for user persistence.
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	FindByID(ctx context.Context, id string) (*domain.User, error)
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	Count(ctx context.Context) (int, error)
}

// SessionRepository defines operations for user session persistence.
type SessionRepository interface {
	Create(ctx context.Context, session *domain.Session) error
	FindByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error)
	DeleteByTokenHash(ctx context.Context, tokenHash string) error
	DeleteExpired(ctx context.Context) (int, error)
}

// ProjectMemberRepository links users to projects.
type ProjectMemberRepository interface {
	AddMember(ctx context.Context, userID, projectID, role string) error
	ListUserProjects(ctx context.Context, userID string) ([]domain.Project, error)
	IsMember(ctx context.Context, userID, projectID string) (bool, string, error) // returns isMember, role, error
}

// EventFilter defines parameters for querying events.
type EventFilter struct {
	ProjectID string
	Event     string
	UserID    string
	From      time.Time
	To        time.Time
	Limit     int
	Offset    int
}

// FunnelStep represents a single step in a funnel analysis.
type FunnelStep struct {
	Step  string `json:"step"`
	Count int    `json:"count"`
}

// Session represents a user session.
type Session struct {
	SessionID string    `json:"session_id"`
	UserID    *string   `json:"user_id"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	EventCount int      `json:"event_count"`
}

// EventResult is a simplified event representation for query responses.
type EventResult struct {
	ID          string          `json:"id"`
	Event       string          `json:"event"`
	Type        string          `json:"type"`
	Properties  json.RawMessage `json:"properties"`
	UserID      *string         `json:"user_id"`
	AnonymousID string          `json:"anonymous_id"`
	Timestamp   time.Time       `json:"timestamp"`
	SessionID   string          `json:"session_id"`
}

// RetentionCohort represents a cohort for retention analysis.
type RetentionCohort struct {
	Cohort     string `json:"cohort"`      // e.g., "2025-01-06"
	CohortSize int    `json:"cohort_size"`
	Period     int    `json:"period"`       // days since cohort start
	Retained   int    `json:"retained"`
}

// StatsOverview contains aggregated dashboard metrics.
type StatsOverview struct {
	TotalEvents     int     `json:"total_events"`
	UniqueUsers     int     `json:"unique_users"`
	ActiveSessions  int     `json:"active_sessions"`
	EventsPerMinute float64 `json:"events_per_minute"`
	TopCountry      string  `json:"top_country"`
}

// TimeseriesPoint represents a single time bucket with event count.
type TimeseriesPoint struct {
	Bucket string `json:"bucket"` // ISO 8601 timestamp
	Count  int    `json:"count"`
}

// TopEvent represents an event name with its total count.
type TopEvent struct {
	Event string `json:"event"`
	Count int    `json:"count"`
}

// GeoData represents analytics data grouped by geographic location.
type GeoData struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	City        string  `json:"city,omitempty"`
	Count       int     `json:"count"`
	UniqueUsers int     `json:"unique_users"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
}

// LiveData represents real-time activity snapshot.
type LiveData struct {
	ActiveUsers     int           `json:"active_users"`
	EventsLastMinute int          `json:"events_last_minute"`
	RecentEvents    []EventResult `json:"recent_events"`
}
