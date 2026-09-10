package query

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/bananalytics/server/internal/auth"
	"github.com/bananalytics/server/internal/storage"
)

const (
	// defaultFunnelWindow is how long people get to complete a funnel when the
	// caller does not specify a window.
	defaultFunnelWindow = 7 * 24 * time.Hour
	maxFunnelWindow     = 90 * 24 * time.Hour
	// defaultRangeLength bounds queries that arrive without a start date, so a
	// missing parameter never turns into a scan across every partition.
	defaultRangeLength = 30 * 24 * time.Hour
	// maxFunnelSegments caps how many segments a broken-down funnel compares,
	// since each one costs a full funnel query.
	maxFunnelSegments = 8
	// maxActiveUsersRange bounds the DAU/WAU/MAU query, which produces one row
	// per day and scans a month of extra history for the rolling windows.
	maxActiveUsersRange = 365 * 24 * time.Hour
)

// currencyCode matches an ISO 4217 alphabetic code.
var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)

// Handler handles query API endpoints.
type Handler struct {
	service *Service
	logger  *slog.Logger
}

// NewHandler creates a new query handler.
func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

// project resolves the authenticated project, writing a 401 when absent.
func project(w http.ResponseWriter, r *http.Request) (string, bool) {
	p := auth.ProjectFromContext(r.Context())
	if p == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return "", false
	}
	return p.ID, true
}

// queryParams builds the parameters shared by the aggregate endpoints: time
// range, an optional single-event narrowing, and any dimension filters.
func queryParams(r *http.Request, projectID string) (storage.QueryParams, error) {
	from, to, err := parseTimeRange(r)
	if err != nil {
		return storage.QueryParams{}, err
	}

	filters, err := storage.ParseFilters(r.URL.Query()["filter"])
	if err != nil {
		return storage.QueryParams{}, &parseError{err.Error()}
	}

	return storage.QueryParams{
		ProjectID: projectID,
		From:      from,
		To:        to,
		Event:     r.URL.Query().Get("event"),
		Filters:   filters,
	}, nil
}

