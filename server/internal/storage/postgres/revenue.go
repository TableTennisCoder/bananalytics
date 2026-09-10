package postgres

import (
	"context"
	"fmt"

	"github.com/bananalytics/server/internal/storage"
)

// currencyClause matches rows denominated in one currency. An empty code means
// "the events did not state a currency", which is stored as NULL.
func currencyClause(currency string, a *argList) string {
	if currency == "" {
		return "currency IS NULL"
	}
	return "currency = " + a.bind(currency)
}

// QueryRevenue aggregates revenue and the per-person averages derived from it.
//
// Figures are reported in a single currency: adding EUR to USD without exchange
// rates would produce a number that means nothing. When the caller does not pick
// one, the currency with the most revenue in range wins and the rest are listed
// alongside so the omission is visible rather than silent.
func (s *EventStore) QueryRevenue(ctx context.Context, params storage.RevenueParams) (*storage.RevenueSummary, error) {
	// Daily buckets are what the rollups store, so a minute or hour breakdown
	// still needs the raw events.
	fromRollup := params.Interval != "minute" && params.Interval != "hour"

	var w rollupWindow
	if fromRollup {
		w, fromRollup = s.rollupPlan(ctx, scopeOf(params.QueryParams), true)
	}

	currencies, err := s.currenciesFor(ctx, params, w, fromRollup)
	if err != nil {
		return nil, err
	}

	summary := &storage.RevenueSummary{
		AvailableCurrencies: currencies,
		Currency:            params.Currency,
		Timeseries:          []storage.RevenuePoint{},
	}
	if params.Currency == "" && len(currencies) > 0 {
		summary.Currency = currencies[0]
	}

	if fromRollup {
		if err := s.revenueTotalsFromRollup(ctx, params, w, summary); err != nil {
			return nil, err
		}
	} else if err := s.revenueTotals(ctx, params, summary); err != nil {
		return nil, err
	}

	points, err := s.revenuePointsFor(ctx, params, w, summary.Currency, fromRollup)
	if err != nil {
		return nil, err
	}
	summary.Timeseries = points

	if summary.ActiveUsers > 0 {
		summary.ARPU = summary.TotalRevenue / float64(summary.ActiveUsers)
		summary.PayingShare = float64(summary.PayingUsers) / float64(summary.ActiveUsers) * 100
	}
	if summary.PayingUsers > 0 {
		summary.ARPPU = summary.TotalRevenue / float64(summary.PayingUsers)
	}
	if summary.Transactions > 0 {
		summary.AverageOrderValue = summary.TotalRevenue / float64(summary.Transactions)
	}

	return summary, nil
}

// revenueCurrencies lists the currencies with revenue in range, biggest first.
func (s *EventStore) revenueCurrencies(ctx context.Context, params storage.QueryParams) ([]string, error) {
	var a argList
	query := fmt.Sprintf(`
		SELECT COALESCE(currency, '') AS currency
		FROM `+eventsTable+`
		WHERE %s AND revenue IS NOT NULL
		GROUP BY 1
		ORDER BY SUM(revenue) DESC NULLS LAST`,
		scopeOf(params).where("", &a))

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query revenue currencies: %w", err)
	}
	defer rows.Close()

	currencies := []string{}
	for rows.Next() {
		var currency string
		if err := rows.Scan(&currency); err != nil {
			return nil, fmt.Errorf("scan currency: %w", err)
		}
		currencies = append(currencies, currency)
	}
	return currencies, rows.Err()
}

// revenueTotals fills in the aggregates. Active people are counted over every
// event in range, not just revenue rows, so ARPU has a real denominator.
func (s *EventStore) revenueTotals(ctx context.Context, params storage.RevenueParams, summary *storage.RevenueSummary) error {
	var a argList
	where := scopeOf(params.QueryParams).where("", &a)
	money := "revenue IS NOT NULL AND " + currencyClause(summary.Currency, &a)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(revenue) FILTER (WHERE %[1]s), 0)::float8 AS total_revenue,
			COUNT(*) FILTER (WHERE %[1]s) AS transactions,
			COUNT(DISTINCT person_id) FILTER (WHERE %[1]s AND revenue > 0) AS paying_users,
			COUNT(DISTINCT person_id) AS active_users
		FROM `+eventsTable+`
		WHERE %[2]s`,
		money, where)

	err := s.pool.QueryRow(ctx, query, a.args...).Scan(
		&summary.TotalRevenue, &summary.Transactions,
		&summary.PayingUsers, &summary.ActiveUsers,
	)
	if err != nil {
		return fmt.Errorf("query revenue totals: %w", err)
	}
	return nil
}

func (s *EventStore) revenueTimeseries(ctx context.Context, params storage.RevenueParams, currency string) ([]storage.RevenuePoint, error) {
	unit := "day"
	switch params.Interval {
	case "minute", "hour":
		unit = params.Interval
	}

	var a argList
	where := scopeOf(params.QueryParams).where("", &a)

	query := fmt.Sprintf(`
		SELECT DATE_TRUNC('%s', created_at)::text AS bucket,
		       COALESCE(SUM(revenue), 0)::float8 AS revenue,
		       COUNT(*) AS transactions,
		       COUNT(DISTINCT person_id) AS paying_users
		FROM `+eventsTable+`
		WHERE %s AND revenue IS NOT NULL AND %s
		GROUP BY bucket
		ORDER BY bucket`,
		unit, where, currencyClause(currency, &a))

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query revenue timeseries: %w", err)
	}
	defer rows.Close()

	points := []storage.RevenuePoint{}
	for rows.Next() {
		var p storage.RevenuePoint
		if err := rows.Scan(&p.Bucket, &p.Revenue, &p.Transactions, &p.PayingUsers); err != nil {
			return nil, fmt.Errorf("scan revenue point: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// currenciesFor and revenuePointsFor pick between the aggregate and raw paths so
// QueryRevenue reads as one flow rather than a pair of branches per step.

func (s *EventStore) currenciesFor(ctx context.Context, params storage.RevenueParams, w rollupWindow, fromRollup bool) ([]string, error) {
	if fromRollup {
		return s.revenueCurrenciesFromRollup(ctx, params.QueryParams, w)
	}
	return s.revenueCurrencies(ctx, params.QueryParams)
}

func (s *EventStore) revenuePointsFor(ctx context.Context, params storage.RevenueParams, w rollupWindow, currency string, fromRollup bool) ([]storage.RevenuePoint, error) {
	if fromRollup {
		return s.revenueTimeseriesFromRollup(ctx, params, w, currency)
	}
	return s.revenueTimeseries(ctx, params, currency)
}
