//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// insertRevenue writes purchase events with a monetary value attached.
func (db *testDB) insertRevenue(t *testing.T, rows []revenueRow) {
	t.Helper()
	ctx := context.Background()

	for i, row := range rows {
		var currency any
		if row.currency != "" {
			currency = row.currency
		}
		var userID any
		if row.userID != "" {
			userID = row.userID
		}

		ts := testBase.Add(row.offset)
		_, err := db.pool.Exec(ctx, `
			INSERT INTO events (message_id, project_id, event, type, properties, context, user_id, anonymous_id, client_ts, server_ts, session_id, created_at, revenue, currency)
			VALUES (gen_random_uuid()::text, $1, $2, 'track', $3, '{}', $4, $5, $6, $6, 'sess', $6, $7, $8)`,
			db.projectID, row.name, mustJSON(t, row.properties), userID, row.person, ts, row.amount, currency)
		if err != nil {
			t.Fatalf("insert revenue row %d: %v", i, err)
		}
	}
}

type revenueRow struct {
	person     string
	userID     string
	name       string
	offset     time.Duration
	amount     float64
	currency   string
	properties map[string]any
}

func revenueParams(db *testDB, currency string, filters ...storage.DimensionFilter) storage.RevenueParams {
	return storage.RevenueParams{
		QueryParams: storage.QueryParams{
			ProjectID: db.projectID,
			From:      testBase.Add(-time.Hour),
			To:        testBase.Add(120 * 24 * time.Hour),
			Filters:   filters,
		},
		Currency: currency,
		Interval: "day",
	}
}

func TestRevenueSummary(t *testing.T) {
	db := newTestDB(t)

	// Two paying people out of four active ones.
	db.insert(t, testBase, []event{
		{person: "browser-1", name: "open_app", offset: 0},
		{person: "browser-2", name: "open_app", offset: 0},
	})
	db.insertRevenue(t, []revenueRow{
		{person: "buyer-1", name: "$purchase", offset: time.Minute, amount: 10, currency: "EUR"},
		{person: "buyer-1", name: "$purchase", offset: time.Hour, amount: 20, currency: "EUR"},
		{person: "buyer-2", name: "$purchase", offset: 2 * time.Hour, amount: 30, currency: "EUR"},
	})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}

	if summary.Currency != "EUR" {
		t.Errorf("expected EUR to be picked as the leading currency, got %q", summary.Currency)
	}
	if summary.TotalRevenue != 60 {
		t.Errorf("expected 60 total revenue, got %v", summary.TotalRevenue)
	}
	if summary.Transactions != 3 {
		t.Errorf("expected 3 transactions, got %d", summary.Transactions)
	}
	if summary.PayingUsers != 2 {
		t.Errorf("expected 2 paying people, got %d", summary.PayingUsers)
	}
	if summary.ActiveUsers != 4 {
		t.Errorf("expected 4 active people, got %d", summary.ActiveUsers)
	}

	// ARPU spreads revenue over everyone; ARPPU only over those who paid.
	if summary.ARPU != 15 {
		t.Errorf("expected an ARPU of 15 (60/4), got %v", summary.ARPU)
	}
	if summary.ARPPU != 30 {
		t.Errorf("expected an ARPPU of 30 (60/2), got %v", summary.ARPPU)
	}
	if summary.AverageOrderValue != 20 {
		t.Errorf("expected an order value of 20 (60/3), got %v", summary.AverageOrderValue)
	}
	if summary.PayingShare != 50 {
		t.Errorf("expected 50%% of people to have paid, got %v", summary.PayingShare)
	}
}

// TestRevenueNeverMixesCurrencies is the guard against a meaningless total:
// adding EUR to USD without an exchange rate produces a number, not an answer.
func TestRevenueNeverMixesCurrencies(t *testing.T) {
	db := newTestDB(t)
	store := NewEventStore(db.pool)

	db.insertRevenue(t, []revenueRow{
		{person: "a", name: "$purchase", offset: 0, amount: 100, currency: "EUR"},
		{person: "b", name: "$purchase", offset: time.Hour, amount: 30, currency: "USD"},
	})

	// EUR has the larger total, so it is chosen by default.
	auto, err := store.QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if auto.Currency != "EUR" || auto.TotalRevenue != 100 {
		t.Errorf("expected 100 EUR, got %v %s", auto.TotalRevenue, auto.Currency)
	}
	if len(auto.AvailableCurrencies) != 2 {
		t.Errorf("expected both currencies to be reported as available, got %v", auto.AvailableCurrencies)
	}

	usd, err := store.QueryRevenue(context.Background(), revenueParams(db, "USD"))
	if err != nil {
		t.Fatalf("query revenue in USD: %v", err)
	}
	if usd.TotalRevenue != 30 {
		t.Errorf("expected 30 USD, got %v", usd.TotalRevenue)
	}
}

func TestRevenueHandlesMissingCurrency(t *testing.T) {
	db := newTestDB(t)

	db.insertRevenue(t, []revenueRow{
		{person: "a", name: "$purchase", offset: 0, amount: 12.5},
	})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if summary.Currency != "" {
		t.Errorf("expected an empty currency, got %q", summary.Currency)
	}
	if summary.TotalRevenue != 12.5 {
		t.Errorf("expected the revenue to still be counted, got %v", summary.TotalRevenue)
	}
}

