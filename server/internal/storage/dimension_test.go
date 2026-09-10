package storage

import (
	"strings"
	"testing"
)

func TestParseDimensionBuiltins(t *testing.T) {
	tests := []struct {
		key        string
		wantColumn string
		wantPath   []string
	}{
		{"platform", "context", []string{"device", "os"}},
		{"app_version", "context", []string{"app", "version"}},
		{"country", "geo", []string{"country"}},
		{"locale", "context", []string{"locale"}},
		{"event", "event", nil},
	}

	for _, tt := range tests {
		dim, err := ParseDimension(tt.key)
		if err != nil {
			t.Errorf("%s: unexpected error: %v", tt.key, err)
			continue
		}
		if dim.Key != tt.key {
			t.Errorf("%s: expected the key to be preserved, got %q", tt.key, dim.Key)
		}
		if dim.Column != tt.wantColumn {
			t.Errorf("%s: expected column %q, got %q", tt.key, tt.wantColumn, dim.Column)
		}
		if strings.Join(dim.Path, ".") != strings.Join(tt.wantPath, ".") {
			t.Errorf("%s: expected path %v, got %v", tt.key, tt.wantPath, dim.Path)
		}
	}
}

func TestParseDimensionExplicitPaths(t *testing.T) {
	dim, err := ParseDimension("properties.plan")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Column != "properties" || len(dim.Path) != 1 || dim.Path[0] != "plan" {
		t.Errorf("expected properties->plan, got column=%q path=%v", dim.Column, dim.Path)
	}

	nested, err := ParseDimension("context.device.model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if nested.Column != "context" || len(nested.Path) != 2 {
		t.Errorf("expected a two-level context path, got column=%q path=%v", nested.Column, nested.Path)
	}
}

// TestParseDimensionRejectsUnsafeKeys is the injection guard. Dimension keys are
// the only caller-supplied text that reaches a SQL expression position, so
// anything that is not a plain path segment must be refused outright.
func TestParseDimensionRejectsUnsafeKeys(t *testing.T) {
	unsafe := []string{
		"",
		"unknown_key",
		"properties",                              // no path segment
		"events.password",                         // not a JSON column
		"users.password",                          // not a JSON column
		"properties.a.b.c",                        // deeper than the limit
		"properties.plan' OR '1'='1",              // quote break-out
		"properties.plan; DROP TABLE events; --",  // statement injection
		"properties.plan)::text, (SELECT version", // expression break-out
		"properties.pl an",                        // whitespace
		"properties.",                             // empty segment
		"properties.->>",                          // operator characters
	}

	for _, key := range unsafe {
		if _, err := ParseDimension(key); err == nil {
			t.Errorf("expected %q to be rejected", key)
		}
	}
}

func TestParseDimensionRejectsOverlongSegments(t *testing.T) {
	if _, err := ParseDimension("properties." + strings.Repeat("a", 65)); err == nil {
		t.Error("expected an overlong path segment to be rejected")
	}
	if _, err := ParseDimension("properties." + strings.Repeat("a", 64)); err != nil {
		t.Errorf("a 64-character segment is within the limit: %v", err)
	}
}

func TestParseFilters(t *testing.T) {
	filters, err := ParseFilters([]string{"platform:ios", "properties.plan:pro"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(filters) != 2 {
		t.Fatalf("expected 2 filters, got %d", len(filters))
	}
	if filters[0].Dimension.Key != "platform" || filters[0].Value != "ios" {
		t.Errorf("unexpected first filter: %+v", filters[0])
	}
}

func TestParseFiltersSplitsOnFirstColonOnly(t *testing.T) {
	// Values legitimately contain colons — timezones and URLs, for instance.
	filters, err := ParseFilters([]string{"timezone:Europe:Berlin"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if filters[0].Value != "Europe:Berlin" {
		t.Errorf("expected the value to keep its colon, got %q", filters[0].Value)
	}
}

func TestParseFiltersRejectsBadInput(t *testing.T) {
	if _, err := ParseFilters([]string{"platform"}); err == nil {
		t.Error("expected a filter without a colon to be rejected")
	}
	if _, err := ParseFilters([]string{"nonsense:value"}); err == nil {
		t.Error("expected an unknown dimension to be rejected")
	}

	tooMany := make([]string, MaxFilters+1)
	for i := range tooMany {
		tooMany[i] = "platform:ios"
	}
	if _, err := ParseFilters(tooMany); err == nil {
		t.Error("expected too many filters to be rejected")
	}
}

func TestParseFiltersSkipsBlankEntries(t *testing.T) {
	filters, err := ParseFilters([]string{"", "platform:ios", "  "})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(filters) != 1 {
		t.Errorf("expected blank entries to be skipped, got %d filters", len(filters))
	}
}

func TestBuiltinDimensionsAreSortedAndKeyed(t *testing.T) {
	dims := BuiltinDimensions()
	if len(dims) == 0 {
		t.Fatal("expected built-in dimensions")
	}

	for i, dim := range dims {
		if dim.Key == "" || dim.Label == "" {
			t.Errorf("dimension %d is missing a key or label: %+v", i, dim)
		}
		if i > 0 && dims[i-1].Key >= dim.Key {
			t.Errorf("expected dimensions sorted by key, got %q before %q", dims[i-1].Key, dim.Key)
		}
	}
}
