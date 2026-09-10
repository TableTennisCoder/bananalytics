package ingestion

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

// revenueKeys are the property names an event may state its monetary value under.
// Any event can carry revenue, not just $purchase — an app that already tracks
// "subscription_renewed" should not have to rename its events to see the money.
var revenueKeys = []string{"revenue", "$revenue"}

// currencyKeys mirror revenueKeys for the ISO 4217 code.
var currencyKeys = []string{"currency", "$currency"}

// currencyPattern matches an ISO 4217 alphabetic code.
var currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)

// extractRevenue reads the monetary value and currency out of an event's
// properties. It returns nil when the event carries no revenue.
//
// Values may arrive as JSON numbers or as strings — payment SDKs report prices
// both ways, and rejecting one of them would silently drop revenue.
// Negative values are kept so refunds can offset sales.
func extractRevenue(properties json.RawMessage) (*float64, string) {
	if len(properties) == 0 {
		return nil, ""
	}

	var props map[string]json.RawMessage
	if err := json.Unmarshal(properties, &props); err != nil {
		return nil, ""
	}

	amount, ok := findAmount(props)
	if !ok {
		return nil, ""
	}

	return &amount, findCurrency(props)
}

func findAmount(props map[string]json.RawMessage) (float64, bool) {
	for _, key := range revenueKeys {
		raw, ok := props[key]
		if !ok {
			continue
		}

		// An explicit null means the event carried no value. Unmarshalling it
		// into a float succeeds and leaves the zero value behind, which would
		// otherwise be recorded as a genuine zero-value transaction.
		if string(raw) == "null" {
			continue
		}

		var number float64
		if err := json.Unmarshal(raw, &number); err == nil {
			return number, true
		}

		var text string
		if err := json.Unmarshal(raw, &text); err == nil {
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(text), 64); err == nil {
				return parsed, true
			}
		}
	}
	return 0, false
}

func findCurrency(props map[string]json.RawMessage) string {
	for _, key := range currencyKeys {
		raw, ok := props[key]
		if !ok {
			continue
		}

		var text string
		if err := json.Unmarshal(raw, &text); err != nil {
			continue
		}

		// An unrecognisable code is dropped rather than stored: labelling revenue
		// with the wrong currency is worse than labelling it with none.
		if code := strings.ToUpper(strings.TrimSpace(text)); currencyPattern.MatchString(code) {
			return code
		}
	}
	return ""
}
