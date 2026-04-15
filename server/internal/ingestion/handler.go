package ingestion

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/rochade-analytics/server/internal/auth"
	"github.com/rochade-analytics/server/internal/domain"
	"github.com/rochade-analytics/server/internal/storage"
)

// Handler handles the POST /v1/ingest endpoint.
type Handler struct {
	events   storage.EventRepository
	enricher *Enricher
	logger   *slog.Logger
}

// NewHandler creates a new ingestion handler.
func NewHandler(events storage.EventRepository, enricher *Enricher, logger *slog.Logger) *Handler {
	return &Handler{
		events:   events,
		enricher: enricher,
		logger:   logger,
	}
}

// HandleIngest processes incoming event batches.
func (h *Handler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	project := auth.ProjectFromContext(r.Context())
	if project == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing project context"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, int64(domain.MaxRequestBodySize)+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
		return
	}
	if len(body) > domain.MaxRequestBodySize {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body exceeds 5MB limit"})
		return
	}

	var req domain.IngestRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
		return
	}

	valid, validationErrors := ValidateBatch(req.Batch)

	if len(validationErrors) > 0 && len(valid) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":   "validation_failed",
			"details": validationErrors,
		})
		return
	}

	// Extract client IP for GeoIP enrichment
	clientIP := extractClientIP(r)
	for i := range valid {
		h.enricher.Enrich(&valid[i], project.ID, clientIP)
	}

	accepted, err := h.events.InsertBatch(r.Context(), valid)
	if err != nil {
		h.logger.Error("failed to insert events", "error", err, "project_id", project.ID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to store events"})
		return
	}

	resp := domain.IngestResponse{
		Success:  true,
		Accepted: accepted,
		Rejected: len(req.Batch) - accepted,
	}
	if len(validationErrors) > 0 {
		resp.Errors = validationErrors
	}

	writeJSON(w, http.StatusOK, resp)
}

func extractClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
