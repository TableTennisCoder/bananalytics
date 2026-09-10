//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

var testBase = time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)

func runFunnel(t *testing.T, db *testDB, steps []string, window time.Duration, filters ...storage.DimensionFilter) []storage.FunnelStep {
	t.Helper()

	result, err := NewEventStore(db.pool).QueryFunnel(context.Background(), storage.FunnelParams{
		ProjectID: db.projectID,
		Steps:     steps,
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
		Window:    window,
		Filters:   filters,
	})
	if err != nil {
		t.Fatalf("query funnel: %v", err)
	}
	return result
}

// TestFunnelEnforcesStepOrder is the regression test for the original bug: a
// person who only ever did the last step used to be counted in that step, which
// could make a later step larger than an earlier one.
func TestFunnelEnforcesStepOrder(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		// Converts properly through all three steps.
		{person: "alice", name: "signup_start", offset: 0},
		{person: "alice", name: "signup_complete", offset: 5 * time.Minute},
		{person: "alice", name: "purchase", offset: 20 * time.Minute},

		// Starts and completes signup, never purchases.
		{person: "bob", name: "signup_start", offset: 0},
		{person: "bob", name: "signup_complete", offset: 2 * time.Minute},

		// Purchased without ever entering the funnel — must not be counted.
		{person: "mallory", name: "purchase", offset: time.Minute},

		// Did the steps in the wrong order — must only count for step 1.
		{person: "carol", name: "signup_complete", offset: 0},
		{person: "carol", name: "signup_start", offset: 10 * time.Minute},
	})

	result := runFunnel(t, db, []string{"signup_start", "signup_complete", "purchase"}, 0)

	want := []int{3, 2, 1} // alice+bob+carol, alice+bob, alice
	for i, step := range result {
		if step.Count != want[i] {
			t.Errorf("step %d (%s): expected %d people, got %d", i+1, step.Step, want[i], step.Count)
		}
		if i > 0 && step.Count > result[i-1].Count {
			t.Errorf("step %d reports more people than step %d", i+1, i)
		}
	}
}

func TestFunnelConversionWindow(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "fast", name: "signup_start", offset: 0},
		{person: "fast", name: "signup_complete", offset: 30 * time.Minute},

		{person: "slow", name: "signup_start", offset: 0},
		{person: "slow", name: "signup_complete", offset: 5 * 24 * time.Hour},
	})

	steps := []string{"signup_start", "signup_complete"}

	if got := runFunnel(t, db, steps, 24*time.Hour)[1].Count; got != 1 {
		t.Errorf("24h window: expected only the fast converter, got %d", got)
	}
	if got := runFunnel(t, db, steps, 7*24*time.Hour)[1].Count; got != 2 {
		t.Errorf("7d window: expected both converters, got %d", got)
	}
	if got := runFunnel(t, db, steps, 0)[1].Count; got != 2 {
		t.Errorf("no window: expected both converters, got %d", got)
	}
}

// TestFunnelWindowMeasuredFromFirstStep pins the Mixpanel/Amplitude semantic: the
// window covers the whole funnel, not each hop individually.
func TestFunnelWindowMeasuredFromFirstStep(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		// Each hop is under 24h, but the whole journey takes 40h.
		{person: "drifter", name: "a", offset: 0},
		{person: "drifter", name: "b", offset: 20 * time.Hour},
		{person: "drifter", name: "c", offset: 40 * time.Hour},
	})

	result := runFunnel(t, db, []string{"a", "b", "c"}, 24*time.Hour)

	if result[1].Count != 1 {
		t.Errorf("step b happened inside the window: expected 1, got %d", result[1].Count)
	}
	if result[2].Count != 0 {
		t.Errorf("step c fell outside the window measured from step a: expected 0, got %d", result[2].Count)
	}
}

func TestFunnelRepeatedEventNeedsSecondOccurrence(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "once", name: "open_app", offset: 0},
		{person: "twice", name: "open_app", offset: 0},
		{person: "twice", name: "open_app", offset: time.Hour},
	})

	result := runFunnel(t, db, []string{"open_app", "open_app"}, 0)

	if result[0].Count != 2 {
		t.Errorf("step 1: expected both people, got %d", result[0].Count)
	}
	if result[1].Count != 1 {
		t.Errorf("step 2: only one person opened the app twice, got %d", result[1].Count)
	}
}

