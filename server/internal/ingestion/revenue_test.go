package ingestion

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bananalytics/server/pkg/clock"
)

func TestExtractRevenueNumbers(t *testing.T) {
	tests := []struct {
		name         string
		properties   string
		wantAmount   float64
		wantCurrency string
	}{
		{"plain number", `{"revenue":9.99,"currency":"EUR"}`, 9.99, "EUR"},
		{"integer", `{"revenue":10,"currency":"USD"}`, 10, "USD"},
		{"dollar-prefixed key", `{"$revenue":4.5,"$currency":"GBP"}`, 4.5, "GBP"},
		// Payment SDKs report prices as strings just as often as numbers.
		{"numeric string", `{"revenue":"19.99","currency":"usd"}`, 19.99, "USD"},
		{"padded string", `{"revenue":" 7.50 ","currency":" chf "}`, 7.5, "CHF"},
		// Refunds must be representable so they can offset sales.
		{"refund", `{"revenue":-9.99,"currency":"EUR"}`, -9.99, "EUR"},
		{"zero", `{"revenue":0,"currency":"EUR"}`, 0, "EUR"},
		{"no currency stated", `{"revenue":5}`, 5, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			amount, currency := extractRevenue(json.RawMessage(tt.properties))

			if amount == nil {
				t.Fatalf("expected revenue to be extracted from %s", tt.properties)
			}
			if *amount != tt.wantAmount {
				t.Errorf("expected %v, got %v", tt.wantAmount, *amount)
			}
			if currency != tt.wantCurrency {
				t.Errorf("expected currency %q, got %q", tt.wantCurrency, currency)
			}
		})
	}
}

func TestExtractRevenueAbsent(t *testing.T) {
	cases := []string{
		``,
		`{}`,
		`null`,
		`{"button":"signup"}`,
		// A non-numeric value is not revenue.
		`{"revenue":"free"}`,
		`{"revenue":true}`,
		`{"revenue":null}`,
		// Not valid JSON at all.
		`{broken`,
	}

	for _, properties := range cases {
		amount, currency := extractRevenue(json.RawMessage(properties))
		if amount != nil {
			t.Errorf("%s: expected no revenue, got %v", properties, *amount)
		}
		if currency != "" {
			t.Errorf("%s: expected no currency, got %q", properties, currency)
		}
	}
}

// TestExtractRevenueDropsUnusableCurrency pins the safer failure: revenue with no
// currency label beats revenue with a wrong one.
func TestExtractRevenueDropsUnusableCurrency(t *testing.T) {
	for _, properties := range []string{
		`{"revenue":5,"currency":"EUROS"}`,
		`{"revenue":5,"currency":"€"}`,
		`{"revenue":5,"currency":"E"}`,
		`{"revenue":5,"currency":123}`,
		`{"revenue":5,"currency":""}`,
	} {
		amount, currency := extractRevenue(json.RawMessage(properties))
		if amount == nil {
			t.Errorf("%s: the amount is still valid revenue", properties)
		}
		if currency != "" {
			t.Errorf("%s: expected the unusable currency to be dropped, got %q", properties, currency)
		}
	}
}

// newTestEnricher builds an enricher with a fixed clock and no GeoIP database.
func newTestEnricher() *Enricher {
	clk := clock.Mock{NowFunc: func() time.Time { return time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC) }}
	return NewEnricher(clk, nil)
}

func TestEnricherExtractsRevenue(t *testing.T) {
	e := newTestEnricher()
	event := validEvent()
	event.Properties = json.RawMessage(`{"revenue":12.5,"currency":"EUR","product":"pro"}`)

	e.Enrich(&event, "proj-1", "1.2.3.4")

	if event.Revenue == nil {
		t.Fatal("expected the enricher to promote revenue out of the properties")
	}
	if *event.Revenue != 12.5 {
		t.Errorf("expected 12.5, got %v", *event.Revenue)
	}
	if event.Currency != "EUR" {
		t.Errorf("expected EUR, got %q", event.Currency)
	}
	// The original properties are left untouched so nothing is lost.
	var props map[string]any
	if err := json.Unmarshal(event.Properties, &props); err != nil {
		t.Fatalf("properties are no longer valid JSON: %v", err)
	}
	if props["product"] != "pro" {
		t.Error("expected the other properties to survive enrichment")
	}
}

func TestEnricherLeavesNonRevenueEventsAlone(t *testing.T) {
	e := newTestEnricher()
	event := validEvent()

	e.Enrich(&event, "proj-1", "1.2.3.4")

	if event.Revenue != nil {
		t.Errorf("expected no revenue on an ordinary event, got %v", *event.Revenue)
	}
	if event.Currency != "" {
		t.Errorf("expected no currency, got %q", event.Currency)
	}
}
