// Package ratelimit provides token bucket rate limiting.
package ratelimit

// Store defines the interface for rate limit state storage.
// In-memory implementation is used for v1; Redis adapter can be added later.
type Store interface {
	// Allow checks if the given key has capacity for one more request.
	// Returns true if allowed, false if rate limited.
	Allow(key string) bool
}