func TestRevenueRefundsOffsetSales(t *testing.T) {
	db := newTestDB(t)

	db.insertRevenue(t, []revenueRow{
		{person: "a", name: "$purchase", offset: 0, amount: 50, currency: "EUR"},
		{person: "a", name: "$refund", offset: time.Hour, amount: -20, currency: "EUR"},
	})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if summary.TotalRevenue != 30 {
		t.Errorf("expected the refund to reduce revenue to 30, got %v", summary.TotalRevenue)
	}
	// The refund is not a sale, so it must not add a paying person.
	if summary.PayingUsers != 1 {
		t.Errorf("expected 1 paying person, got %d", summary.PayingUsers)
	}
}

func TestRevenueTimeseries(t *testing.T) {
	db := newTestDB(t)

	db.insertRevenue(t, []revenueRow{
		{person: "a", name: "$purchase", offset: 0, amount: 10, currency: "EUR"},
		{person: "b", name: "$purchase", offset: time.Hour, amount: 15, currency: "EUR"},
		{person: "c", name: "$purchase", offset: 25 * time.Hour, amount: 40, currency: "EUR"},
	})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if len(summary.Timeseries) != 2 {
		t.Fatalf("expected 2 days with revenue, got %d", len(summary.Timeseries))
	}
	if summary.Timeseries[0].Revenue != 25 {
		t.Errorf("day 1: expected 25, got %v", summary.Timeseries[0].Revenue)
	}
	if summary.Timeseries[0].PayingUsers != 2 {
		t.Errorf("day 1: expected 2 paying people, got %d", summary.Timeseries[0].PayingUsers)
	}
	if summary.Timeseries[1].Revenue != 40 {
		t.Errorf("day 2: expected 40, got %v", summary.Timeseries[1].Revenue)
	}
}

func TestRevenueRespectsFilters(t *testing.T) {
	db := newTestDB(t)

	db.insertRevenue(t, []revenueRow{
		{person: "pro-1", name: "$purchase", offset: 0, amount: 100, currency: "EUR",
			properties: map[string]any{"plan": "pro"}},
		{person: "free-1", name: "$purchase", offset: time.Hour, amount: 5, currency: "EUR",
			properties: map[string]any{"plan": "free"}},
	})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(),
		revenueParams(db, "", storage.DimensionFilter{
			Dimension: mustDimension(t, "properties.plan"), Value: "pro",
		}))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if summary.TotalRevenue != 100 {
		t.Errorf("expected only the pro segment's 100, got %v", summary.TotalRevenue)
	}
}

func TestRevenueEmpty(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{{person: "a", name: "open_app", offset: 0}})

	summary, err := NewEventStore(db.pool).QueryRevenue(context.Background(), revenueParams(db, ""))
	if err != nil {
		t.Fatalf("query revenue: %v", err)
	}
	if summary.TotalRevenue != 0 || summary.PayingUsers != 0 || summary.Transactions != 0 {
		t.Errorf("expected an empty summary, got %+v", summary)
	}
	if summary.ARPU != 0 || summary.ARPPU != 0 {
		t.Error("expected no division by zero to leak into the averages")
	}
	if summary.ActiveUsers != 1 {
		t.Errorf("expected the non-paying person to still count as active, got %d", summary.ActiveUsers)
	}
}

// TestBreakdownCarriesRevenue is the point of the whole exercise: not "where are
// the users" but "where is the money".
func TestBreakdownCarriesRevenue(t *testing.T) {
	db := newTestDB(t)

	db.insert(t, testBase, []event{
		{person: "ios-1", name: "open_app", offset: 0, context: deviceContext("ios", "1.0")},
		{person: "android-1", name: "open_app", offset: 0, context: deviceContext("android", "1.0")},
	})
	db.insertRevenue(t, []revenueRow{
		{person: "ios-1", name: "$purchase", offset: time.Minute, amount: 80, currency: "EUR",
			properties: map[string]any{"device": map[string]any{"os": "ios"}}},
	})

	// The purchase row carries no device context, so break down by event instead
	// and assert the money lands on the right bucket.
	buckets, err := NewEventStore(db.pool).QueryBreakdown(context.Background(), storage.BreakdownParams{
		ProjectID: db.projectID,
		Dimension: mustDimension(t, "event"),
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("query breakdown: %v", err)
	}

	byEvent := map[string]storage.BreakdownBucket{}
	for _, b := range buckets {
		byEvent[b.Value] = b
	}

	if got := byEvent["$purchase"].Revenue; got != 80 {
		t.Errorf("expected 80 revenue on $purchase, got %v", got)
	}
	if got := byEvent["$purchase"].PayingUsers; got != 1 {
		t.Errorf("expected 1 paying person on $purchase, got %d", got)
	}
	if got := byEvent["open_app"].Revenue; got != 0 {
		t.Errorf("expected no revenue on open_app, got %v", got)
	}
}

func TestStatsIncludesRevenue(t *testing.T) {
	db := newTestDB(t)

	db.insertRevenue(t, []revenueRow{
		{person: "a", name: "$purchase", offset: 0, amount: 42.5, currency: "EUR"},
		// A second currency must not be folded into the headline figure.
		{person: "b", name: "$purchase", offset: time.Hour, amount: 5, currency: "USD"},
	})

	stats, err := NewEventStore(db.pool).QueryStats(context.Background(), testRange(db))
	if err != nil {
		t.Fatalf("query stats: %v", err)
	}
	if stats.TopCurrency != "EUR" {
		t.Errorf("expected EUR as the leading currency, got %q", stats.TopCurrency)
	}
	if stats.Revenue != 42.5 {
		t.Errorf("expected only the EUR revenue, got %v", stats.Revenue)
	}
}
