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

	// QueryFunnel computes conversion through an ordered sequence of event steps.
	QueryFunnel(ctx context.Context, params FunnelParams) ([]FunnelStep, error)

	// QuerySessions retrieves session data for a user.
	QuerySessions(ctx context.Context, projectID string, userID string) ([]Session, error)

	// QueryRetention computes retention cohorts.
	QueryRetention(ctx context.Context, projectID string, from, to time.Time) ([]RetentionCohort, error)

	// QueryStats returns aggregated overview metrics.
	QueryStats(ctx context.Context, params QueryParams) (*StatsOverview, error)

	// QueryTimeseries returns event counts bucketed by time interval.
	QueryTimeseries(ctx context.Context, params QueryParams, interval string) ([]TimeseriesPoint, error)

	// QueryTopEvents returns the top N events by count.
	QueryTopEvents(ctx context.Context, params QueryParams, limit int) ([]TopEvent, error)

	// QueryEventNames returns distinct event names for a project.
	QueryEventNames(ctx context.Context, projectID string) ([]string, error)

	// QueryGeo returns event counts grouped by country or city.
	QueryGeo(ctx context.Context, params QueryParams, groupBy string) ([]GeoData, error)

	// QueryBreakdown groups events by a dimension, ranked by volume.
	QueryBreakdown(ctx context.Context, params BreakdownParams) ([]BreakdownBucket, error)

	// QueryPropertyKeys returns the custom property names seen on a project's
	// events, so the dashboard can offer them as breakdown dimensions.
	QueryPropertyKeys(ctx context.Context, projectID string, from, to time.Time) ([]string, error)

	// QueryActiveUsers returns daily, weekly and monthly active people per day.
	QueryActiveUsers(ctx context.Context, params QueryParams) ([]ActiveUsersPoint, error)

	// QueryRevenue aggregates revenue, paying people and the derived per-user
	// averages for a range.
	QueryRevenue(ctx context.Context, params RevenueParams) (*RevenueSummary, error)

	// QueryCohortRevenue reports cumulative revenue per acquired person for
	// each cohort, which is how a monetisation change shows up as a number.
	QueryCohortRevenue(ctx context.Context, params CohortRevenueParams) (*CohortRevenueReport, error)

	// LinkIdentities records anonymous-to-user mappings so a person's pre-login
	// events are attributed to them.
	LinkIdentities(ctx context.Context, links []IdentityLink) error

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
	Filters   []DimensionFilter
}

// QueryParams are the parameters shared by the aggregate query endpoints.
type QueryParams struct {
	ProjectID string
	From      time.Time
	To        time.Time
	// Event narrows the query to a single event name when set.
	Event   string
	Filters []DimensionFilter
}

// MaxFunnelSteps caps how many steps a single funnel query may contain.
const MaxFunnelSteps = 10

// FunnelParams describes an ordered funnel query.
type FunnelParams struct {
	ProjectID string
	Steps     []string
	From      time.Time
	To        time.Time
	// Window is how long a person has to complete the whole funnel, measured
	// from their first step. Zero means the From/To range is the only bound.
	Window time.Duration
	// Filters narrow every step to a segment, e.g. only Android users.
	Filters []DimensionFilter
}

