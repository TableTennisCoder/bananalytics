package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// Reading the dashboard out of the daily rollups instead of the raw event stream.
//
// A rollup answer is exact, not approximate — but only for ranges the daily grain
// can express. Eligibility is decided per request; anything the aggregates cannot
// answer falls through to the original raw-table query unchanged.

// errRollupUnsupported means the aggregates cannot express this request, and the
// caller should fall through to the raw-table query. It is a routing signal, not
// a failure: any other error from a rollup query is a real error and is returned.
var errRollupUnsupported = errors.New("request not expressible from rollups")

// rollupPlan decides whether a request can be served from aggregates, and
// returns the day window covering it.
//
// needPeople tightens the check: the person table carries fewer dimensions than
// the event table, so a query that has to attribute unique people needs its
// filters to be expressible there too.
func (s *EventStore) rollupPlan(ctx context.Context, sc scope, needPeople bool) (rollupWindow, bool) {
	w, ok := rollupWindowFor(sc, time.Now())
	if !ok {
		return rollupWindow{}, false
	}
	if needPeople && !personEligible(sc) {
		return rollupWindow{}, false
	}
	if !s.rollupCovers(ctx, sc.ProjectID, w) {
		return rollupWindow{}, false
	}
	return w, true
}

// rollupEventDimensions are the dimensions rollup_event_daily carries as columns.
var rollupEventDimensions = map[string]string{
	"event":        "event",
	"platform":     "platform",
	"country":      "country",
	"country_code": "country_code",
	"city":         "city",
	"currency":     "currency",
}

// rollupPersonDimensions are the subset that rollup_person_daily also carries, so
// they can be broken down by unique people rather than only by event volume.
var rollupPersonDimensions = map[string]string{
	"event":    "event",
	"platform": "platform",
	"country":  "country",
}

// dayGrain is the resolution of the rollup tables.
const dayGrain = 24 * time.Hour

func truncateDay(t time.Time) time.Time {
	return t.UTC().Truncate(dayGrain)
}

// rollupWindow is a scope translated to whole days.
type rollupWindow struct {
	from time.Time // inclusive day
	to   time.Time // inclusive day
}

// endOfDayTolerance treats a range ending in the last minute of a day as ending
// at the day's end.
//
// Callers write 23:59:59 to mean "through the end of this day", and the
// dashboard rounds its timestamps to the minute. Without this, the single most
// common range shape would be refused. The cost is that events in the final
// seconds of the closing day are counted as inside the range — bounded, and
// below the accuracy that late-arriving events already impose.
const endOfDayTolerance = time.Minute

// rollupWindowFor decides whether a scope can be served from daily aggregates,
// and returns the day range that covers it exactly.
//
// Two shapes qualify. A range that starts on a day boundary and runs to the end
// of a day is expressible directly. So is the dashboard's usual shape — a day
// boundary through "now" — because the current day's bucket is rebuilt
// continuously and therefore holds exactly the events that have arrived so far.
//
// A range that starts or stops mid-day in the past is refused, because the daily
// grain would silently widen it to whole days. Those fall through to the raw
// event tables, which stay correct at any resolution.
func rollupWindowFor(s scope, now time.Time) (rollupWindow, bool) {
	from := s.From.UTC()
	to := s.To.UTC()

	if !from.Equal(truncateDay(from)) {
		return rollupWindow{}, false
	}
	if !to.After(from) {
		return rollupWindow{}, false
	}

	toDay := truncateDay(to)
	endOfToDay := toDay.Add(dayGrain)

	coversWholeDay := !to.Before(endOfToDay.Add(-endOfDayTolerance))
	isToday := toDay.Equal(truncateDay(now))

	if !coversWholeDay && !isToday {
		return rollupWindow{}, false
	}

	for _, f := range s.Filters {
		if _, ok := rollupEventDimensions[f.Dimension.Key]; !ok {
			return rollupWindow{}, false
		}
	}

	return rollupWindow{from: truncateDay(from), to: toDay}, true
}

