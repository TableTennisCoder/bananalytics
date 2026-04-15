// Package domain defines core business types and errors.
package domain

import "fmt"

// ErrValidation indicates a request validation failure.
type ErrValidation struct {
	Field   string
	Message string
}

func (e *ErrValidation) Error() string {
	return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

// ErrNotFound indicates a requested resource was not found.
type ErrNotFound struct {
	Resource string
	ID       string
}

func (e *ErrNotFound) Error() string {
	return fmt.Sprintf("%s not found: %s", e.Resource, e.ID)
}

// ErrUnauthorized indicates an authentication failure.
type ErrUnauthorized struct {
	Reason string
}

func (e *ErrUnauthorized) Error() string {
	return fmt.Sprintf("unauthorized: %s", e.Reason)
}

// ErrRateLimited indicates the client has exceeded rate limits.
type ErrRateLimited struct {
	RetryAfter int // seconds
}

func (e *ErrRateLimited) Error() string {
	return fmt.Sprintf("rate limited, retry after %d seconds", e.RetryAfter)
}
