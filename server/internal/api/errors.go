package api

import "net/http"

// ErrorCode is a machine-readable error identifier.
type ErrorCode string

const (
	ErrCodeBadRequest      ErrorCode = "BAD_REQUEST"
	ErrCodeUnauthorized    ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden       ErrorCode = "FORBIDDEN"
	ErrCodeNotFound        ErrorCode = "NOT_FOUND"
	ErrCodeValidation      ErrorCode = "VALIDATION_FAILED"
	ErrCodeRateLimited     ErrorCode = "RATE_LIMITED"
	ErrCodePayloadTooLarge ErrorCode = "PAYLOAD_TOO_LARGE"
	ErrCodeInternal        ErrorCode = "INTERNAL_ERROR"
)

// APIError is a structured error response returned to clients.
type APIError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details []string  `json:"details,omitempty"`
}

// ErrorResponse writes a structured error with the appropriate HTTP status.
func ErrorResponse(w http.ResponseWriter, code ErrorCode, message string, details ...string) {
	status := statusForCode(code)
	resp := APIError{
		Code:    code,
		Message: message,
	}
	if len(details) > 0 {
		resp.Details = details
	}
	JSON(w, status, resp)
}

func statusForCode(code ErrorCode) int {
	switch code {
	case ErrCodeBadRequest, ErrCodeValidation:
		return http.StatusBadRequest
	case ErrCodeUnauthorized:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeNotFound:
		return http.StatusNotFound
	case ErrCodeRateLimited:
		return http.StatusTooManyRequests
	case ErrCodePayloadTooLarge:
		return http.StatusRequestEntityTooLarge
	default:
		return http.StatusInternalServerError
	}
}