func TestFunnelIdentifiesLoggedInUsersByUserID(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		// The same person on two devices, both carrying the same user_id.
		{person: "device-1", userID: "user-7", name: "a", offset: 0},
		{person: "device-2", userID: "user-7", name: "b", offset: time.Hour},
	})

	if got := runFunnel(t, db, []string{"a", "b"}, 0)[1].Count; got != 1 {
		t.Errorf("expected the logged-in user to convert across devices, got %d", got)
	}
}

func TestFunnelMedianTimeBetweenSteps(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "p1", name: "a", offset: 0},
		{person: "p1", name: "b", offset: 10 * time.Second},
		{person: "p2", name: "a", offset: 0},
		{person: "p2", name: "b", offset: 20 * time.Second},
		{person: "p3", name: "a", offset: 0},
		{person: "p3", name: "b", offset: 30 * time.Second},
	})

	result := runFunnel(t, db, []string{"a", "b"}, 0)

	if result[0].MedianSecondsFromPrev != nil {
		t.Error("step 1 has no previous step to measure against")
	}
	if result[1].MedianSecondsFromPrev == nil {
		t.Fatal("step 2: expected a median time")
	}
	if got := *result[1].MedianSecondsFromPrev; got != 20 {
		t.Errorf("step 2: expected a 20s median, got %.1f", got)
	}
}

// TestFunnelSegmentFilter proves a filter narrows every step, not just the first.
func TestFunnelSegmentFilter(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "ios-1", name: "a", offset: 0, context: deviceContext("ios", "1.0")},
		{person: "ios-1", name: "b", offset: time.Minute, context: deviceContext("ios", "1.0")},
		{person: "ios-2", name: "a", offset: 0, context: deviceContext("ios", "1.0")},

		{person: "android-1", name: "a", offset: 0, context: deviceContext("android", "1.0")},
		{person: "android-2", name: "a", offset: 0, context: deviceContext("android", "1.0")},
		{person: "android-3", name: "a", offset: 0, context: deviceContext("android", "1.0")},
	})

	platform, err := storage.ParseDimension("platform")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	ios := runFunnel(t, db, []string{"a", "b"}, 0, storage.DimensionFilter{Dimension: platform, Value: "ios"})
	if ios[0].Count != 2 || ios[1].Count != 1 {
		t.Errorf("iOS segment: expected 2 then 1, got %d then %d", ios[0].Count, ios[1].Count)
	}
	if ios[1].ConversionRate != 50 {
		t.Errorf("iOS segment: expected 50%% conversion, got %.1f", ios[1].ConversionRate)
	}

	android := runFunnel(t, db, []string{"a", "b"}, 0, storage.DimensionFilter{Dimension: platform, Value: "android"})
	if android[0].Count != 3 || android[1].Count != 0 {
		t.Errorf("Android segment: expected 3 then 0, got %d then %d", android[0].Count, android[1].Count)
	}

	all := runFunnel(t, db, []string{"a", "b"}, 0)
	if all[0].Count != 5 {
		t.Errorf("unfiltered: expected all 5 people, got %d", all[0].Count)
	}
}

func TestFunnelCustomPropertyFilter(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "pro-1", name: "a", offset: 0, properties: map[string]any{"plan": "pro"}},
		{person: "pro-1", name: "b", offset: time.Minute, properties: map[string]any{"plan": "pro"}},
		{person: "free-1", name: "a", offset: 0, properties: map[string]any{"plan": "free"}},
	})

	plan, err := storage.ParseDimension("properties.plan")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	result := runFunnel(t, db, []string{"a", "b"}, 0, storage.DimensionFilter{Dimension: plan, Value: "pro"})
	if result[0].Count != 1 || result[1].Count != 1 {
		t.Errorf("expected the pro segment to be 1 then 1, got %d then %d", result[0].Count, result[1].Count)
	}
}

func TestFunnelEmptyResult(t *testing.T) {
	db := newTestDB(t)

	result := runFunnel(t, db, []string{"never_fired", "also_never"}, 24*time.Hour)

	if len(result) != 2 {
		t.Fatalf("expected 2 steps even with no data, got %d", len(result))
	}
	for i, step := range result {
		if step.Count != 0 || step.ConversionRate != 0 {
			t.Errorf("step %d: expected an empty result, got count=%d rate=%.1f",
				i+1, step.Count, step.ConversionRate)
		}
	}
}