// FunnelStep is one step of a funnel result.
type FunnelStep struct {
	Step  string `json:"step"`
	Count int    `json:"count"`
	// ConversionRate is the percentage of the first step's people who reached here.
	ConversionRate float64 `json:"conversion_rate"`
	// StepConversionRate is the percentage of the *previous* step's people who
	// continued to this step.
	StepConversionRate float64 `json:"step_conversion_rate"`
	// Dropped is how many people were lost between the previous step and this one.
	Dropped int `json:"dropped"`
	// MedianSecondsFromPrev is the median time people took to get here from the
	// previous step. Nil on the first step and when nobody converted.
	MedianSecondsFromPrev *float64 `json:"median_seconds_from_prev,omitempty"`
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

// RevenueParams describes a revenue query.
type RevenueParams struct {
	QueryParams
	// Currency selects which currency to report on. Empty means "pick the one
	// with the most revenue in range" — totals across currencies would be
	// meaningless without exchange rates.
	Currency string
	// Interval buckets the timeseries: minute, hour or day.
	Interval string
}

// RevenuePoint is the revenue booked in one time bucket.
type RevenuePoint struct {
	Bucket       string  `json:"bucket"`
	Revenue      float64 `json:"revenue"`
	Transactions int     `json:"transactions"`
	PayingUsers  int     `json:"paying_users"`
}

// RevenueSummary aggregates what a project earned in a range.
type RevenueSummary struct {
	// Currency the figures below are denominated in. Empty means the events did
	// not state one.
	Currency string `json:"currency"`
	// AvailableCurrencies lists every currency with revenue in range, so a
	// project reporting in several can tell the total covers only one of them.
	AvailableCurrencies []string `json:"available_currencies"`

	TotalRevenue float64 `json:"total_revenue"`
	Transactions int     `json:"transactions"`
	// PayingUsers is how many distinct people spent anything.
	PayingUsers int `json:"paying_users"`
	// ActiveUsers is everyone seen in range, paying or not — the denominator
	// that makes ARPU meaningful.
	ActiveUsers int `json:"active_users"`

	// ARPU is revenue per active person; ARPPU is revenue per *paying* person.
	// The gap between them is the size of the free-to-paid opportunity.
	ARPU              float64 `json:"arpu"`
	ARPPU             float64 `json:"arppu"`
	AverageOrderValue float64 `json:"average_order_value"`
	// PayingShare is the percentage of active people who paid.
	PayingShare float64 `json:"paying_share"`

	Timeseries []RevenuePoint `json:"timeseries"`

	// Previous holds the same figures for the window immediately before this
	// one, present only when the caller asked to compare.
	Previous *RevenueTotals `json:"previous,omitempty"`
}

// RevenueTotals is the comparable subset of a revenue summary, in the same
// currency as the summary carrying it.
type RevenueTotals struct {
	TotalRevenue      float64 `json:"total_revenue"`
	Transactions      int     `json:"transactions"`
	PayingUsers       int     `json:"paying_users"`
	ActiveUsers       int     `json:"active_users"`
	ARPU              float64 `json:"arpu"`
	ARPPU             float64 `json:"arppu"`
	AverageOrderValue float64 `json:"average_order_value"`
	PayingShare       float64 `json:"paying_share"`
}

// CohortRevenueParams describes a cohort lifetime-value query.
type CohortRevenueParams struct {
	ProjectID string
	// From and To select which cohorts are reported, by the date each cohort
	// was acquired — not by when its revenue arrived. A cohort's earnings are
	// followed for as long as there is data, which is the whole point.
	From     time.Time
	To       time.Time
	Interval string // "week" or "month"
	// Currency to report in. Empty picks the one with the most revenue, the
	// same rule the revenue summary uses.
	Currency string
}

// CohortAges are the ages, in days since acquisition, that a cohort report
// measures cumulative revenue at.
//
// Day 0 catches whatever people spend immediately; day 30 is where a change to
// pricing or onboarding usually becomes visible.
var CohortAges = []int{0, 7, 14, 30, 60, 90}

// CohortRevenue is one acquisition cohort and what it has earned since.
type CohortRevenue struct {
	// Cohort is the ISO date the cohort's interval starts on.
	Cohort string `json:"cohort"`
	// People is how many were acquired in that interval.
	People int `json:"people"`
	// PerPerson is cumulative revenue per acquired person at each of
	// CohortAges. A nil entry means the cohort has not reached that age yet,
	// which is different from having earned nothing — showing zero there would
	// make every recent cohort look like a failure.
	PerPerson []*float64 `json:"per_person"`
	// Total is everything the cohort has earned so far, per person.
	Total float64 `json:"total_per_person"`
}

// CohortRevenueReport answers whether the people you acquire are becoming more
// or less valuable over time.
//
// Retention says whether they come back and the revenue summary says what they
// spent in a window. Neither says whether June's signups are worth more than
// May's, which is the question a change to pricing or onboarding is trying to
// move.
type CohortRevenueReport struct {
	Currency            string          `json:"currency"`
	AvailableCurrencies []string        `json:"available_currencies"`
	Ages                []int           `json:"ages"`
	Interval            string          `json:"interval"`
	Cohorts             []CohortRevenue `json:"cohorts"`
}

// IdentityLink maps an anonymous ID to the user it turned out to belong to.
type IdentityLink struct {
	ProjectID   string
	AnonymousID string
	UserID      string
}

// ActiveUsersPoint holds the active-people counts for one day.
type ActiveUsersPoint struct {
	Bucket string `json:"bucket"` // ISO date
	// DAU is people active on this day.
	DAU int `json:"dau"`
	// WAU is people active in the 7 days ending on this day.
	WAU int `json:"wau"`
	// MAU is people active in the 30 days ending on this day.
	MAU int `json:"mau"`
	// Stickiness is DAU as a percentage of MAU — how much of the monthly
	// audience shows up on a given day.
	Stickiness float64 `json:"stickiness"`
}

// StatsOverview contains aggregated dashboard metrics.
type StatsOverview struct {
	TotalEvents     int     `json:"total_events"`
	UniqueUsers     int     `json:"unique_users"`
	ActiveSessions  int     `json:"active_sessions"`
	EventsPerMinute float64 `json:"events_per_minute"`
	TopCountry      string  `json:"top_country"`
	// Revenue booked in the same range, in TopCurrency.
	Revenue     float64 `json:"revenue"`
	TopCurrency string  `json:"top_currency"`

	// Previous holds the same totals for the window immediately before this
	// one, and is only present when the caller asked to compare. A number on
	// its own says what is; the pair says whether it is moving, which is the
	// difference between reading a dashboard and deciding something from it.
	Previous *StatsTotals `json:"previous,omitempty"`
}

// StatsTotals is the comparable subset of an overview.
//
// Active sessions and events-per-minute are deliberately absent: both describe
// the last half hour, and "the half hour before the previous period" is not a
// question anyone is asking.
type StatsTotals struct {
	TotalEvents int     `json:"total_events"`
	UniqueUsers int     `json:"unique_users"`
	Revenue     float64 `json:"revenue"`
}

// TimeseriesPoint represents a single time bucket with its counts.
type TimeseriesPoint struct {
	Bucket      string `json:"bucket"` // ISO 8601 timestamp
	Count       int    `json:"count"`
	UniqueUsers int    `json:"unique_users"`
}

// TopEvent represents an event name with its totals.
type TopEvent struct {
	Event       string `json:"event"`
	Count       int    `json:"count"`
	UniqueUsers int    `json:"unique_users"`
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
