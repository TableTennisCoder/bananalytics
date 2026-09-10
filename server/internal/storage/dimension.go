package storage

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	// MaxDimensionDepth caps how deep a dimension may reach into a JSON column.
	MaxDimensionDepth = 3
	// MaxFilters caps how many filters a single query may carry.
	MaxFilters = 10
	// MaxBreakdownValues caps how many distinct values a breakdown returns.
	MaxBreakdownValues = 100
)

// dimensionSegment matches a single safe JSON path segment. Dimension keys come
// from the caller, so they are validated up front and then only ever reach SQL
// as bind parameters — never as interpolated text.
var dimensionSegment = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// jsonColumns are the events columns a dimension may read a JSON path from.
var jsonColumns = map[string]bool{"properties": true, "context": true, "geo": true}

// Dimension is a validated breakdown or filter key, resolved to the events
// column and JSON path where its values live.
type Dimension struct {
	// Key is the user-facing name, e.g. "platform" or "properties.plan".
	Key string `json:"key"`
	// Label is a human-readable name for the dashboard.
	Label string `json:"label"`
	// Column is the events column holding the value.
	Column string `json:"-"`
	// Path is the JSON path within Column; empty for plain columns.
	Path []string `json:"-"`
	// Group buckets related dimensions in the dashboard picker.
	Group string `json:"group"`
}

// DimensionFilter narrows a query to rows where a dimension equals a value.
type DimensionFilter struct {
	Dimension Dimension
	Value     string
}

// builtinDimensions are the shorthands that map to what the SDK sends in every
// event's context, so the common breakdowns need no knowledge of the JSON shape.
var builtinDimensions = map[string]Dimension{
	"event":        {Label: "Event Name", Column: "event", Group: "Event"},
	"type":         {Label: "Event Type", Column: "type", Group: "Event"},
	"currency":     {Label: "Currency", Column: "currency", Group: "Revenue"},
	"platform":     {Label: "Platform", Column: "context", Path: []string{"device", "os"}, Group: "Device"},
	"os_version":   {Label: "OS Version", Column: "context", Path: []string{"device", "osVersion"}, Group: "Device"},
	"device_model": {Label: "Device Model", Column: "context", Path: []string{"device", "model"}, Group: "Device"},
	"manufacturer": {Label: "Manufacturer", Column: "context", Path: []string{"device", "manufacturer"}, Group: "Device"},
	"app_version":  {Label: "App Version", Column: "context", Path: []string{"app", "version"}, Group: "App"},
	"app_build":    {Label: "App Build", Column: "context", Path: []string{"app", "build"}, Group: "App"},
	"app_name":     {Label: "App Name", Column: "context", Path: []string{"app", "name"}, Group: "App"},
	"locale":       {Label: "Locale", Column: "context", Path: []string{"locale"}, Group: "App"},
	"timezone":     {Label: "Timezone", Column: "context", Path: []string{"timezone"}, Group: "App"},
	"country":      {Label: "Country", Column: "geo", Path: []string{"country"}, Group: "Location"},
	"country_code": {Label: "Country Code", Column: "geo", Path: []string{"country_code"}, Group: "Location"},
	"city":         {Label: "City", Column: "geo", Path: []string{"city"}, Group: "Location"},
}

// ParseDimension validates a caller-supplied dimension key. Besides the built-in
// shorthands it accepts explicit JSON paths such as "properties.plan" or
// "context.device.os".
func ParseDimension(key string) (Dimension, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return Dimension{}, fmt.Errorf("dimension key is required")
	}

	if dim, ok := builtinDimensions[key]; ok {
		dim.Key = key
		return dim, nil
	}

	segments := strings.Split(key, ".")
	if len(segments) < 2 {
		return Dimension{}, fmt.Errorf("unknown dimension %q", key)
	}
	if len(segments) > MaxDimensionDepth {
		return Dimension{}, fmt.Errorf("dimension %q is nested too deeply (max %d levels)", key, MaxDimensionDepth)
	}

	column := segments[0]
	if !jsonColumns[column] {
		return Dimension{}, fmt.Errorf("unknown dimension %q: expected a built-in key or a properties/context/geo path", key)
	}

	path := segments[1:]
	for _, segment := range path {
		if !dimensionSegment.MatchString(segment) {
			return Dimension{}, fmt.Errorf("invalid dimension %q: %q is not a valid path segment", key, segment)
		}
	}

	return Dimension{
		Key:    key,
		Label:  path[len(path)-1],
		Column: column,
		Path:   path,
		Group:  "Custom",
	}, nil
}

// ParseFilters parses repeated "key:value" filter parameters. The value may
// contain colons; only the first one separates key from value.
func ParseFilters(raw []string) ([]DimensionFilter, error) {
	if len(raw) > MaxFilters {
		return nil, fmt.Errorf("too many filters: max %d", MaxFilters)
	}

	filters := make([]DimensionFilter, 0, len(raw))
	for _, entry := range raw {
		if strings.TrimSpace(entry) == "" {
			continue
		}

		key, value, found := strings.Cut(entry, ":")
		if !found {
			return nil, fmt.Errorf("invalid filter %q: expected key:value", entry)
		}

		dim, err := ParseDimension(key)
		if err != nil {
			return nil, err
		}
		filters = append(filters, DimensionFilter{Dimension: dim, Value: value})
	}
	return filters, nil
}

// BuiltinDimensions returns the predefined dimensions sorted by key.
func BuiltinDimensions() []Dimension {
	dims := make([]Dimension, 0, len(builtinDimensions))
	for key, dim := range builtinDimensions {
		dim.Key = key
		dims = append(dims, dim)
	}
	sort.Slice(dims, func(i, j int) bool { return dims[i].Key < dims[j].Key })
	return dims
}

// NotSetValue is the placeholder used when a dimension has no value on an event.
const NotSetValue = "(not set)"

// FunnelSegment is one funnel computed for a single value of a breakdown
// dimension, so segments can be compared against each other.
type FunnelSegment struct {
	Value string       `json:"value"`
	Steps []FunnelStep `json:"steps"`
}

// BreakdownBucket is one value of a dimension with its aggregates.
type BreakdownBucket struct {
	Value       string `json:"value"`
	Count       int    `json:"count"`
	UniqueUsers int    `json:"unique_users"`
	// Revenue is what this segment brought in, which is what turns a breakdown
	// from "where are the users" into "where is the money".
	Revenue     float64 `json:"revenue"`
	PayingUsers int     `json:"paying_users"`
}

// BreakdownParams describes a "group by dimension" query.
type BreakdownParams struct {
	ProjectID string
	Dimension Dimension
	Event     string
	From      time.Time
	To        time.Time
	Filters   []DimensionFilter
	Limit     int
}
