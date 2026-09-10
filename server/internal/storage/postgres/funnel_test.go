package postgres

import (
	"strings"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

func funnelParams(steps []string, window time.Duration, filters ...storage.DimensionFilter) storage.FunnelParams {
	return storage.FunnelParams{
		ProjectID: "project-1",
		Steps:     steps,
		From:      time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		To:        time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC),
		Window:    window,
		Filters:   filters,
	}
}

func TestBuildFunnelQueryOrdersSteps(t *testing.T) {
	sql, _ := buildFunnelQuery(funnelParams([]string{"a", "b", "c"}, time.Hour))

	// Every step after the first must chain off the previous step's people.
	for _, want := range []string{
		"WITH s1 AS",
		", s2 AS",
		", s3 AS",
		"FROM s1 p",
		"FROM s2 p",
		"e.client_ts >= p.ts",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("expected generated SQL to contain %q:\n%s", want, sql)
		}
	}
}

func TestBuildFunnelQueryWindow(t *testing.T) {
	windowed, args := buildFunnelQuery(funnelParams([]string{"a", "b"}, 24*time.Hour))
	if !strings.Contains(windowed, "p.first_ts +") {
		t.Errorf("expected the window to be measured from the first step:\n%s", windowed)
	}
	if !containsArg(args, "86400 seconds") {
		t.Errorf("expected the window to be bound as an interval, got %v", args)
	}

	unbounded, args := buildFunnelQuery(funnelParams([]string{"a", "b"}, 0))
	if strings.Contains(unbounded, "::interval") {
		t.Errorf("expected no window clause when unbounded:\n%s", unbounded)
	}
	if containsArg(args, "86400 seconds") {
		t.Error("an unbounded funnel must not bind a window")
	}
	if !strings.Contains(unbounded, "e.client_ts >= p.ts") {
		t.Error("an unbounded funnel must still enforce step order")
	}
}

// TestBuildFunnelQueryBindsEverything is the injection guard: no caller-supplied
// text may appear in the SQL itself, only as a bound parameter.
func TestBuildFunnelQueryBindsEverything(t *testing.T) {
	dimension, err := storage.ParseDimension("properties.plan")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	// Values are deliberately distinctive so a match cannot come from an
	// unrelated substring of the generated SQL.
	sql, args := buildFunnelQuery(funnelParams(
		[]string{"signup_start", "signup_done"}, time.Hour,
		storage.DimensionFilter{Dimension: dimension, Value: "pro_tier"},
	))

	for _, value := range []string{"signup_start", "signup_done", "project-1", "plan", "pro_tier"} {
		if strings.Contains(sql, value) {
			t.Errorf("value %q was interpolated into SQL instead of bound:\n%s", value, sql)
		}
		if !containsArg(args, value) {
			t.Errorf("expected %q to be bound as a parameter, got %v", value, args)
		}
	}
}

func TestBuildFunnelQueryFiltersEveryStep(t *testing.T) {
	dimension, err := storage.ParseDimension("platform")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	sql, _ := buildFunnelQuery(funnelParams(
		[]string{"a", "b", "c"}, 0,
		storage.DimensionFilter{Dimension: dimension, Value: "ios"},
	))

	// A segment filter that only applied to the first step would inflate later
	// steps with people outside the segment.
	if got := strings.Count(sql, "->>"); got != 3 {
		t.Errorf("expected the filter on all 3 steps, found %d applications:\n%s", got, sql)
	}
}

func TestBuildFunnelQueryRepeatedEventNeedsLaterOccurrence(t *testing.T) {
	// a -> a means "did it twice", so the second step needs a strictly later
	// event. Reusing >= would let the same row satisfy both steps.
	repeated, _ := buildFunnelQuery(funnelParams([]string{"a", "a"}, 0))
	if !strings.Contains(repeated, "e.client_ts > p.ts") {
		t.Errorf("expected a strict comparison for a repeated event:\n%s", repeated)
	}

	// Distinct events keep >= so events emitted in the same millisecond convert.
	distinct, _ := buildFunnelQuery(funnelParams([]string{"a", "b"}, 0))
	if !strings.Contains(distinct, "e.client_ts >= p.ts") {
		t.Errorf("expected an inclusive comparison for distinct events:\n%s", distinct)
	}
}

func TestBuildFunnelQuerySelectsEveryStep(t *testing.T) {
	sql, _ := buildFunnelQuery(funnelParams([]string{"a", "b", "c"}, 0))

	if got := strings.Count(sql, "UNION ALL"); got != 2 {
		t.Errorf("expected 2 UNION ALL for 3 steps, got %d:\n%s", got, sql)
	}
	if !strings.Contains(sql, "ORDER BY step_index") {
		t.Error("expected results to come back in step order")
	}
	if !strings.Contains(sql, "percentile_cont(0.5)") {
		t.Error("expected the median time between steps to be measured")
	}
}

func containsArg(args []any, want string) bool {
	for _, arg := range args {
		if s, ok := arg.(string); ok && s == want {
			return true
		}
	}
	return false
}
