package partitions

import (
	"testing"
	"time"
)

// These cover the decisions that decide whether data is destroyed. The bias is
// deliberate: a wrong "keep" costs disk, a wrong "drop" costs the user's data.

func TestValidateRetention(t *testing.T) {
	cases := map[string]struct {
		months  int
		wantErr bool
	}{
		"zero keeps forever":     {0, false},
		"minimum is allowed":     {MinRetentionMonths, false},
		"a year is allowed":      {12, false},
		"one month is too short": {1, true},
		"negative is rejected":   {-1, true},
	}

	for name, tc := range cases {
		err := ValidateRetention(tc.months)
		if (err != nil) != tc.wantErr {
			t.Errorf("%s: ValidateRetention(%d) error = %v, want error = %v",
				name, tc.months, err, tc.wantErr)
		}
	}
}

func TestBoundsFromName(t *testing.T) {
	cases := map[string]struct {
		name  string
		want  string // expected exclusive upper bound
		valid bool
	}{
		"ordinary month":      {"events_2026_06", "2026-07-01", true},
		"december rolls over": {"events_2026_12", "2027-01-01", true},
		"january":             {"events_2026_01", "2026-02-01", true},
		"month 13 rejected":   {"events_2026_13", "", false},
		"month 00 rejected":   {"events_2026_00", "", false},
		"rollup table":        {"rollup_event_daily", "", false},
		"parent table":        {"events", "", false},
		"suffixed":            {"events_2026_06_old", "", false},
	}

	for label, tc := range cases {
		got, ok := boundsFromName(tc.name)
		if ok != tc.valid {
			t.Errorf("%s: boundsFromName(%q) ok = %v, want %v", label, tc.name, ok, tc.valid)
			continue
		}
		if ok && got.Format("2006-01-02") != tc.want {
			t.Errorf("%s: upper bound = %s, want %s", label, got.Format("2006-01-02"), tc.want)
		}
	}
}

// A partition whose real bounds disagree with its name was not created by this
// package. Dropping it on the strength of the name alone could delete a range
// nobody meant to expire.
func TestBoundMatchesRejectsMismatch(t *testing.T) {
	upper := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)

	if !boundMatches("FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00')", upper) {
		t.Error("a bound matching the name should be accepted")
	}
	if boundMatches("FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2027-01-01 00:00:00+00')", upper) {
		t.Error("a partition covering more than its name says must be refused")
	}
	if boundMatches("FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-06-15 00:00:00+00')", upper) {
		t.Error("a partition covering less than its name says must be refused")
	}
	if boundMatches("DEFAULT", upper) {
		t.Error("a DEFAULT partition has no upper bound and must be refused")
	}
	if boundMatches("", upper) {
		t.Error("an empty bound expression must be refused")
	}
}

// The cutoff is the first instant still kept. A partition ending exactly there
// is entirely in the past and may go; one ending a day later still holds data
// inside the window and may not.
func TestCutoffBoundary(t *testing.T) {
	now := time.Date(2026, 9, 10, 14, 30, 0, 0, time.UTC)
	months := 6
	cutoff := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)

	if got, want := cutoff.Format("2006-01-02"), "2026-04-01"; got != want {
		t.Fatalf("cutoff = %s, want %s (six months back including September)", got, want)
	}

	cases := map[string]struct {
		partition string
		expired   bool
	}{
		"well before the window": {"events_2026_01", true},
		"ends exactly at cutoff": {"events_2026_03", true},
		"first kept month":       {"events_2026_04", false},
		"current month":          {"events_2026_09", false},
		"future month":           {"events_2026_12", false},
	}

	for label, tc := range cases {
		upper, ok := boundsFromName(tc.partition)
		if !ok {
			t.Fatalf("%s: could not parse %q", label, tc.partition)
		}
		expired := !upper.After(cutoff)
		if expired != tc.expired {
			t.Errorf("%s (%s): expired = %v, want %v", label, tc.partition, expired, tc.expired)
		}
	}
}

// Six months of retention must keep six months, not five or seven.
func TestCutoffKeepsRequestedMonths(t *testing.T) {
	now := time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)

	for _, months := range []int{2, 3, 6, 12, 24} {
		cutoff := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)

		kept := 0
		for m := cutoff; !m.After(now); m = m.AddDate(0, 1, 0) {
			kept++
		}
		if kept != months {
			t.Errorf("retention of %d months keeps %d months of partitions", months, kept)
		}
	}
}