// personEligible reports whether every filter is expressible on the person table,
// which carries fewer dimensions than the event table.
func personEligible(s scope) bool {
	for _, f := range s.Filters {
		if _, ok := rollupPersonDimensions[f.Dimension.Key]; !ok {
			return false
		}
	}
	return true
}

// rollupCovers reports whether a project's aggregates are built far enough to
// answer the window.
func (s *EventStore) rollupCovers(ctx context.Context, projectID string, w rollupWindow) bool {
	var through time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT rolled_through FROM rollup_state WHERE project_id = $1`, projectID,
	).Scan(&through)
	if err != nil {
		return false
	}
	return !truncateDay(through).Before(w.to)
}

// rollupWhere renders the shared conditions against a rollup table. dims selects
// which dimension set is legal for the table being read.
func rollupWhere(s scope, w rollupWindow, dims map[string]string, alias string, a *argList) string {
	clauses := []string{
		qualify(alias, "project_id") + " = " + a.bind(s.ProjectID),
		qualify(alias, "day") + " >= " + a.bind(w.from),
		qualify(alias, "day") + " <= " + a.bind(w.to),
	}

	if s.Event != "" {
		clauses = append(clauses, qualify(alias, "event")+" = "+a.bind(s.Event))
	}

	for _, f := range s.Filters {
		// Callers check eligibility first; an unknown key here would silently
		// widen the result, so refuse to render it.
		col, ok := dims[f.Dimension.Key]
		if !ok {
			continue
		}
		clauses = append(clauses, qualify(alias, col)+" = "+a.bind(f.Value))
	}

	return strings.Join(clauses, " AND ")
}

// statsFromRollup answers the overview from aggregates.
//
// Two of the seven numbers are deliberately left out of the rollup path: active
// sessions and events-per-minute are both "in the last 30 minutes", which no
// daily grain can express. They come from a separate, tiny query against the raw
// table, bounded by an index on the same half hour.
func (s *EventStore) statsFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow) (*storage.StatsOverview, error) {
	sc := scopeOf(params)

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "", &a)

	// The scope is rendered once into a CTE and every aggregate reads from that,
	// so the bound arguments stay a single flat list.
	query := `
		WITH scoped AS (
			SELECT country, currency, events, revenue
			FROM rollup_event_daily
			WHERE ` + eventWhere + `
		),
		top_currency AS (
			SELECT currency AS code
			FROM scoped
			WHERE currency <> ''
			GROUP BY currency
			ORDER BY SUM(revenue) DESC NULLS LAST
			LIMIT 1
		),
		top_country AS (
			SELECT country
			FROM scoped
			WHERE country <> ''
			GROUP BY country
			ORDER BY SUM(events) DESC
			LIMIT 1
		)
		SELECT
			(SELECT COALESCE(SUM(events), 0) FROM scoped),
			COALESCE((SELECT country FROM top_country), 'Unknown'),
			COALESCE((SELECT code FROM top_currency), ''),
			COALESCE((
				SELECT SUM(revenue) FROM scoped
				WHERE currency = COALESCE((SELECT code FROM top_currency), '')
			), 0)::float8`

	var stats storage.StatsOverview
	if err := s.pool.QueryRow(ctx, query, a.args...).Scan(
		&stats.TotalEvents, &stats.TopCountry, &stats.TopCurrency, &stats.Revenue,
	); err != nil {
		return nil, fmt.Errorf("query stats rollup: %w", err)
	}

	// COUNT(DISTINCT x) makes Postgres sort the whole input; counting the rows of
	// a DISTINCT subquery lets it hash instead. Measured on 953k person-days:
	// 1504 ms sorting (and spilling to disk) against 277 ms hashing.
	var ua argList
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "", &ua)
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT DISTINCT person_id FROM rollup_person_daily WHERE `+personWhere+`
		) p`,
		ua.args...,
	).Scan(&stats.UniqueUsers); err != nil {
		return nil, fmt.Errorf("query stats rollup people: %w", err)
	}

	if err := s.liveActivity(ctx, params.ProjectID, &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

// liveActivity fills in the two half-hour numbers from the raw table.
func (s *EventStore) liveActivity(ctx context.Context, projectID string, stats *storage.StatsOverview) error {
	// The created_at bound exists for partition pruning, not for filtering: the
	// table is partitioned on created_at while the question is about server_ts.
	// Without it this half-hour question scans every monthly partition.
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT session_id),
		       COALESCE(COUNT(*) / 30.0, 0)
		FROM events
		WHERE project_id = $1
		  AND created_at >= NOW() - INTERVAL '1 hour'
		  AND server_ts >= NOW() - INTERVAL '30 minutes'`,
		projectID,
	).Scan(&stats.ActiveSessions, &stats.EventsPerMinute)
	if err != nil {
		return fmt.Errorf("query stats live window: %w", err)
	}
	return nil
}

// timeseriesFromRollup returns one point per day.
func (s *EventStore) timeseriesFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow) ([]storage.TimeseriesPoint, error) {
	sc := scopeOf(params)

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "e", &a)
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "p", &a)

	query := `
		WITH counts AS (
			SELECT e.day, SUM(e.events) AS count
			FROM rollup_event_daily e
			WHERE ` + eventWhere + `
			GROUP BY e.day
		),
		people AS (
			SELECT day, COUNT(*) AS unique_users
			FROM (
				SELECT DISTINCT p.day, p.person_id
				FROM rollup_person_daily p
				WHERE ` + personWhere + `
			) d
			GROUP BY day
		)
		SELECT c.day::text, c.count, COALESCE(pe.unique_users, 0)
		FROM counts c
		LEFT JOIN people pe ON pe.day = c.day
		ORDER BY c.day`

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query timeseries rollup: %w", err)
	}
	defer rows.Close()

	var points []storage.TimeseriesPoint
	for rows.Next() {
		var p storage.TimeseriesPoint
		if err := rows.Scan(&p.Bucket, &p.Count, &p.UniqueUsers); err != nil {
			return nil, fmt.Errorf("scan timeseries rollup: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// topEventsFromRollup ranks events by volume, with their reach.
func (s *EventStore) topEventsFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow, limit int) ([]storage.TopEvent, error) {
	sc := scopeOf(params)

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "e", &a)
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "p", &a)

	query := `
		WITH counts AS (
			SELECT e.event, SUM(e.events) AS count
			FROM rollup_event_daily e
			WHERE ` + eventWhere + `
			GROUP BY e.event
			ORDER BY count DESC
			LIMIT ` + a.bind(limit) + `
		),
		reach AS (
			SELECT event, COUNT(*) AS unique_users
			FROM (
				SELECT DISTINCT p.event, p.person_id
				FROM rollup_person_daily p
				WHERE ` + personWhere + `
				  AND p.event IN (SELECT event FROM counts)
			) d
			GROUP BY event
		)
		SELECT c.event, c.count, COALESCE(r.unique_users, 0)
		FROM counts c
		LEFT JOIN reach r ON r.event = c.event
		ORDER BY c.count DESC`

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query top events rollup: %w", err)
	}
	defer rows.Close()

	var events []storage.TopEvent
	for rows.Next() {
		var e storage.TopEvent
		if err := rows.Scan(&e.Event, &e.Count, &e.UniqueUsers); err != nil {
			return nil, fmt.Errorf("scan top event rollup: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// breakdownFromRollup groups by a built-in dimension.
func (s *EventStore) breakdownFromRollup(ctx context.Context, params storage.BreakdownParams, w rollupWindow, limit int) ([]storage.BreakdownBucket, error) {
	eventCol, ok := rollupEventDimensions[params.Dimension.Key]
	if !ok {
		return nil, errRollupUnsupported
	}
	personCol, hasPerson := rollupPersonDimensions[params.Dimension.Key]

	sc := scope{
		ProjectID: params.ProjectID,
		From:      params.From,
		To:        params.To,
		Event:     params.Event,
		Filters:   params.Filters,
	}

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "e", &a)

	// Without the dimension on the person table there is no way to attribute
	// people to its values, so those two columns come back zero rather than wrong.
	peopleSelect := "0::bigint AS unique_users, 0::bigint AS paying_users"
	peopleJoin := ""
	if hasPerson {
		personWhere := rollupWhere(sc, w, rollupPersonDimensions, "p", &a)
		peopleSelect = "COALESCE(r.unique_users, 0), COALESCE(r.paying_users, 0)"
		// Collapsing to one row per (value, person) first turns both counts into
		// plain row counts, and carries whether that person ever paid.
		peopleJoin = `
		LEFT JOIN (
			SELECT value,
			       COUNT(*) AS unique_users,
			       COUNT(*) FILTER (WHERE paid) AS paying_users
			FROM (
				-- Same "(not set)" folding as the counts side, or rows with an
				-- empty dimension value would never find their join partner.
				SELECT COALESCE(NULLIF(p.` + personCol + `, ''), '` + storage.NotSetValue + `') AS value,
				       p.person_id,
				       BOOL_OR(p.revenue > 0) AS paid
				FROM rollup_person_daily p
				WHERE ` + personWhere + `
				GROUP BY 1, 2
			) d
			GROUP BY value
		) r ON r.value = c.value`
	}

	query := `
		WITH counts AS (
			SELECT COALESCE(NULLIF(e.` + eventCol + `, ''), '` + storage.NotSetValue + `') AS value,
			       SUM(e.events) AS count,
			       COALESCE(SUM(e.revenue), 0)::float8 AS revenue
			FROM rollup_event_daily e
			WHERE ` + eventWhere + `
			GROUP BY 1
			ORDER BY count DESC
			LIMIT ` + a.bind(limit) + `
		)
		SELECT c.value, c.count, ` + peopleSelect + `, c.revenue
		FROM counts c` + peopleJoin + `
		ORDER BY c.count DESC`

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query breakdown rollup: %w", err)
	}
	defer rows.Close()

	var buckets []storage.BreakdownBucket
	for rows.Next() {
		var b storage.BreakdownBucket
		if err := rows.Scan(&b.Value, &b.Count, &b.UniqueUsers, &b.PayingUsers, &b.Revenue); err != nil {
			return nil, fmt.Errorf("scan breakdown rollup: %w", err)
		}
		buckets = append(buckets, b)
	}
	return buckets, rows.Err()
}

// geoFromRollup returns per-country or per-city totals.
func (s *EventStore) geoFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow, groupBy string) ([]storage.GeoData, error) {
	sc := scopeOf(params)

	cityColumn, cityGroup := "'' AS city", ""
	if groupBy == "city" {
		cityColumn = "COALESCE(NULLIF(e.city, ''), 'Unknown') AS city"
		cityGroup = ", e.city"
	}

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "e", &a)
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "p", &a)

	// lat/lng are stored as sums so that re-averaging across days stays weighted
	// by how many events each day contributed.
	query := `
		WITH counts AS (
			SELECT COALESCE(NULLIF(e.country, ''), 'Unknown') AS country,
			       e.country_code AS country_code,
			       ` + cityColumn + `,
			       SUM(e.events) AS count,
			       SUM(e.lat_sum) AS lat_sum,
			       SUM(e.lng_sum) AS lng_sum,
			       SUM(e.geo_events) AS geo_events
			FROM rollup_event_daily e
			WHERE ` + eventWhere + `
			GROUP BY 1, 2` + cityGroup + `
		),
		people AS (
			SELECT country, COUNT(*) AS unique_users
			FROM (
				SELECT DISTINCT COALESCE(NULLIF(p.country, ''), 'Unknown') AS country,
				                p.person_id
				FROM rollup_person_daily p
				WHERE ` + personWhere + `
			) d
			GROUP BY country
		)
		SELECT c.country, c.country_code, c.city, c.count,
		       COALESCE(pe.unique_users, 0),
		       CASE WHEN c.geo_events > 0 THEN c.lat_sum / c.geo_events ELSE 0 END,
		       CASE WHEN c.geo_events > 0 THEN c.lng_sum / c.geo_events ELSE 0 END
		FROM counts c
		LEFT JOIN people pe ON pe.country = c.country
		ORDER BY c.count DESC`

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query geo rollup: %w", err)
	}
	defer rows.Close()

	var data []storage.GeoData
	for rows.Next() {
		var g storage.GeoData
		if err := rows.Scan(&g.Country, &g.CountryCode, &g.City, &g.Count, &g.UniqueUsers, &g.Lat, &g.Lng); err != nil {
			return nil, fmt.Errorf("scan geo rollup: %w", err)
		}
		data = append(data, g)
	}
	return data, rows.Err()
}

// activeUsersFromRollup computes DAU, WAU and MAU from the person table.
//
// The rolling windows are self-joins on a table holding one narrow row per
// person-day, which is what makes a thirty-day lookback cheap.
func (s *EventStore) activeUsersFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow) ([]storage.ActiveUsersPoint, error) {
	const mauDays = 30

	sc := scopeOf(params)
	lookback := w
	lookback.from = w.from.AddDate(0, 0, -(mauDays - 1))

	var a argList
	fromArg := a.bind(w.from)
	toArg := a.bind(w.to)
	personWhere := rollupWhere(sc, lookback, rollupPersonDimensions, "p", &a)

	query := fmt.Sprintf(`
		WITH days AS (
			SELECT generate_series(%s::date, %s::date, '1 day')::date AS day
		),
		activity AS (
			SELECT DISTINCT p.person_id, p.day
			FROM rollup_person_daily p
			WHERE %s
		)
		SELECT
			d.day::text,
			COUNT(DISTINCT a.person_id) FILTER (WHERE a.day = d.day) AS dau,
			COUNT(DISTINCT a.person_id) FILTER (WHERE a.day > d.day - 7) AS wau,
			COUNT(DISTINCT a.person_id) AS mau
		FROM days d
		LEFT JOIN activity a ON a.day > d.day - %d AND a.day <= d.day
		GROUP BY d.day
		ORDER BY d.day`,
		fromArg, toArg, personWhere, mauDays)

	rows, err := s.pool.Query(ctx, query, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query active users rollup: %w", err)
	}
	defer rows.Close()

	var points []storage.ActiveUsersPoint
	for rows.Next() {
		var p storage.ActiveUsersPoint
		if err := rows.Scan(&p.Bucket, &p.DAU, &p.WAU, &p.MAU); err != nil {
			return nil, fmt.Errorf("scan active users rollup: %w", err)
		}
		if p.MAU > 0 {
			p.Stickiness = float64(p.DAU) / float64(p.MAU) * 100
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

// rollupCurrencyClause matches one currency in the rollup tables, where a
// missing currency is stored as the empty string rather than NULL.
func rollupCurrencyClause(alias, currency string, a *argList) string {
	return qualify(alias, "currency") + " = " + a.bind(currency)
}

// revenueCurrenciesFromRollup lists the currencies with revenue in range,
// largest first.
func (s *EventStore) revenueCurrenciesFromRollup(ctx context.Context, params storage.QueryParams, w rollupWindow) ([]string, error) {
	var a argList
	where := rollupWhere(scopeOf(params), w, rollupEventDimensions, "", &a)

	rows, err := s.pool.Query(ctx, `
		SELECT currency
		FROM rollup_event_daily
		WHERE `+where+` AND revenue_events > 0
		GROUP BY currency
		ORDER BY SUM(revenue) DESC NULLS LAST`, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query revenue currencies rollup: %w", err)
	}
	defer rows.Close()

	currencies := []string{}
	for rows.Next() {
		var currency string
		if err := rows.Scan(&currency); err != nil {
			return nil, fmt.Errorf("scan currency rollup: %w", err)
		}
		currencies = append(currencies, currency)
	}
	return currencies, rows.Err()
}

// revenueTotalsFromRollup fills in the money aggregates.
//
// Active people are counted across every event in range rather than only the
// paid ones, so ARPU keeps a denominator that means something.
func (s *EventStore) revenueTotalsFromRollup(ctx context.Context, params storage.RevenueParams, w rollupWindow, summary *storage.RevenueSummary) error {
	sc := scopeOf(params.QueryParams)

	var a argList
	eventWhere := rollupWhere(sc, w, rollupEventDimensions, "", &a)
	money := rollupCurrencyClause("", summary.Currency, &a)

	if err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(revenue) FILTER (WHERE `+money+`), 0)::float8,
		       COALESCE(SUM(revenue_events) FILTER (WHERE `+money+`), 0)
		FROM rollup_event_daily
		WHERE `+eventWhere, a.args...,
	).Scan(&summary.TotalRevenue, &summary.Transactions); err != nil {
		return fmt.Errorf("query revenue totals rollup: %w", err)
	}

	var pa argList
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "", &pa)
	payingCurrency := rollupCurrencyClause("", summary.Currency, &pa)

	if err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM (
				SELECT DISTINCT person_id FROM rollup_person_daily
				WHERE `+personWhere+` AND `+payingCurrency+` AND revenue > 0
			) x),
			(SELECT COUNT(*) FROM (
				SELECT DISTINCT person_id FROM rollup_person_daily
				WHERE `+personWhere+`
			) y)`, pa.args...,
	).Scan(&summary.PayingUsers, &summary.ActiveUsers); err != nil {
		return fmt.Errorf("query revenue people rollup: %w", err)
	}
	return nil
}

// revenueTimeseriesFromRollup returns revenue per day in one currency, with the
// number of people who paid on each day.
func (s *EventStore) revenueTimeseriesFromRollup(ctx context.Context, params storage.RevenueParams, w rollupWindow, currency string) ([]storage.RevenuePoint, error) {
	sc := scopeOf(params.QueryParams)

	var a argList
	where := rollupWhere(sc, w, rollupEventDimensions, "e", &a)
	money := rollupCurrencyClause("e", currency, &a)
	personWhere := rollupWhere(sc, w, rollupPersonDimensions, "p", &a)
	personMoney := rollupCurrencyClause("p", currency, &a)

	rows, err := s.pool.Query(ctx, `
		WITH money AS (
			SELECT e.day,
			       COALESCE(SUM(e.revenue), 0)::float8 AS revenue,
			       COALESCE(SUM(e.revenue_events), 0) AS transactions
			FROM rollup_event_daily e
			WHERE `+where+` AND `+money+`
			GROUP BY e.day
		),
		payers AS (
			SELECT day, COUNT(*) AS paying_users
			FROM (
				SELECT DISTINCT p.day, p.person_id
				FROM rollup_person_daily p
				WHERE `+personWhere+` AND `+personMoney+` AND p.revenue > 0
			) d
			GROUP BY day
		)
		SELECT m.day::text, m.revenue, m.transactions, COALESCE(pa.paying_users, 0)
		FROM money m
		LEFT JOIN payers pa ON pa.day = m.day
		ORDER BY m.day`, a.args...)
	if err != nil {
		return nil, fmt.Errorf("query revenue timeseries rollup: %w", err)
	}
	defer rows.Close()

	points := []storage.RevenuePoint{}
	for rows.Next() {
		var p storage.RevenuePoint
		if err := rows.Scan(&p.Bucket, &p.Revenue, &p.Transactions, &p.PayingUsers); err != nil {
			return nil, fmt.Errorf("scan revenue point rollup: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}
