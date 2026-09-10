package postgres

import (
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// rollupWindowFor decides whether a request may be answered from daily
// aggregates. Saying yes when the range cannot be expressed at day grain would
// return a confidently wrong number, so the refusals matter more than the
// acceptances.

func day(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestRollupWindowAcceptsWholeDayRange(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")
	s := scope{
		From: day("2026-06-01T00:00:00Z"),
		To:   day("2026-06-30T23:59:59Z"),
	}

	w, ok := rollupWindowFor(s, now)
	if !ok {
		t.Fatal("a range covering whole days should be answerable from rollups")
	}
	if !w.from.Equal(day("2026-06-01T00:00:00Z")) {
		t.Errorf("from = %s, want 2026-06-01", w.from)
	}
	if !w.to.Equal(day("2026-06-30T00:00:00Z")) {
		t.Errorf("to = %s, want the 30th as the last included day", w.to)
	}
}

func TestRollupWindowAcceptsRangeEndingNow(t *testing.T) {
	// The dashboard's usual shape. Today's bucket is rebuilt continuously, so it
	// holds exactly the events ingested so far — which is what "to now" means.
	now := day("2026-09-01T13:45:00Z")
	s := scope{
		From: day("2026-06-03T00:00:00Z"),
		To:   now,
	}

	w, ok := rollupWindowFor(s, now)
	if !ok {
		t.Fatal("a day-aligned range ending inside today should be accepted")
	}
	if !w.to.Equal(day("2026-09-01T00:00:00Z")) {
		t.Errorf("to = %s, want today truncated to its day", w.to)
	}
}

// The tolerance exists so that "23:59:59" counts as end-of-day. It has to stay
// narrow: an hour short of midnight is a genuinely different range.
func TestRollupWindowEndOfDayTolerance(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")

	cases := map[string]struct {
		to   time.Time
		want bool
	}{
		// The range is inclusive of `to`, so midnight on the 1st asks for one
		// instant of July as well. Neither "through June" nor "through July 1"
		// is that range, and answering with either would disagree with the raw
		// path — so it is refused rather than approximated.
		"exact midnight next day": {day("2026-07-01T00:00:00Z"), false},
		"one second short":        {day("2026-06-30T23:59:59Z"), true},
		"one minute short":        {day("2026-06-30T23:59:00Z"), true},
		"two minutes short":       {day("2026-06-30T23:58:00Z"), false},
		"an hour short":           {day("2026-06-30T23:00:00Z"), false},
		"midday":                  {day("2026-06-30T12:00:00Z"), false},
	}

	for name, tc := range cases {
		s := scope{From: day("2026-06-01T00:00:00Z"), To: tc.to}
		if _, ok := rollupWindowFor(s, now); ok != tc.want {
			t.Errorf("%s (to=%s): accepted = %v, want %v", name, tc.to.Format(time.RFC3339), ok, tc.want)
		}
	}
}

func TestRollupWindowRefusesMidDayStart(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")
	s := scope{
		From: day("2026-06-01T09:30:00Z"),
		To:   day("2026-06-30T23:59:59Z"),
	}

	if _, ok := rollupWindowFor(s, now); ok {
		t.Fatal("a range starting mid-day cannot be expressed at day grain")
	}
}

func TestRollupWindowRefusesMidDayEndInThePast(t *testing.T) {
	// Ending at noon on a past day would silently include that whole day.
	now := day("2026-09-01T10:00:00Z")
	s := scope{
		From: day("2026-06-01T00:00:00Z"),
		To:   day("2026-06-30T12:00:00Z"),
	}

	if _, ok := rollupWindowFor(s, now); ok {
		t.Fatal("a range ending mid-day in the past must fall back to raw events")
	}
}

func TestRollupWindowRefusesUnknownDimensionFilter(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")
	custom, err := storage.ParseDimension("properties.plan")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	s := scope{
		From:    day("2026-06-01T00:00:00Z"),
		To:      day("2026-06-30T23:59:59Z"),
		Filters: []storage.DimensionFilter{{Dimension: custom, Value: "pro"}},
	}

	if _, ok := rollupWindowFor(s, now); ok {
		t.Fatal("no rollup column exists for an arbitrary properties path")
	}
}

func TestRollupWindowAcceptsBuiltinDimensionFilter(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")
	platform, err := storage.ParseDimension("platform")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	s := scope{
		From:    day("2026-06-01T00:00:00Z"),
		To:      day("2026-06-30T23:59:59Z"),
		Filters: []storage.DimensionFilter{{Dimension: platform, Value: "ios"}},
	}

	if _, ok := rollupWindowFor(s, now); !ok {
		t.Fatal("platform is a rollup column and should be accepted")
	}
}

func TestRollupWindowRefusesEmptyOrInvertedRange(t *testing.T) {
	now := day("2026-09-01T10:00:00Z")

	for name, s := range map[string]scope{
		"empty": {
			From: day("2026-06-01T00:00:00Z"),
			To:   day("2026-06-01T00:00:00Z"),
		},
		"inverted": {
			From: day("2026-06-05T00:00:00Z"),
			To:   day("2026-06-01T00:00:00Z"),
		},
	} {
		if _, ok := rollupWindowFor(s, now); ok {
			t.Errorf("%s range should be refused", name)
		}
	}
}

// personEligible gates the narrower person table, which carries only a subset of
// the dimensions. A filter it cannot express has to keep the query on raw events.
func TestPersonEligibleRejectsEventTableOnlyDimension(t *testing.T) {
	city, err := storage.ParseDimension("city")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}
	country, err := storage.ParseDimension("country")
	if err != nil {
		t.Fatalf("parse dimension: %v", err)
	}

	if personEligible(scope{Filters: []storage.DimensionFilter{{Dimension: city, Value: "Berlin"}}}) {
		t.Error("city exists on the event rollup but not the person rollup")
	}
	if !personEligible(scope{Filters: []storage.DimensionFilter{{Dimension: country, Value: "Germany"}}}) {
		t.Error("country exists on both rollups and should be eligible")
	}
}

// Every dimension the person table claims must also exist on the event table,
// otherwise a breakdown could join two different sets of values together.
func TestPersonDimensionsAreSubsetOfEventDimensions(t *testing.T) {
	for key := range rollupPersonDimensions {
		if _, ok := rollupEventDimensions[key]; !ok {
			t.Errorf("%q is on the person rollup but not the event rollup", key)
		}
	}
}

// Each mapped dimension must be a real built-in, or the query layer would route
// a request to a rollup column that does not correspond to what was asked for.
func TestRollupDimensionsAreRealBuiltins(t *testing.T) {
	for key := range rollupEventDimensions {
		dim, err := storage.ParseDimension(key)
		if err != nil {
			t.Errorf("rollup dimension %q is not a valid dimension: %v", key, err)
			continue
		}
		if dim.Key != key {
			t.Errorf("dimension %q parsed to key %q", key, dim.Key)
		}
	}
}
