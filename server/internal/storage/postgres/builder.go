package postgres

import (
	"strconv"
	"strings"
	"time"

	"github.com/bananalytics/server/internal/storage"
)

// argList accumulates the positional parameters of a query being assembled.
//
// Every caller-supplied value — including the JSON path segments of a dimension —
// goes through bind, so nothing from a request is ever interpolated into SQL.
type argList struct {
	args []any
}

// bind stores a value and returns the placeholder that refers to it.
func (a *argList) bind(v any) string {
	a.args = append(a.args, v)
	return "$" + strconv.Itoa(len(a.args))
}

// eventsTable is the relation every analytics query reads from.
//
// The view adds person_id, which resolves a device's anonymous ID to the user it
// belongs to. Counting people rather than devices is what keeps someone who
// browsed anonymously and then signed in from being counted twice.
const eventsTable = "events_resolved"

// qualify prefixes a column with a table alias when one is in play.
func qualify(alias, column string) string {
	if alias == "" {
		return column
	}
	return alias + "." + column
}

// dimensionExpr renders a dimension as a text-valued SQL expression, binding
// each JSON path segment as a parameter.
func dimensionExpr(d storage.Dimension, alias string, a *argList) string {
	expr := qualify(alias, d.Column)
	for i, segment := range d.Path {
		// The final segment uses ->> so the result is text rather than JSONB.
		if i == len(d.Path)-1 {
			expr += "->>" + a.bind(segment)
		} else {
			expr += "->" + a.bind(segment)
		}
	}
	return expr
}

// personColumn identifies the human an event belongs to, after identity merging.
func personColumn(alias string) string {
	return qualify(alias, "person_id")
}

// scopeOf turns the shared query parameters into a scope.
func scopeOf(p storage.QueryParams) scope {
	return scope{
		ProjectID: p.ProjectID,
		From:      p.From,
		To:        p.To,
		Event:     p.Event,
		Filters:   p.Filters,
	}
}

// scope holds the WHERE conditions shared by every analytics query.
type scope struct {
	ProjectID string
	From      time.Time
	To        time.Time
	Event     string
	Filters   []storage.DimensionFilter
}

// where renders the scope as a WHERE clause body for the given table alias.
// The time range is applied to created_at, the partition key, so Postgres can
// prune partitions before doing any work.
func (s scope) where(alias string, a *argList) string {
	clauses := []string{
		qualify(alias, "project_id") + " = " + a.bind(s.ProjectID),
		qualify(alias, "created_at") + " >= " + a.bind(s.From),
		qualify(alias, "created_at") + " <= " + a.bind(s.To),
	}

	if s.Event != "" {
		clauses = append(clauses, qualify(alias, "event")+" = "+a.bind(s.Event))
	}

	for _, filter := range s.Filters {
		clauses = append(clauses, dimensionExpr(filter.Dimension, alias, a)+" = "+a.bind(filter.Value))
	}

	return strings.Join(clauses, " AND ")
}
