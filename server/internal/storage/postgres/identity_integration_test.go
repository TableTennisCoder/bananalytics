//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

func (db *testDB) link(t *testing.T, anonymousID, userID string) {
	t.Helper()

	err := NewEventStore(db.pool).LinkIdentities(context.Background(), []storage.IdentityLink{
		{ProjectID: db.projectID, AnonymousID: anonymousID, UserID: userID},
	})
	if err != nil {
		t.Fatalf("link identity: %v", err)
	}
}

// TestIdentityMergeCountsOnePerson is the core of identity resolution: someone
// who browses anonymously and then signs in is one person, not two.
func TestIdentityMergeCountsOnePerson(t *testing.T) {
	db := newTestDB(t)
	store := NewEventStore(db.pool)

	db.insert(t, testBase, []event{
		// Anonymous browsing before signing in.
		{person: "device-1", name: "open_app", offset: 0},
		{person: "device-1", name: "browse", offset: time.Minute},
		// Same device, now carrying a user ID.
		{person: "device-1", userID: "user-1", name: "signup_complete", offset: 2 * time.Minute},
	})

	before, err := store.QueryStats(context.Background(), testRange(db))
	if err != nil {
		t.Fatalf("query stats: %v", err)
	}
	if before.UniqueUsers != 2 {
		t.Fatalf("without a link the device and the user look like 2 people, got %d", before.UniqueUsers)
	}

	db.link(t, "device-1", "user-1")

	after, err := store.QueryStats(context.Background(), testRange(db))
	if err != nil {
		t.Fatalf("query stats after link: %v", err)
	}
	if after.UniqueUsers != 1 {
		t.Errorf("after linking the identity this is one person, got %d", after.UniqueUsers)
	}
	if after.TotalEvents != 3 {
		t.Errorf("linking must not change the event count, got %d", after.TotalEvents)
	}
}

// TestIdentityMergeCompletesFunnelAcrossLogin covers the case that silently
// broke conversion numbers: the funnel starts anonymously and finishes signed in.
func TestIdentityMergeCompletesFunnelAcrossLogin(t *testing.T) {
	db := newTestDB(t)

	db.insert(t, testBase, []event{
		{person: "device-1", name: "signup_start", offset: 0},
		{person: "device-1", userID: "user-1", name: "signup_complete", offset: 5 * time.Minute},
	})

	unlinked := runFunnel(t, db, []string{"signup_start", "signup_complete"}, 0)
	if unlinked[1].Count != 0 {
		t.Fatalf("without a link the two halves belong to different people, got %d", unlinked[1].Count)
	}

	db.link(t, "device-1", "user-1")

	linked := runFunnel(t, db, []string{"signup_start", "signup_complete"}, 0)
	if linked[0].Count != 1 || linked[1].Count != 1 {
		t.Errorf("expected one person converting, got %d then %d", linked[0].Count, linked[1].Count)
	}
	if linked[1].ConversionRate != 100 {
		t.Errorf("expected 100%% conversion, got %.1f", linked[1].ConversionRate)
	}
}

// TestIdentityMergeAcrossDevices proves a person on two devices counts once.
func TestIdentityMergeAcrossDevices(t *testing.T) {
	db := newTestDB(t)

	db.insert(t, testBase, []event{
		{person: "phone", name: "open_app", offset: 0},
		{person: "tablet", name: "open_app", offset: time.Hour},
	})
	db.link(t, "phone", "user-1")
	db.link(t, "tablet", "user-1")

	stats, err := NewEventStore(db.pool).QueryStats(context.Background(), testRange(db))
	if err != nil {
		t.Fatalf("query stats: %v", err)
	}
	if stats.UniqueUsers != 1 {
		t.Errorf("expected both devices to resolve to one person, got %d", stats.UniqueUsers)
	}
}

// TestIdentityFirstMappingWins documents the conflict rule. The SDK issues a new
// anonymous ID on logout, so a second user on the same anonymous ID means
// something unusual happened — history is kept rather than rewritten.
func TestIdentityFirstMappingWins(t *testing.T) {
	db := newTestDB(t)

	db.link(t, "device-1", "user-1")
	db.link(t, "device-1", "user-2")

	var userID string
	err := db.pool.QueryRow(context.Background(),
		`SELECT user_id FROM identities WHERE project_id = $1 AND anonymous_id = 'device-1'`,
		db.projectID).Scan(&userID)
	if err != nil {
		t.Fatalf("read identity: %v", err)
	}
	if userID != "user-1" {
		t.Errorf("expected the first mapping to be kept, got %q", userID)
	}
}

