//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

func mustDimension(t *testing.T, key string) storage.Dimension {
	t.Helper()
	dim, err := storage.ParseDimension(key)
	if err != nil {
		t.Fatalf("parse dimension %q: %v", key, err)
	}
	return dim
}

func testRange(db *testDB, filters ...storage.DimensionFilter) storage.QueryParams {
	return storage.QueryParams{
		ProjectID: db.projectID,
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
		Filters:   filters,
	}
}

// seedMixedTraffic writes a small but varied dataset: two platforms, two app
// versions, two countries and a custom property.
func seedMixedTraffic(t *testing.T, db *testDB) {
	t.Helper()

	germany := map[string]any{"country": "Germany", "country_code": "DE", "city": "Berlin", "lat": 52.52, "lng": 13.4}
	austria := map[string]any{"country": "Austria", "country_code": "AT", "city": "Vienna", "lat": 48.2, "lng": 16.37}

	db.insert(t, testBase, []event{
		{person: "a", name: "open_app", offset: 0, context: deviceContext("ios", "1.0"), geo: germany, properties: map[string]any{"plan": "pro"}},
		{person: "a", name: "purchase", offset: time.Minute, context: deviceContext("ios", "1.0"), geo: germany, properties: map[string]any{"plan": "pro"}},
		{person: "b", name: "open_app", offset: time.Hour, context: deviceContext("ios", "1.1"), geo: germany, properties: map[string]any{"plan": "free"}},
		{person: "c", name: "open_app", offset: 2 * time.Hour, context: deviceContext("android", "1.0"), geo: austria, properties: map[string]any{"plan": "free"}},
		{person: "c", name: "open_app", offset: 3 * time.Hour, context: deviceContext("android", "1.0"), geo: austria, properties: map[string]any{"plan": "free"}},
		// No context at all — must surface as "(not set)" rather than vanish.
		{person: "d", name: "open_app", offset: 4 * time.Hour},
	})
}

func TestBreakdownGroupsByDimension(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)
	store := NewEventStore(db.pool)

	buckets, err := store.QueryBreakdown(context.Background(), storage.BreakdownParams{
		ProjectID: db.projectID,
		Dimension: mustDimension(t, "platform"),
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("query breakdown: %v", err)
	}

	got := map[string]storage.BreakdownBucket{}
	for _, b := range buckets {
		got[b.Value] = b
	}

	if got["ios"].Count != 3 {
		t.Errorf("expected 3 iOS events, got %d", got["ios"].Count)
	}
	if got["ios"].UniqueUsers != 2 {
		t.Errorf("expected 2 unique iOS people, got %d", got["ios"].UniqueUsers)
	}
	if got["android"].Count != 2 || got["android"].UniqueUsers != 1 {
		t.Errorf("expected 2 Android events from 1 person, got %d from %d",
			got["android"].Count, got["android"].UniqueUsers)
	}
	if _, ok := got[storage.NotSetValue]; !ok {
		t.Error("expected events without a platform to appear as (not set)")
	}

	// Ranked by volume, highest first.
	for i := 1; i < len(buckets); i++ {
		if buckets[i].Count > buckets[i-1].Count {
			t.Errorf("expected buckets ordered by count, got %d after %d", buckets[i].Count, buckets[i-1].Count)
		}
	}
}

func TestBreakdownByCustomProperty(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)

	buckets, err := NewEventStore(db.pool).QueryBreakdown(context.Background(), storage.BreakdownParams{
		ProjectID: db.projectID,
		Dimension: mustDimension(t, "properties.plan"),
		Event:     "open_app",
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("query breakdown: %v", err)
	}

	got := map[string]int{}
	for _, b := range buckets {
		got[b.Value] = b.Count
	}
	if got["free"] != 3 {
		t.Errorf("expected 3 free open_app events, got %d", got["free"])
	}
	if got["pro"] != 1 {
		t.Errorf("expected 1 pro open_app event, got %d", got["pro"])
	}
}

func TestBreakdownRespectsFilters(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)

	buckets, err := NewEventStore(db.pool).QueryBreakdown(context.Background(), storage.BreakdownParams{
		ProjectID: db.projectID,
		Dimension: mustDimension(t, "app_version"),
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
		Filters: []storage.DimensionFilter{
			{Dimension: mustDimension(t, "platform"), Value: "ios"},
		},
	})
	if err != nil {
		t.Fatalf("query breakdown: %v", err)
	}

	total := 0
	for _, b := range buckets {
		total += b.Count
		if b.Value != "1.0" && b.Value != "1.1" {
			t.Errorf("unexpected app version in the iOS segment: %q", b.Value)
		}
	}
	if total != 3 {
		t.Errorf("expected the iOS segment to hold 3 events, got %d", total)
	}
}

