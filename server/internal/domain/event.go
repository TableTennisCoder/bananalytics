package domain

import (
	"encoding/json"
	"fmt"
	"regexp"
	"time"
	"unicode/utf8"
)

const (
	MaxEventNameLength   = 256
	MaxPropertyKeyLength = 256
	MaxPropertyValueSize = 8192  // 8KB
	MaxPropertiesCount   = 256
	MaxBatchSize         = 500
	MaxRequestBodySize   = 5 * 1024 * 1024 // 5MB
	MaxJSONDepth         = 10   // max nesting depth for properties/context
	MaxContextSize       = 32768 // 32KB max context size
)

var eventNameRegex = regexp.MustCompile(`^[\w$]+$`)

// GeoInfo holds geographic location data resolved from client IP.
type GeoInfo struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
}

// Event represents a single analytics event.
type Event struct {
	ID          string          `json:"id,omitempty"`
	ProjectID   string          `json:"project_id,omitempty"`
	MessageID   string          `json:"messageId"`
	EventName   string          `json:"event"`
	Type        string          `json:"type"`
	Properties  json.RawMessage `json:"properties"`
	Context     json.RawMessage `json:"context"`
	UserID      *string         `json:"userId"`
	AnonymousID string          `json:"anonymousId"`
	ClientTS    time.Time       `json:"timestamp"`
	ServerTS    time.Time       `json:"server_ts,omitempty"`
	SessionID   string          `json:"session_id,omitempty"`
	Geo         *GeoInfo        `json:"geo,omitempty"`
	CreatedAt   time.Time       `json:"created_at,omitempty"`
}

// IngestRequest is the request body for the ingestion endpoint.
type IngestRequest struct {
	Batch []Event `json:"batch"`
}

// IngestResponse is the response body for the ingestion endpoint.
type IngestResponse struct {
	Success  bool     `json:"success"`
	Accepted int      `json:"accepted"`
	Rejected int      `json:"rejected,omitempty"`
	Errors   []string `json:"errors,omitempty"`
}

// Validate checks that the event meets all validation requirements.
func (e *Event) Validate() error {
	if e.EventName == "" {
		return &ErrValidation{Field: "event", Message: "event name is required"}
	}
	if utf8.RuneCountInString(e.EventName) > MaxEventNameLength {
		return &ErrValidation{
			Field:   "event",
			Message: fmt.Sprintf("event name exceeds %d character limit: got %d", MaxEventNameLength, utf8.RuneCountInString(e.EventName)),
		}
	}
	if !eventNameRegex.MatchString(e.EventName) {
		return &ErrValidation{
			Field:   "event",
			Message: "event name must contain only alphanumeric characters, underscores, and dollar signs",
		}
	}

	validTypes := map[string]bool{"track": true, "screen": true, "identify": true}
	if !validTypes[e.Type] {
		return &ErrValidation{
			Field:   "type",
			Message: fmt.Sprintf("type must be one of: track, screen, identify; got %q", e.Type),
		}
	}

	if e.AnonymousID == "" {
		return &ErrValidation{Field: "anonymousId", Message: "anonymousId is required"}
	}

	if e.MessageID == "" {
		return &ErrValidation{Field: "messageId", Message: "messageId is required"}
	}

	if e.ClientTS.IsZero() {
		return &ErrValidation{Field: "timestamp", Message: "timestamp is required"}
	}

	if err := validateProperties(e.Properties); err != nil {
		return err
	}

	// Validate context size
	if len(e.Context) > MaxContextSize {
		return &ErrValidation{
			Field:   "context",
			Message: fmt.Sprintf("context exceeds %d byte limit: got %d", MaxContextSize, len(e.Context)),
		}
	}

	// Validate JSON depth for properties
	if len(e.Properties) > 0 && string(e.Properties) != "null" && string(e.Properties) != "{}" {
		if err := checkJSONDepth(e.Properties, "properties"); err != nil {
			return err
		}
	}

	// Validate JSON depth for context
	if len(e.Context) > 0 && string(e.Context) != "null" && string(e.Context) != "{}" {
		if err := checkJSONDepth(e.Context, "context"); err != nil {
			return err
		}
	}

	return nil
}

// checkJSONDepth verifies that JSON nesting does not exceed MaxJSONDepth.
func checkJSONDepth(raw json.RawMessage, field string) error {
	var depth int
	for _, b := range raw {
		switch b {
		case '{', '[':
			depth++
			if depth > MaxJSONDepth {
				return &ErrValidation{
					Field:   field,
					Message: fmt.Sprintf("JSON nesting exceeds maximum depth of %d", MaxJSONDepth),
				}
			}
		case '}', ']':
			depth--
		}
	}
	return nil
}

func validateProperties(raw json.RawMessage) error {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return nil
	}

	var props map[string]json.RawMessage
	if err := json.Unmarshal(raw, &props); err != nil {
		return &ErrValidation{Field: "properties", Message: "properties must be a JSON object"}
	}

	if len(props) > MaxPropertiesCount {
		return &ErrValidation{
			Field:   "properties",
			Message: fmt.Sprintf("too many properties: got %d, max %d", len(props), MaxPropertiesCount),
		}
	}

	for key, val := range props {
		if utf8.RuneCountInString(key) > MaxPropertyKeyLength {
			return &ErrValidation{
				Field:   "properties",
				Message: fmt.Sprintf("property key %q exceeds %d character limit", key, MaxPropertyKeyLength),
			}
		}
		if len(val) > MaxPropertyValueSize {
			return &ErrValidation{
				Field:   "properties",
				Message: fmt.Sprintf("property value for key %q exceeds %d byte limit: got %d", key, MaxPropertyValueSize, len(val)),
			}
		}
	}

	return nil
}
