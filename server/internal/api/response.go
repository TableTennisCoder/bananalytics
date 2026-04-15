// Package api provides HTTP routing and shared middleware.
package api

import (
	"encoding/json"
	"net/http"
)

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
	}
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

// ErrorWithDetails writes a JSON error response with additional details.
func ErrorWithDetails(w http.ResponseWriter, status int, message string, details []string) {
	JSON(w, status, map[string]any{
		"error":   message,
		"details": details,
	})
}