// HandleEvents handles GET /v1/query/events
func (h *Handler) HandleEvents(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	filter := storage.EventFilter{
		ProjectID: projectID,
		Event:     params.Event,
		UserID:    r.URL.Query().Get("user_id"),
		From:      params.From,
		To:        params.To,
		Filters:   params.Filters,
	}

	if limit := r.URL.Query().Get("limit"); limit != "" {
		l, err := strconv.Atoi(limit)
		if err != nil || l < 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'limit': must be a positive integer"})
			return
		}
		filter.Limit = l
	}

	if offset := r.URL.Query().Get("offset"); offset != "" {
		o, err := strconv.Atoi(offset)
		if err != nil || o < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'offset': must be a non-negative integer"})
			return
		}
		filter.Offset = o
	}

	events, err := h.service.GetEvents(r.Context(), filter)
	if err != nil {
		h.logger.Error("failed to query events", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query events"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

// HandleFunnel handles GET /v1/query/funnel
func (h *Handler) HandleFunnel(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	steps := splitSteps(r.URL.Query().Get("steps"))
	if len(steps) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "'steps' requires at least 2 comma-separated event names"})
		return
	}
	if len(steps) > storage.MaxFunnelSteps {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("'steps' must not exceed %d entries", storage.MaxFunnelSteps),
		})
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	window, err := parseWindow(r.URL.Query().Get("window"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	funnelParams := storage.FunnelParams{
		ProjectID: projectID,
		Steps:     steps,
		From:      params.From,
		To:        params.To,
		Window:    window,
		Filters:   params.Filters,
	}

	response := map[string]any{"window_seconds": int64(window.Seconds())}

	// A breakdown runs the same funnel once per segment so they can be compared.
	if key := r.URL.Query().Get("breakdown"); key != "" {
		dimension, err := storage.ParseDimension(key)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		segments, err := h.service.GetSegmentedFunnel(r.Context(), funnelParams, dimension, maxFunnelSegments)
		if err != nil {
			h.logger.Error("failed to query segmented funnel", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query funnel"})
			return
		}
		response["breakdown"] = dimension.Key
		response["segments"] = segments
	}

	result, err := h.service.GetFunnel(r.Context(), funnelParams)
	if err != nil {
		h.logger.Error("failed to query funnel", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query funnel"})
		return
	}
	response["funnel"] = result

	writeJSON(w, http.StatusOK, response)
}

// HandleBreakdown handles GET /v1/query/breakdown — ranking events by any
// dimension, which is how an aggregate number turns into an explanation.
func (h *Handler) HandleBreakdown(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	dimension, err := storage.ParseDimension(r.URL.Query().Get("key"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	limit := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}

	buckets, err := h.service.GetBreakdown(r.Context(), storage.BreakdownParams{
		ProjectID: projectID,
		Dimension: dimension,
		Event:     params.Event,
		From:      params.From,
		To:        params.To,
		Filters:   params.Filters,
		Limit:     limit,
	})
	if err != nil {
		h.logger.Error("failed to query breakdown", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query breakdown"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"key":       dimension.Key,
		"label":     dimension.Label,
		"breakdown": buckets,
	})
}

// HandleDimensions handles GET /v1/query/dimensions — everything the dashboard
// can break down or filter by, including custom event properties in use.
func (h *Handler) HandleDimensions(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	from, to = defaultRange(from, to)

	dimensions, err := h.service.GetDimensions(r.Context(), projectID, from, to)
	if err != nil {
		h.logger.Error("failed to query dimensions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query dimensions"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"dimensions": dimensions})
}

// HandleSessions handles GET /v1/query/sessions
func (h *Handler) HandleSessions(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "'user_id' parameter is required"})
		return
	}

	sessions, err := h.service.GetSessions(r.Context(), projectID, userID)
	if err != nil {
		h.logger.Error("failed to query sessions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query sessions"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

// HandleRetention handles GET /v1/query/retention
func (h *Handler) HandleRetention(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	from, to = defaultRange(from, to)

	cohorts, err := h.service.GetRetention(r.Context(), projectID, from, to)
	if err != nil {
		h.logger.Error("failed to query retention", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query retention"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"retention": cohorts})
}

// HandleStats handles GET /v1/query/stats
func (h *Handler) HandleStats(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultToday(params.From, params.To)

	stats, err := h.service.GetStats(r.Context(), params)
	if err != nil {
		h.logger.Error("failed to query stats", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query stats"})
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

// HandleTimeseries handles GET /v1/query/events/timeseries
func (h *Handler) HandleTimeseries(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "hour"
	}
	if !map[string]bool{"minute": true, "hour": true, "day": true}[interval] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "interval must be: minute, hour, or day"})
		return
	}

	points, err := h.service.GetTimeseries(r.Context(), params, interval)
	if err != nil {
		h.logger.Error("failed to query timeseries", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query timeseries"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"timeseries": points})
}

// HandleTopEvents handles GET /v1/query/events/top
func (h *Handler) HandleTopEvents(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)
	// The event narrowing belongs to per-event queries; a ranking of all events
	// would otherwise collapse to a single row.
	params.Event = ""

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	events, err := h.service.GetTopEvents(r.Context(), params, limit)
	if err != nil {
		h.logger.Error("failed to query top events", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query top events"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

// HandleEventNames handles GET /v1/query/events/names
func (h *Handler) HandleEventNames(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	names, err := h.service.GetEventNames(r.Context(), projectID)
	if err != nil {
		h.logger.Error("failed to query event names", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query event names"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"names": names})
}

// HandleGeo handles GET /v1/query/geo
func (h *Handler) HandleGeo(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	groupBy := r.URL.Query().Get("group_by")
	if groupBy == "" {
		groupBy = "country"
	}

	data, err := h.service.GetGeo(r.Context(), params, groupBy)
	if err != nil {
		h.logger.Error("failed to query geo", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query geo"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"geo": data})
}

// HandleActiveUsers handles GET /v1/query/active-users — the DAU/WAU/MAU curve.
func (h *Handler) HandleActiveUsers(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	if params.To.Sub(params.From) > maxActiveUsersRange {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "range must not exceed 365 days",
		})
		return
	}

	points, err := h.service.GetActiveUsers(r.Context(), params)
	if err != nil {
		h.logger.Error("failed to query active users", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query active users"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"active_users": points})
}

// HandleRevenue handles GET /v1/query/revenue.
func (h *Handler) HandleRevenue(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	params, err := queryParams(r, projectID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	params.From, params.To = defaultRange(params.From, params.To)

	currency := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("currency")))
	if currency != "" && !currencyCode.MatchString(currency) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid 'currency': expected a three-letter ISO 4217 code",
		})
		return
	}

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "day"
	}
	if !map[string]bool{"minute": true, "hour": true, "day": true}[interval] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "interval must be: minute, hour, or day"})
		return
	}

	summary, err := h.service.GetRevenue(r.Context(), storage.RevenueParams{
		QueryParams: params,
		Currency:    currency,
		Interval:    interval,
	})
	if err != nil {
		h.logger.Error("failed to query revenue", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query revenue"})
		return
	}

	writeJSON(w, http.StatusOK, summary)
}

// HandleLive handles GET /v1/query/live
func (h *Handler) HandleLive(w http.ResponseWriter, r *http.Request) {
	projectID, ok := project(w, r)
	if !ok {
		return
	}

	live, err := h.service.GetLive(r.Context(), projectID)
	if err != nil {
		h.logger.Error("failed to query live data", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query live data"})
		return
	}

	writeJSON(w, http.StatusOK, live)
}

// splitSteps parses the comma-separated steps parameter, dropping blank entries.
func splitSteps(raw string) []string {
	parts := strings.Split(raw, ",")
	steps := make([]string, 0, len(parts))
	for _, part := range parts {
		if step := strings.TrimSpace(part); step != "" {
			steps = append(steps, step)
		}
	}
	return steps
}

// parseWindow parses a conversion window such as "30m", "24h", "7d" or "2w".
// An empty value means defaultFunnelWindow; "none" removes the window so that
// only the queried time range bounds the funnel.
func parseWindow(raw string) (time.Duration, error) {
	raw = strings.ToLower(strings.TrimSpace(raw))
	switch raw {
	case "":
		return defaultFunnelWindow, nil
	case "none", "0":
		return 0, nil
	}

	invalid := &parseError{"invalid 'window': use a value like 30m, 24h, 7d, 2w or none"}

	value, err := strconv.Atoi(raw[:len(raw)-1])
	if err != nil || value <= 0 {
		return 0, invalid
	}

	var unit time.Duration
	switch raw[len(raw)-1] {
	case 'm':
		unit = time.Minute
	case 'h':
		unit = time.Hour
	case 'd':
		unit = 24 * time.Hour
	case 'w':
		unit = 7 * 24 * time.Hour
	default:
		return 0, invalid
	}

	window := time.Duration(value) * unit
	if window > maxFunnelWindow {
		return 0, &parseError{"'window' must not exceed 90d"}
	}
	return window, nil
}

// defaultRange fills in a missing start or end so every query stays bounded.
func defaultRange(from, to time.Time) (time.Time, time.Time) {
	if to.IsZero() {
		to = time.Now().UTC()
	}
	if from.IsZero() {
		from = to.Add(-defaultRangeLength)
	}
	return from, to
}

// defaultToday bounds a query to the current day when no range was given.
func defaultToday(from, to time.Time) (time.Time, time.Time) {
	if to.IsZero() {
		to = time.Now().UTC()
	}
	if from.IsZero() {
		from = time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)
	}
	return from, to
}

func parseTimeRange(r *http.Request) (time.Time, time.Time, error) {
	var from, to time.Time

	if f := r.URL.Query().Get("from"); f != "" {
		t, err := time.Parse(time.RFC3339, f)
		if err != nil {
			return from, to, &parseError{"invalid 'from' timestamp: use RFC3339 format"}
		}
		from = t
	}

	if t := r.URL.Query().Get("to"); t != "" {
		parsed, err := time.Parse(time.RFC3339, t)
		if err != nil {
			return from, to, &parseError{"invalid 'to' timestamp: use RFC3339 format"}
		}
		to = parsed
	}

	return from, to, nil
}

type parseError struct {
	message string
}

func (e *parseError) Error() string { return e.message }

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
