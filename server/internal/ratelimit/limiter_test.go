package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTokenBucket_AllowsWithinLimit(t *testing.T) {
	tb := NewTokenBucket(60) // 60 RPM = 1 per second

	for i := 0; i < 60; i++ {
		if !tb.Allow("key1") {
			t.Errorf("request %d should be allowed", i+1)
		}
	}
}

func TestTokenBucket_RejectsOverLimit(t *testing.T) {
	tb := NewTokenBucket(10) // 10 RPM, burst of 10

	// Exhaust the bucket
	for i := 0; i < 10; i++ {
		tb.Allow("key1")
	}

	// Next request should be rejected
	if tb.Allow("key1") {
		t.Error("expected request to be rate limited")
	}
}

func TestTokenBucket_SeparateKeys(t *testing.T) {
	tb := NewTokenBucket(1)

	if !tb.Allow("key1") {
		t.Error("key1 should be allowed")
	}
	if !tb.Allow("key2") {
		t.Error("key2 should be allowed (separate bucket)")
	}
}

func TestMiddleware_RateLimited(t *testing.T) {
	tb := NewTokenBucket(1) // 1 RPM

	handler := Middleware(tb, func(r *http.Request) string {
		return "test-key"
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request succeeds
	req := httptest.NewRequest("POST", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	// Second request rate limited
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", rec.Code)
	}

	if rec.Header().Get("Retry-After") == "" {
		t.Error("expected Retry-After header")
	}
}

func TestMiddleware_NoKey(t *testing.T) {
	tb := NewTokenBucket(1)

	called := false
	handler := Middleware(tb, func(r *http.Request) string {
		return "" // no key
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("handler should be called when no key")
	}
}