func TestIdentityMergeAppliesToRetention(t *testing.T) {
	db := newTestDB(t)

	db.insert(t, testBase, []event{
		{person: "device-1", name: "open_app", offset: 0},
		{person: "device-1", userID: "user-1", name: "open_app", offset: 25 * time.Hour},
	})
	db.link(t, "device-1", "user-1")

	cohorts, err := NewEventStore(db.pool).QueryRetention(context.Background(),
		db.projectID, testBase.Add(-time.Hour), testBase.Add(120*24*time.Hour))
	if err != nil {
		t.Fatalf("query retention: %v", err)
	}

	// One person, active on their first day and the next: a day-1 retention of 1.
	var day1 int
	for _, cohort := range cohorts {
		if cohort.Period == 1 {
			day1 = cohort.Retained
		}
	}
	if day1 != 1 {
		t.Errorf("expected the returning person to be retained on day 1, got %d", day1)
	}
}

func TestActiveUsersRollingWindows(t *testing.T) {
	db := newTestDB(t)

	// A person on day 0 only, and another active on days 0 and 8.
	db.insert(t, testBase, []event{
		{person: "one-off", name: "open_app", offset: 0},
		{person: "regular", name: "open_app", offset: 0},
		{person: "regular", name: "open_app", offset: 8 * 24 * time.Hour},
	})

	points, err := NewEventStore(db.pool).QueryActiveUsers(context.Background(), storage.QueryParams{
		ProjectID: db.projectID,
		From:      testBase,
		To:        testBase.Add(9 * 24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("query active users: %v", err)
	}
	if len(points) != 10 {
		t.Fatalf("expected one row per day over 10 days, got %d", len(points))
	}

	byDay := map[string]storage.ActiveUsersPoint{}
	for _, p := range points {
		byDay[p.Bucket] = p
	}

	day0 := testBase.Format("2006-01-02")
	if got := byDay[day0].DAU; got != 2 {
		t.Errorf("day 0: expected 2 daily actives, got %d", got)
	}

	// Day 8: only "regular" is active today, but "one-off" is still inside the
	// 30-day monthly window and outside the 7-day weekly one.
	day8 := testBase.Add(8 * 24 * time.Hour).Format("2006-01-02")
	point := byDay[day8]
	if point.DAU != 1 {
		t.Errorf("day 8: expected 1 daily active, got %d", point.DAU)
	}
	if point.WAU != 1 {
		t.Errorf("day 8: the day-0 visitor fell out of the weekly window, expected 1, got %d", point.WAU)
	}
	if point.MAU != 2 {
		t.Errorf("day 8: both people are inside the monthly window, expected 2, got %d", point.MAU)
	}
	if point.Stickiness != 50 {
		t.Errorf("day 8: expected 50%% stickiness (1 of 2), got %.1f", point.Stickiness)
	}
}

// TestActiveUsersCountsPeopleNotEvents is the difference between a real
// active-user curve and the event volume it used to be confused with.
func TestActiveUsersCountsPeopleNotEvents(t *testing.T) {
	db := newTestDB(t)

	events := make([]event, 0, 20)
	for i := 0; i < 20; i++ {
		events = append(events, event{person: "busy", name: "open_app", offset: time.Duration(i) * time.Minute})
	}
	db.insert(t, testBase, events)

	points, err := NewEventStore(db.pool).QueryActiveUsers(context.Background(), storage.QueryParams{
		ProjectID: db.projectID,
		From:      testBase,
		To:        testBase.Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("query active users: %v", err)
	}

	if points[0].DAU != 1 {
		t.Errorf("20 events from one person is 1 active user, got %d", points[0].DAU)
	}
}

func TestActiveUsersRespectsFilters(t *testing.T) {
	db := newTestDB(t)

	db.insert(t, testBase, []event{
		{person: "ios-1", name: "open_app", offset: 0, context: deviceContext("ios", "1.0")},
		{person: "android-1", name: "open_app", offset: 0, context: deviceContext("android", "1.0")},
	})

	points, err := NewEventStore(db.pool).QueryActiveUsers(context.Background(), storage.QueryParams{
		ProjectID: db.projectID,
		From:      testBase,
		To:        testBase.Add(24 * time.Hour),
		Filters: []storage.DimensionFilter{
			{Dimension: mustDimension(t, "platform"), Value: "ios"},
		},
	})
	if err != nil {
		t.Fatalf("query active users: %v", err)
	}
	if points[0].DAU != 1 {
		t.Errorf("expected only the iOS person, got %d", points[0].DAU)
	}
}
