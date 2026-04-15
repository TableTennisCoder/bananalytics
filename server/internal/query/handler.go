package query

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/storage"
)

// Handler handles query API endpoints.
type Handler struct {
	service *Service
	logger  *slog.Logger
}

// NewHandler creates a new query handler.
func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

// HandleEvents handles GET /v1/query/events
func (h *Handler) HandleEvents(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	filter := storage.EventFilter{
		ProjectID: project.ID,
		Event:     r.URL.Query().Get("event"),
		UserID:    r.URL.Query().Get("user_id"),
	}

	if from := r.URL.Query().Get("from"); from != "" {
		t, err := time.Parse(time.RFC3339, from)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'from' timestamp: use RFC3339 format"})
			return
		}
		filter.From = t
	}

	if to := r.URL.Query().Get("to"); to != "" {
		t, err := time.Parse(time.RFC3339, to)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'to' timestamp: use RFC3339 format"})
			return
		}
		filter.To = t
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
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	stepsParam := r.URL.Query().Get("steps")
	if stepsParam == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "'steps' parameter is required (comma-separated event names)"})
		return
	}
	steps := strings.Split(stepsParam, ",")

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	result, err := h.service.GetFunnel(r.Context(), project.ID, steps, from, to)
	if err != nil {
		h.logger.Error("failed to query funnel", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query funnel"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"funnel": result})
}

// HandleSessions handles GET /v1/query/sessions
func (h *Handler) HandleSessions(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "'user_id' parameter is required"})
		return
	}

	sessions, err := h.service.GetSessions(r.Context(), project.ID, userID)
	if err != nil {
		h.logger.Error("failed to query sessions", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query sessions"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

// HandleRetention handles GET /v1/query/retention
func (h *Handler) HandleRetention(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	cohorts, err := h.service.GetRetention(r.Context(), project.ID, from, to)
	if err != nil {
		h.logger.Error("failed to query retention", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query retention"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"retention": cohorts})
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

// HandleStats handles GET /v1/query/stats
func (h *Handler) HandleStats(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Default: today
	if from.IsZero() {
		now := time.Now().UTC()
		from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	}
	if to.IsZero() {
		to = time.Now().UTC()
	}

	stats, err := h.service.GetStats(r.Context(), project.ID, from, to)
	if err != nil {
		h.logger.Error("failed to query stats", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query stats"})
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

// HandleTimeseries handles GET /v1/query/events/timeseries
func (h *Handler) HandleTimeseries(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "hour"
	}
	validIntervals := map[string]bool{"minute": true, "hour": true, "day": true}
	if !validIntervals[interval] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "interval must be: minute, hour, or day"})
		return
	}

	event := r.URL.Query().Get("event")

	points, err := h.service.GetTimeseries(r.Context(), project.ID, from, to, interval, event)
	if err != nil {
		h.logger.Error("failed to query timeseries", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query timeseries"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"timeseries": points})
}

// HandleTopEvents handles GET /v1/query/events/top
func (h *Handler) HandleTopEvents(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		n, err := strconv.Atoi(l)
		if err == nil && n > 0 {
			limit = n
		}
	}

	events, err := h.service.GetTopEvents(r.Context(), project.ID, from, to, limit)
	if err != nil {
		h.logger.Error("failed to query top events", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query top events"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

// HandleEventNames handles GET /v1/query/events/names
func (h *Handler) HandleEventNames(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	names, err := h.service.GetEventNames(r.Context(), project.ID)
	if err != nil {
		h.logger.Error("failed to query event names", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query event names"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"names": names})
}

// HandleGeo handles GET /v1/query/geo
func (h *Handler) HandleGeo(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	from, to, err := parseTimeRange(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	groupBy := r.URL.Query().Get("group_by")
	if groupBy == "" {
		groupBy = "country"
	}

	data, err := h.service.GetGeo(r.Context(), project.ID, from, to, groupBy)
	if err != nil {
		h.logger.Error("failed to query geo", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query geo"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"geo": data})
}

// HandleLive handles GET /v1/query/live
func (h *Handler) HandleLive(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	live, err := h.service.GetLive(r.Context(), project.ID)
	if err != nil {
		h.logger.Error("failed to query live data", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query live data"})
		return
	}

	writeJSON(w, http.StatusOK, live)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
