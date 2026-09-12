package query

import (
	"testing"
	"time"
)

// previousWindow decides what every delta on the dashboard is measured against.
// If it is wrong, every percentage the founder reads is wrong with it.

func ts(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestPreviousWindowHasTheSameLength(t *testing.T) {
	cases := map[string]struct{ from, to string }{
		"one day":       {"2026-09-10T00:00:00Z", "2026-09-11T00:00:00Z"},
		"seven days":    {"2026-09-04T00:00:00Z", "2026-09-11T00:00:00Z"},
		"thirty days":   {"2026-08-12T00:00:00Z", "2026-09-11T00:00:00Z"},
		"a quarter":     {"2026-06-11T00:00:00Z", "2026-09-11T00:00:00Z"},
		"part of a day": {"2026-09-11T08:00:00Z", "2026-09-11T17:30:00Z"},
	}

	for name, tc := range cases {
		from, to := ts(tc.from), ts(tc.to)
		prevFrom, prevTo := previousWindow(from, to)

		// The nanosecond is the gap that keeps the windows from overlapping.
		want := to.Sub(from)
		got := prevTo.Sub(prevFrom) + time.Nanosecond
		if got != want {
			t.Errorf("%s: previous window spans %v, current spans %v", name, got, want)
		}
	}
}

// The two windows must not share a single instant, or an event on the boundary
// would be counted in both and inflate the comparison.
func TestPreviousWindowDoesNotOverlap(t *testing.T) {
	from, to := ts("2026-09-04T00:00:00Z"), ts("2026-09-11T00:00:00Z")
	prevFrom, prevTo := previousWindow(from, to)

	if !prevTo.Before(from) {
		t.Errorf("previous window ends at %s, which is not before the current start %s", prevTo, from)
	}
	if !prevFrom.Before(prevTo) {
		t.Errorf("previous window is inverted: %s to %s", prevFrom, prevTo)
	}
}

func TestPreviousWindowIsImmediatelyBefore(t *testing.T) {
	from, to := ts("2026-09-04T00:00:00Z"), ts("2026-09-11T00:00:00Z")
	prevFrom, prevTo := previousWindow(from, to)

	if want := ts("2026-08-28T00:00:00Z"); !prevFrom.Equal(want) {
		t.Errorf("previous from = %s, want %s", prevFrom, want)
	}
	// One nanosecond short of where the current window opens.
	if want := from.Add(-time.Nanosecond); !prevTo.Equal(want) {
		t.Errorf("previous to = %s, want %s", prevTo, want)
	}
}

// A zero-length range would make the previous window zero-length too, which is
// meaningless but must not panic or produce something inverted.
func TestPreviousWindowHandlesEmptyRange(t *testing.T) {
	at := ts("2026-09-11T00:00:00Z")
	prevFrom, prevTo := previousWindow(at, at)

	if prevFrom.After(prevTo.Add(time.Nanosecond)) {
		t.Errorf("empty range produced an inverted window: %s to %s", prevFrom, prevTo)
	}
}
