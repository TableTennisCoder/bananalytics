package postgres

import (
	"fmt"
	"strings"

	"github.com/bananalytics/server/internal/storage"
)

// buildFunnelQuery assembles a strictly ordered funnel query and its parameters.
//
// Each step after the first is only counted for a person who already reached the
// previous step, and whose matching event happened at or after that previous step.
// When a window is set, the event must additionally fall inside the conversion
// window measured from the person's *first* step — the same semantics Mixpanel and
// Amplitude use, so a funnel can never report more people on a later step.
//
// The range filter uses created_at (the partition key, so Postgres can prune
// partitions) while ordering uses client_ts (when the event actually happened on
// the device), which keeps offline-queued events in their real order.
func buildFunnelQuery(params storage.FunnelParams) (string, []any) {
	steps := params.Steps
	base := scope{
		ProjectID: params.ProjectID,
		From:      params.From,
		To:        params.To,
		Filters:   params.Filters,
	}

	var (
		a argList
		b strings.Builder
	)

	stepScope := func(event string) scope {
		s := base
		s.Event = event
		return s
	}

	// Step 1 — everyone who entered the funnel, with their entry timestamp.
	b.WriteString("WITH s1 AS (\n")
	fmt.Fprintf(&b, "\tSELECT %s AS person, MIN(client_ts) AS ts, MIN(client_ts) AS first_ts\n", personColumn(""))
	b.WriteString("\tFROM " + eventsTable + "\n")
	fmt.Fprintf(&b, "\tWHERE %s\n", stepScope(steps[0]).where("", &a))
	b.WriteString("\tGROUP BY 1\n)")

	// The window is bound once and referenced from every subsequent step.
	windowParam := ""
	if params.Window > 0 {
		windowParam = a.bind(fmt.Sprintf("%d seconds", int64(params.Window.Seconds())))
	}

	for i := 2; i <= len(steps); i++ {
		// A step repeating the previous event needs a strictly later occurrence,
		// otherwise the same row would satisfy both steps. Distinct events keep
		// >= so that two events emitted in the same millisecond still convert.
		comparison := ">="
		if steps[i-1] == steps[i-2] {
			comparison = ">"
		}

		fmt.Fprintf(&b, ", s%d AS (\n", i)
		b.WriteString("\tSELECT p.person AS person, MIN(e.client_ts) AS ts, p.ts AS prev_ts, p.first_ts AS first_ts\n")
		fmt.Fprintf(&b, "\tFROM s%d p\n", i-1)
		fmt.Fprintf(&b, "\tJOIN %s e ON %s = p.person\n", eventsTable, personColumn("e"))
		fmt.Fprintf(&b, "\t\tAND %s\n", stepScope(steps[i-1]).where("e", &a))
		fmt.Fprintf(&b, "\t\tAND e.client_ts %s p.ts\n", comparison)
		if windowParam != "" {
			fmt.Fprintf(&b, "\t\tAND e.client_ts <= p.first_ts + %s::interval\n", windowParam)
		}
		b.WriteString("\tGROUP BY p.person, p.ts, p.first_ts\n)")
	}

	b.WriteString("\nSELECT 1 AS step_index, COUNT(*)::bigint AS reached, NULL::double precision AS median_secs FROM s1")
	for i := 2; i <= len(steps); i++ {
		fmt.Fprintf(&b,
			"\nUNION ALL\nSELECT %d, COUNT(*)::bigint, "+
				"EXTRACT(EPOCH FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY ts - prev_ts))::double precision FROM s%d",
			i, i)
	}
	b.WriteString("\nORDER BY step_index")

	return b.String(), a.args
}