// TestBreakdownValueIsNeverExecutedAsSQL feeds a hostile value through the whole
// path. It must come back as an ordinary (empty) result, not an error or a
// changed query.
func TestBreakdownValueIsNeverExecutedAsSQL(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)

	buckets, err := NewEventStore(db.pool).QueryBreakdown(context.Background(), storage.BreakdownParams{
		ProjectID: db.projectID,
		Dimension: mustDimension(t, "platform"),
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
		Filters: []storage.DimensionFilter{
			{Dimension: mustDimension(t, "properties.plan"), Value: "' OR 1=1; DROP TABLE events; --"},
		},
	})
	if err != nil {
		t.Fatalf("a hostile filter value must be treated as data, not SQL: %v", err)
	}
	if len(buckets) != 0 {
		t.Errorf("expected no rows to match the hostile value, got %d buckets", len(buckets))
	}

	// The table must still be there.
	var count int
	if err := db.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM events WHERE project_id = $1`, db.projectID).Scan(&count); err != nil {
		t.Fatalf("events table is gone: %v", err)
	}
	if count != 6 {
		t.Errorf("expected all 6 events to survive, got %d", count)
	}
}

func TestStatsRespectsFilters(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)
	store := NewEventStore(db.pool)

	all, err := store.QueryStats(context.Background(), testRange(db))
	if err != nil {
		t.Fatalf("query stats: %v", err)
	}
	if all.TotalEvents != 6 || all.UniqueUsers != 4 {
		t.Errorf("unfiltered: expected 6 events from 4 people, got %d from %d", all.TotalEvents, all.UniqueUsers)
	}

	ios, err := store.QueryStats(context.Background(),
		testRange(db, storage.DimensionFilter{Dimension: mustDimension(t, "platform"), Value: "ios"}))
	if err != nil {
		t.Fatalf("query filtered stats: %v", err)
	}
	if ios.TotalEvents != 3 || ios.UniqueUsers != 2 {
		t.Errorf("iOS: expected 3 events from 2 people, got %d from %d", ios.TotalEvents, ios.UniqueUsers)
	}
	// The leading country must be resolved within the segment.
	if ios.TopCountry != "Germany" {
		t.Errorf("iOS: expected Germany as top country, got %q", ios.TopCountry)
	}
}

func TestTimeseriesCountsPeopleAndEvents(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)

	points, err := NewEventStore(db.pool).QueryTimeseries(context.Background(), testRange(db), "day")
	if err != nil {
		t.Fatalf("query timeseries: %v", err)
	}
	if len(points) == 0 {
		t.Fatal("expected at least one bucket")
	}

	events, people := 0, 0
	for _, p := range points {
		events += p.Count
		people += p.UniqueUsers
	}
	if events != 6 {
		t.Errorf("expected 6 events across all buckets, got %d", events)
	}
	// Person "c" fired twice, so people must be below the event count.
	if people >= events {
		t.Errorf("expected unique people (%d) below event count (%d)", people, events)
	}
}

func TestTopEventsRespectsFilters(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)
	store := NewEventStore(db.pool)

	all, err := store.QueryTopEvents(context.Background(), testRange(db), 10)
	if err != nil {
		t.Fatalf("query top events: %v", err)
	}
	if len(all) != 2 || all[0].Event != "open_app" || all[0].Count != 5 {
		t.Errorf("expected open_app leading with 5, got %+v", all)
	}
	if all[0].UniqueUsers != 4 {
		t.Errorf("expected 4 unique people on open_app, got %d", all[0].UniqueUsers)
	}

	android, err := store.QueryTopEvents(context.Background(),
		testRange(db, storage.DimensionFilter{Dimension: mustDimension(t, "platform"), Value: "android"}), 10)
	if err != nil {
		t.Fatalf("query filtered top events: %v", err)
	}
	if len(android) != 1 || android[0].Count != 2 {
		t.Errorf("expected only 2 Android open_app events, got %+v", android)
	}
}

func TestGeoGroupsByCountryAndCity(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)
	store := NewEventStore(db.pool)

	countries, err := store.QueryGeo(context.Background(), testRange(db), "country")
	if err != nil {
		t.Fatalf("query geo: %v", err)
	}
	for _, row := range countries {
		if row.City != "" {
			t.Errorf("country grouping must not carry a city, got %q", row.City)
		}
	}

	cities, err := store.QueryGeo(context.Background(), testRange(db), "city")
	if err != nil {
		t.Fatalf("query geo by city: %v", err)
	}
	found := false
	for _, row := range cities {
		if row.City == "Berlin" && row.Country == "Germany" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Berlin in the city grouping, got %+v", cities)
	}
}

func TestQueryEventsRespectsFilters(t *testing.T) {
	db := newTestDB(t)
	seedMixedTraffic(t, db)

	events, err := NewEventStore(db.pool).QueryEvents(context.Background(), storage.EventFilter{
		ProjectID: db.projectID,
		From:      testBase.Add(-time.Hour),
		To:        testBase.Add(120 * 24 * time.Hour),
		Filters: []storage.DimensionFilter{
			{Dimension: mustDimension(t, "properties.plan"), Value: "free"},
		},
	})
	if err != nil {
		t.Fatalf("query events: %v", err)
	}
	if len(events) != 3 {
		t.Errorf("expected 3 events on the free plan, got %d", len(events))
	}
}

func TestPropertyKeysDiscoversCustomProperties(t *testing.T) {
	db := newTestDB(t)
	db.insert(t, testBase, []event{
		{person: "a", name: "purchase", offset: 0, properties: map[string]any{"plan": "pro", "amount": 9.99}},
		{person: "b", name: "purchase", offset: time.Minute, properties: map[string]any{"plan": "free", "source": "ads"}},
		{person: "c", name: "open_app", offset: 2 * time.Minute},
	})

	keys, err := NewEventStore(db.pool).QueryPropertyKeys(context.Background(),
		db.projectID, testBase.Add(-time.Hour), testBase.Add(120*24*time.Hour))
	if err != nil {
		t.Fatalf("query property keys: %v", err)
	}

	want := map[string]bool{"plan": true, "amount": true, "source": true}
	for _, key := range keys {
		delete(want, key)
	}
	if len(want) != 0 {
		t.Errorf("missing property keys: %v (got %v)", want, keys)
	}
}
