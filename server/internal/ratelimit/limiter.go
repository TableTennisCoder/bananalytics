package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

// TokenBucket implements a per-key token bucket rate limiter.
type TokenBucket struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64 // tokens per second
	burst   int     // max tokens (bucket capacity)
}

type bucket struct {
	tokens   float64
	lastTime time.Time
}

// NewTokenBucket creates a rate limiter that allows `rpm` requests per minute per key.
func NewTokenBucket(rpm int) *TokenBucket {
	rate := float64(rpm) / 60.0
	return &TokenBucket{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   rpm, // allow burst up to full minute's capacity
	}
}

// Allow checks if the given key has remaining capacity.
func (tb *TokenBucket) Allow(key string) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	b, exists := tb.buckets[key]
	if !exists {
		tb.buckets[key] = &bucket{
			tokens:   float64(tb.burst) - 1,
			lastTime: now,
		}
		return true
	}

	elapsed := now.Sub(b.lastTime).Seconds()
	b.tokens += elapsed * tb.rate
	if b.tokens > float64(tb.burst) {
		b.tokens = float64(tb.burst)
	}
	b.lastTime = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

// Middleware returns an HTTP middleware that rate limits by a key extracted from the request.
func Middleware(limiter *TokenBucket, keyExtractor func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyExtractor(r)
			if key == "" {
				next.ServeHTTP(w, r)
				return
			}

			if !limiter.Allow(key) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "30")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"code":"RATE_LIMITED","message":"too many requests","retryAfter":30}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IPMiddleware rate limits by client IP address.
// Applies to all requests before authentication — protects against brute force and DDoS.
func IPMiddleware(limiter *TokenBucket) func(http.Handler) http.Handler {
	return Middleware(limiter, ExtractClientIP)
}

// ExtractClientIP returns the client's IP address, respecting X-Forwarded-For
// from trusted reverse proxies (Caddy, nginx).
func ExtractClientIP(r *http.Request) string {
	// Trust X-Forwarded-For when behind a reverse proxy
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// First IP in the chain is the original client
		if idx := indexByte(xff, ','); idx != -1 {
			return trimSpace(xff[:idx])
		}
		return trimSpace(xff)
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return trimSpace(xri)
	}

	// Fall back to RemoteAddr (includes port, strip it)
	addr := r.RemoteAddr
	if idx := lastIndexByte(addr, ':'); idx != -1 {
		return addr[:idx]
	}
	return addr
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func lastIndexByte(s string, c byte) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && s[start] == ' ' {
		start++
	}
	for end > start && s[end-1] == ' ' {
		end--
	}
	return s[start:end]
}
