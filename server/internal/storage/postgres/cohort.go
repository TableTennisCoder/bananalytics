package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// Cohort lifetime value.
//
// Built entirely from rollup_person_daily, which already holds one narrow row
// per person per day. That is exactly the grain this question needs, so no part
// of it touches the raw event stream.

// cohortIntervals are the groupings a cohort report accepts.
//
// The interval reaches date_trunc as a literal, so it is resolved through this
// map rather than from the request — the only safe way to put a caller's choice
// into that position.
var cohortIntervals = map[string]string{
	"week":  "week",
	"month": "month",
}

// cohortRevenueSQL computes per-cohort earnings by age in days.
//
// first_seen deliberately ignores the requested window. Someone first seen in
// May belongs to May's cohort even when the report starts in June; scoping it to
// the window would silently reassign every earlier person to the first cohort
// shown and make it look far more valuable than it is.
const cohortRevenueSQL = `
	WITH first_seen AS (
		SELECT person_id, MIN(day) AS acquired
		FROM rollup_person_daily
		WHERE project_id = $1
		GROUP BY person_id
	),
	members AS (
		SELECT person_id,
		       date_trunc('%[1]s', acquired)::date AS cohort,
		       acquired
		FROM first_seen
		WHERE acquired >= $2 AND acquired <= $3
	),
	sizes AS (
		SELECT cohort, COUNT(*) AS people
		FROM members
		GROUP BY cohort
	),
	earnings AS (
		SELECT m.cohort,
		       (p.day - m.acquired) AS age,
		       SUM(p.revenue)::float8 AS revenue
		FROM rollup_person_daily p
		JOIN members m ON m.person_id = p.person_id
		WHERE p.project_id = $1
		  AND p.currency = $4
		  AND p.revenue > 0
		GROUP BY 1, 2
	)
	SELECT s.cohort::text, s.people, COALESCE(e.age, -1), COALESCE(e.revenue, 0)
	FROM sizes s
	LEFT JOIN earnings e ON e.cohort = s.cohort
	ORDER BY s.cohort, COALESCE(e.age, -1)`

// QueryCohortRevenue reports cumulative revenue per acquired person per cohort.
func (s *EventStore) QueryCohortRevenue(ctx context.Context, params storage.CohortRevenueParams) (*storage.CohortRevenueReport, error) {
	interval, ok := cohortIntervals[params.Interval]
	if !ok {
		interval = "week"
	}

	// Revenue is only meaningful in one currency, the same rule the revenue
	// summary follows. Reuse its ordering so both pages agree on which one wins.
	currencies, err := s.revenueCurrenciesAllTime(ctx, params.ProjectID)
	if err != nil {
		return nil, err
	}

	currency := params.Currency
	if currency == "" && len(currencies) > 0 {
		currency = currencies[0]
	}

	report := &storage.CohortRevenueReport{
		Currency:            currency,
		AvailableCurrencies: currencies,
		Ages:                storage.CohortAges,
		Interval:            interval,
		Cohorts:             []storage.CohortRevenue{},
	}

	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(cohortRevenueSQL, interval),
		params.ProjectID,
		params.From.UTC().Format("2006-01-02"),
		params.To.UTC().Format("2006-01-02"),
		currency,
	)
	if err != nil {
		return nil, fmt.Errorf("query cohort revenue: %w", err)
	}
	defer rows.Close()

	// Earnings arrive as one row per (cohort, age). Collect them per cohort and
	// turn them into cumulative figures afterwards.
	type bucket struct {
		people int
		byAge  map[int]float64
		cohort time.Time
	}
	order := []string{}
	buckets := map[string]*bucket{}

	for rows.Next() {
		var cohort string
		var people, age int
		var revenue float64
		if err := rows.Scan(&cohort, &people, &age, &revenue); err != nil {
			return nil, fmt.Errorf("scan cohort revenue: %w", err)
		}

		b, seen := buckets[cohort]
		if !seen {
			start, err := time.Parse("2006-01-02", cohort)
			if err != nil {
				return nil, fmt.Errorf("parse cohort date %q: %w", cohort, err)
			}
			b = &bucket{people: people, byAge: map[int]float64{}, cohort: start}
			buckets[cohort] = b
			order = append(order, cohort)
		}
		// age is -1 for a cohort that earned nothing at all; the LEFT JOIN
		// still produces its row so the cohort appears with its size.
		if age >= 0 {
			b.byAge[age] += revenue
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read cohort revenue: %w", err)
	}

	today := truncateDay(time.Now())
	for _, key := range order {
		b := buckets[key]
		report.Cohorts = append(report.Cohorts, cohortRow(b.cohort, b.people, b.byAge, interval, today))
	}
	return report, nil
}

// cohortRow turns one cohort's daily earnings into cumulative per-person values.
func cohortRow(start time.Time, people int, byAge map[int]float64, interval string, today time.Time) storage.CohortRevenue {
	row := storage.CohortRevenue{
		Cohort:    start.Format("2006-01-02"),
		People:    people,
		PerPerson: make([]*float64, len(storage.CohortAges)),
	}
	if people == 0 {
		return row
	}

	// A cohort spans a whole week or month, so its youngest member is younger
	// than its start date suggests. Ages are reported only once the *last*
	// member has reached them — an average over members who have not lived long
	// enough understates the figure, and an understated LTV is worse than a
	// missing one.
	end := start.AddDate(0, 0, 7)
	if interval == "month" {
		end = start.AddDate(0, 1, 0)
	}

	var total float64
	for _, revenue := range byAge {
		total += revenue
	}
	row.Total = total / float64(people)

	for i, age := range storage.CohortAges {
		if end.AddDate(0, 0, age).After(today) {
			continue // not old enough; stays nil
		}
		var cumulative float64
		for day, revenue := range byAge {
			if day <= age {
				cumulative += revenue
			}
		}
		perPerson := cumulative / float64(people)
		row.PerPerson[i] = &perPerson
	}
	return row
}

// revenueCurrenciesAllTime lists a project's currencies by lifetime revenue.
//
// Separate from the range-scoped version the revenue summary uses: a cohort
// report follows earnings past the end of its window, so the currency has to be
// decided over everything rather than over the cohorts' acquisition dates.
func (s *EventStore) revenueCurrenciesAllTime(ctx context.Context, projectID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT currency
		FROM rollup_event_daily
		WHERE project_id = $1 AND revenue_events > 0
		GROUP BY currency
		ORDER BY SUM(revenue) DESC NULLS LAST`, projectID)
	if err != nil {
		return nil, fmt.Errorf("query cohort currencies: %w", err)
	}
	defer rows.Close()

	currencies := []string{}
	for rows.Next() {
		var currency string
		if err := rows.Scan(&currency); err != nil {
			return nil, fmt.Errorf("scan cohort currency: %w", err)
		}
		currencies = append(currencies, currency)
	}
	return currencies, rows.Err()
}
