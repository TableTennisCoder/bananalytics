import type { StatsOverview } from "@/types/charts";
import type {
  EventResult,
  TimeseriesPoint,
  TopEvent,
} from "@/types/events";
import type { FunnelResponse, FunnelStep } from "@/types/funnel";
import type { BreakdownResponse, Dimension } from "@/types/dimensions";
import type { ActiveUsersPoint } from "@/types/active-users";
import type { RevenuePoint, RevenueSummary } from "@/types/revenue";
import type { RetentionCohort } from "@/types/retention";
import type { Session } from "@/types/sessions";
import type { GeoData, LiveData } from "@/types/geo";
import type { Project } from "@/types/projects";

// ── Seed-based pseudo-random for deterministic data ──────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function randomId() {
  const chars = "abcdef0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(rand() * chars.length)];
  return id;
}

function uuid() {
  const h = "0123456789abcdef";
  let u = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) u += "-";
    else if (i === 14) u += "4";
    else u += h[Math.floor(rand() * 16)];
  }
  return u;
}

// ── Constants ────────────────────────────────────────────────────────────────

const EVENT_NAMES = [
  "screen_view",
  "button_click",
  "purchase_complete",
  "signup_started",
  "signup_completed",
  "add_to_cart",
  "search",
  "share",
];

const EVENT_TYPES = ["track", "track", "track", "track", "track", "screen"] as const;

const SCREENS = ["HomeScreen", "ProfileScreen", "SettingsScreen", "CartScreen", "SearchScreen"];

const COUNTRIES: GeoData[] = [
  { country: "United States", country_code: "US", city: "", count: 8420, unique_users: 1230, lat: 37.09, lng: -95.71 },
  { country: "Germany", country_code: "DE", city: "", count: 3150, unique_users: 485, lat: 51.17, lng: 10.45 },
  { country: "United Kingdom", country_code: "GB", city: "", count: 2840, unique_users: 412, lat: 55.38, lng: -3.44 },
  { country: "Brazil", country_code: "BR", city: "", count: 2100, unique_users: 310, lat: -14.24, lng: -51.93 },
  { country: "Japan", country_code: "JP", city: "", count: 1890, unique_users: 275, lat: 36.2, lng: 138.25 },
  { country: "India", country_code: "IN", city: "", count: 1650, unique_users: 240, lat: 20.59, lng: 78.96 },
  { country: "France", country_code: "FR", city: "", count: 1420, unique_users: 208, lat: 46.23, lng: 2.21 },
  { country: "Canada", country_code: "CA", city: "", count: 1180, unique_users: 172, lat: 56.13, lng: -106.35 },
  { country: "Australia", country_code: "AU", city: "", count: 980, unique_users: 143, lat: -25.27, lng: 133.78 },
  { country: "Spain", country_code: "ES", city: "", count: 720, unique_users: 105, lat: 40.46, lng: -3.75 },
  { country: "South Korea", country_code: "KR", city: "", count: 540, unique_users: 79, lat: 35.91, lng: 127.77 },
  { country: "Netherlands", country_code: "NL", city: "", count: 410, unique_users: 60, lat: 52.13, lng: 5.29 },
];

const CITIES: GeoData[] = [
  { country: "United States", country_code: "US", city: "San Francisco", count: 2840, unique_users: 415, lat: 37.77, lng: -122.42 },
  { country: "United States", country_code: "US", city: "New York", count: 2210, unique_users: 322, lat: 40.71, lng: -74.01 },
  { country: "Germany", country_code: "DE", city: "Berlin", count: 1680, unique_users: 245, lat: 52.52, lng: 13.41 },
  { country: "United Kingdom", country_code: "GB", city: "London", count: 1540, unique_users: 225, lat: 51.51, lng: -0.13 },
  { country: "Brazil", country_code: "BR", city: "São Paulo", count: 1120, unique_users: 164, lat: -23.55, lng: -46.63 },
  { country: "Japan", country_code: "JP", city: "Tokyo", count: 1050, unique_users: 153, lat: 35.68, lng: 139.69 },
  { country: "France", country_code: "FR", city: "Paris", count: 890, unique_users: 130, lat: 48.86, lng: 2.35 },
  { country: "India", country_code: "IN", city: "Mumbai", count: 780, unique_users: 114, lat: 19.08, lng: 72.88 },
  { country: "Canada", country_code: "CA", city: "Toronto", count: 650, unique_users: 95, lat: 43.65, lng: -79.38 },
  { country: "United States", country_code: "US", city: "Austin", count: 580, unique_users: 85, lat: 30.27, lng: -97.74 },
  { country: "Australia", country_code: "AU", city: "Sydney", count: 520, unique_users: 76, lat: -33.87, lng: 151.21 },
  { country: "Germany", country_code: "DE", city: "Munich", count: 480, unique_users: 70, lat: 48.14, lng: 11.58 },
  { country: "Spain", country_code: "ES", city: "Barcelona", count: 410, unique_users: 60, lat: 41.39, lng: 2.17 },
  { country: "South Korea", country_code: "KR", city: "Seoul", count: 380, unique_users: 56, lat: 37.57, lng: 126.98 },
  { country: "Netherlands", country_code: "NL", city: "Amsterdam", count: 310, unique_users: 45, lat: 52.37, lng: 4.9 },
];

/**
 * The project the demo pretends to be looking at.
 *
 * Settings and the project switcher describe a project rather than events, so
 * they need one to render. The keys are obviously fake on purpose — nobody
 * should mistake a demo key for a working one.
 */
export const DEMO_PROJECT: Project = {
  id: "00000000-0000-4000-8000-000000000demo",
  name: "Demo App",
  write_key: "rk_demo_write_key_not_a_real_key",
  secret_key: "sk_demo_secret_key_not_a_real_key",
  created_at: "2026-01-15T09:00:00Z",
  updated_at: "2026-01-15T09:00:00Z",
};

// ── Segments ─────────────────────────────────────────────────────────────────

/**
 * The slice of traffic the active filters select.
 *
 * The demo has no database to query, so instead of filtering rows it scales the
 * numbers: a segment that makes up 38% of traffic shows 38% of the events, and
 * a segment that converts badly shows proportionally less revenue. Without this
 * the filter bar would appear to do nothing, which is the opposite of the point.
 */
interface Segment {
  /** Share of overall traffic, 0-1. */
  volume: number;
  /** How well this segment converts and pays, relative to average. */
  strength: number;
  /** The active filters as key/value pairs. */
  filters: Array<[string, string]>;
}

/** Builds a segment from a list of key/value filters. */
function segmentOf(filters: Array<[string, string]>): Segment {
  let volume = 1;
  let strength = 1;

  for (const [key, value] of filters) {
    const share = DEMO_DIMENSION_VALUES[key]?.find(([candidate]) => candidate === value)?.[1];
    // An unrecognised value becomes a small slice rather than nothing, so the
    // dashboard still has something to draw.
    volume *= share !== undefined ? share / 100 : 0.15;
    strength *= segmentStrength(value);
  }

  return { volume, strength, filters };
}

/** Reads the repeated `filter=key:value` parameters into a segment. */
function parseSegment(params: URLSearchParams): Segment {
  return segmentOf(
    params
      .getAll("filter")
      .map((entry) => {
        const separator = entry.indexOf(":");
        if (separator === -1) return null;
        return [entry.slice(0, separator), entry.slice(separator + 1)] as [string, string];
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );
}

/**
 * The same segment with the given dimensions dropped from the scaling.
 *
 * Where a view filters by removing rows — a map showing one country, a ranking
 * showing one event — the remaining rows must keep their own size. Scaling them
 * by that dimension's share as well would count the filter twice.
 */
function without(segment: Segment, ...keys: string[]): Segment {
  return segmentOf(segment.filters.filter(([key]) => !keys.includes(key)));
}

/**
 * Scales a count into the segment. `weighted` also applies the segment's
 * conversion strength, which is what makes revenue differ from raw volume.
 */
function scale(value: number, segment: Segment, weighted = false): number {
  const scaled = value * segment.volume * (weighted ? segment.strength : 1);
  // Keep a non-empty segment from rounding down to zero and looking like no data.
  return scaled > 0 && scaled < 1 ? 1 : Math.round(scaled);
}

/** Same as scale, but keeps two decimals for money. */
function scaleMoney(value: number, segment: Segment): number {
  return Math.round(value * segment.volume * segment.strength * 100) / 100;
}

/** Returns the value a filter pins the given dimension to, if any. */
function filterValue(segment: Segment, key: string): string | undefined {
  return segment.filters.find(([candidate]) => candidate === key)?.[1];
}

// ── Generators ───────────────────────────────────────────────────────────────

function generateStats(segment: Segment): StatsOverview {
  return {
    total_events: scale(24831, segment),
    unique_users: scale(3412, segment),
    active_sessions: scale(47, segment),
    events_per_minute: Math.round(12.4 * segment.volume * 10) / 10,
    // Filtering to a country makes that country the leading one by definition.
    top_country: filterValue(segment, "country") ?? "United States",
    revenue: scaleMoney(4218.6, segment),
    top_currency: "EUR",
  };
}

function generateTimeseries(segment: Segment): { timeseries: TimeseriesPoint[] } {
  const now = new Date();
  const points: TimeseriesPoint[] = [];
  for (let i = 167; i >= 0; i--) {
    const bucket = new Date(now.getTime() - i * 3600000);
    const hour = bucket.getHours();
    // Sinusoidal pattern: low at night (3am), high in afternoon (3pm)
    const base = 80 + 60 * Math.sin(((hour - 3) / 24) * Math.PI * 2);
    const noise = (rand() - 0.5) * 40;
    const count = scale(Math.max(5, Math.round(base + noise)), segment);
    points.push({
      bucket: bucket.toISOString(),
      count,
      // People generate several events per visit, so this trails the event count.
      unique_users: Math.max(1, Math.round(count / 3.4)),
    });
  }
  return { timeseries: points };
}

function generateTopEvents(segment: Segment): { events: TopEvent[] } {
  const counts: [string, number, number][] = [
    ["screen_view", 8420, 1980],
    ["button_click", 5230, 1640],
    ["add_to_cart", 3150, 1210],
    ["search", 2840, 1050],
    ["signup_started", 2100, 2040],
    ["purchase_complete", 1650, 1490],
    ["signup_completed", 980, 975],
    ["share", 461, 402],
  ];

  // Filtering to one event name leaves a ranking of exactly that event, which
  // keeps its own volume — only the other filters scale it.
  const pinned = filterValue(segment, "event");
  const rows = pinned ? counts.filter(([event]) => event === pinned) : counts;
  const rest = without(segment, "event");

  return {
    events: rows.map(([event, count, unique_users]) => ({
      event,
      count: scale(count, rest),
      unique_users: scale(unique_users, rest),
    })),
  };
}

function generateEventNames(): { names: string[] } {
  return { names: EVENT_NAMES };
}

// A coherent user journey for demo purposes
const JOURNEY_EVENTS: Array<{ event: string; type: EventResult["type"]; properties: Record<string, unknown>; delay: number }> = [
  { event: "app_opened", type: "track", properties: { first_open: true }, delay: 0 },
  { event: "screen_view", type: "screen", properties: { screen: "HomeScreen" }, delay: 3000 },
  { event: "screen_view", type: "screen", properties: { screen: "SearchScreen" }, delay: 18000 },
  { event: "search", type: "track", properties: { query: "running shoes", results_count: 24 }, delay: 25000 },
  { event: "screen_view", type: "screen", properties: { screen: "ProductScreen" }, delay: 32000 },
  { event: "button_click", type: "track", properties: { button: "view_details" }, delay: 38000 },
  { event: "screen_view", type: "screen", properties: { screen: "ProductDetailScreen" }, delay: 40000 },
  { event: "add_to_cart", type: "track", properties: { product_id: "prod_8f2a1c", quantity: 1, price: 89.99 }, delay: 65000 },
  { event: "screen_view", type: "screen", properties: { screen: "CartScreen" }, delay: 68000 },
  { event: "button_click", type: "track", properties: { button: "checkout" }, delay: 82000 },
  { event: "screen_view", type: "screen", properties: { screen: "CheckoutScreen" }, delay: 84000 },
  { event: "purchase_complete", type: "track", properties: { order_id: "ord_x7k2m", total: 89.99, currency: "USD" }, delay: 120000 },
  { event: "screen_view", type: "screen", properties: { screen: "OrderConfirmationScreen" }, delay: 122000 },
  { event: "share", type: "track", properties: { content_type: "order", share_method: "instagram" }, delay: 145000 },
  { event: "screen_view", type: "screen", properties: { screen: "HomeScreen" }, delay: 180000 },
];

function generateEvents(userId?: string): { events: EventResult[] } {
  // If a specific user is requested, return a coherent journey
  if (userId) {
    const baseTime = Date.now() - 3600000; // 1 hour ago
    const sessionId = "sess_a1b2c3d4";
    const anonId = "8f2a1c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    const events: EventResult[] = JOURNEY_EVENTS.map((je, i) => ({
      id: `journey-${i}-${je.event}`,
      event: je.event,
      type: je.type,
      properties: je.properties,
      user_id: userId,
      anonymous_id: anonId,
      timestamp: new Date(baseTime + je.delay).toISOString(),
      session_id: sessionId,
    }));
    return { events };
  }

  // Generic events list
  const now = Date.now();
  const events: EventResult[] = [];
  for (let i = 0; i < 50; i++) {
    const eventName = EVENT_NAMES[Math.floor(rand() * EVENT_NAMES.length)];
    const type = eventName === "screen_view" ? "screen" : EVENT_TYPES[Math.floor(rand() * EVENT_TYPES.length)];
    const uid = rand() > 0.3 ? `user_${1000 + Math.floor(rand() * 3000)}` : "";
    const ts = new Date(now - Math.floor(rand() * 86400000));
    events.push({
      id: uuid(),
      event: eventName,
      type,
      properties: eventName === "screen_view"
        ? { screen: SCREENS[Math.floor(rand() * SCREENS.length)] }
        : eventName === "purchase_complete"
          ? { amount: Math.round(rand() * 200 * 100) / 100, currency: "USD" }
          : eventName === "add_to_cart"
            ? { product_id: `prod_${randomId()}`, quantity: Math.ceil(rand() * 3) }
            : eventName === "search"
              ? { query: ["shoes", "headphones", "laptop", "backpack", "camera"][Math.floor(rand() * 5)] }
              : {},
      user_id: uid,
      anonymous_id: uuid(),
      timestamp: ts.toISOString(),
      session_id: `sess_${randomId()}`,
    });
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { events };
}

function generateLive(segment: Segment): LiveData {
  const now = Date.now();
  const recent: LiveData["recent_events"] = [];
  for (let i = 0; i < 15; i++) {
    const eventName = EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)];
    recent.push({
      id: uuid(),
      event: eventName,
      type: eventName === "screen_view" ? "screen" : "track",
      properties: {},
      user_id: Math.random() > 0.3 ? `user_${1000 + Math.floor(Math.random() * 3000)}` : null,
      anonymous_id: uuid(),
      timestamp: new Date(now - i * (2000 + Math.floor(Math.random() * 8000))).toISOString(),
      session_id: `sess_${randomId()}`,
    });
  }
  return {
    active_users: scale(23 + Math.floor(Math.random() * 10), segment),
    events_last_minute: scale(8 + Math.floor(Math.random() * 6), segment),
    recent_events: recent,
  };
}

function generateGeo(groupBy: string | undefined, segment: Segment): { geo: GeoData[] } {
  const rows = groupBy === "city" ? CITIES : COUNTRIES;

  // A location filter narrows the map to that place, which is the filtering
  // itself — only the other filters scale what is left.
  const country = filterValue(segment, "country");
  const city = filterValue(segment, "city");
  const elsewhere = without(segment, "country", "city");

  return {
    geo: rows
      .filter((row) => (!country || row.country === country) && (!city || row.city === city))
      .map((row) => ({
        ...row,
        count: scale(row.count, elsewhere),
        unique_users: scale(row.unique_users, elsewhere),
      })),
  };
}

// Realistic drop-off rates per step position (each step retains 40-70%).
const FUNNEL_DROP_RATES = [1.0, 0.68, 0.55, 0.62, 0.58, 0.5, 0.45, 0.4];
// Median time to reach each step from the previous one, in seconds.
const FUNNEL_MEDIANS = [0, 42, 890, 3600, 7200, 14400, 28800, 86400];

/**
 * Builds funnel steps from an entry count, applying the drop-off curve.
 * `strength` scales how well the segment converts relative to the baseline.
 */
function buildFunnelSteps(steps: string[], entered: number, strength = 1): FunnelStep[] {
  const counts: number[] = [];
  let count = entered;

  steps.forEach((_, i) => {
    if (i > 0) {
      const rate = Math.min((FUNNEL_DROP_RATES[i] ?? 0.5) * strength, 0.98);
      count = Math.round(count * rate);
    }
    counts[i] = count;
  });

  const first = counts[0];
  return steps.map((step, i) => ({
    step,
    count: counts[i],
    conversion_rate: first > 0 ? (counts[i] / first) * 100 : 0,
    step_conversion_rate:
      i === 0
        ? first > 0
          ? 100
          : 0
        : counts[i - 1] > 0
          ? (counts[i] / counts[i - 1]) * 100
          : 0,
    dropped: i === 0 ? 0 : counts[i - 1] - counts[i],
    median_seconds_from_prev: i === 0 ? undefined : (FUNNEL_MEDIANS[i] ?? 3600),
  }));
}

function generateFunnel(
  stepsParam: string | undefined,
  windowParam: string | undefined,
  breakdownParam: string | undefined,
  segment: Segment,
): FunnelResponse {
  const steps = stepsParam
    ? stepsParam.split(",")
    : ["signup_started", "signup_completed", "purchase_complete"];

  const windowSeconds: Record<string, number> = {
    "1h": 3600,
    "24h": 86400,
    "7d": 604800,
    "30d": 2592000,
    none: 0,
  };

  const entered = scale(2480, segment);

  const response: FunnelResponse = {
    funnel: buildFunnelSteps(steps, entered, segment.strength),
    window_seconds: windowSeconds[windowParam ?? "7d"] ?? 604800,
  };

  if (breakdownParam) {
    const shares = DEMO_DIMENSION_VALUES[breakdownParam] ?? [];
    // A filter on the same dimension the funnel is split by leaves one segment.
    const pinned = filterValue(segment, breakdownParam);
    const visible = pinned ? shares.filter(([value]) => value === pinned) : shares.slice(0, 8);

    response.breakdown = breakdownParam;
    response.segments = visible.map(([value, share]) => ({
      value,
      steps: buildFunnelSteps(
        steps,
        Math.max(1, Math.round((entered * share) / 100)),
        segment.strength * segmentStrength(value),
      ),
    }));
  }

  return response;
}

function generateRetention(): { retention: RetentionCohort[] } {
  const cohorts: RetentionCohort[] = [];
  for (let d = 6; d >= 0; d--) {
    const cohortDate = new Date();
    cohortDate.setDate(cohortDate.getDate() - d - 7);
    const cohort = cohortDate.toISOString().split("T")[0];
    const cohortSize = 80 + Math.floor(rand() * 60);
    for (let p = 0; p <= 6 - d; p++) {
      const decay = Math.pow(0.72, p); // ~72% retention per period
      const noise = 1 + (rand() - 0.5) * 0.1;
      const retained = p === 0 ? cohortSize : Math.round(cohortSize * decay * noise);
      cohorts.push({ cohort, cohort_size: cohortSize, period: p, retained });
    }
  }
  return { retention: cohorts };
}

function generateSessions(): { sessions: Session[] } {
  const now = Date.now();
  const sessions: Session[] = [];
  for (let i = 0; i < 10; i++) {
    const startOffset = Math.floor(rand() * 7 * 86400000);
    const duration = 120 + Math.floor(rand() * 1800);
    const startedAt = new Date(now - startOffset);
    const endedAt = i === 0 ? null : new Date(startedAt.getTime() + duration * 1000);
    sessions.push({
      session_id: `sess_${randomId()}`,
      user_id: "user_1842",
      started_at: startedAt.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : "",
      event_count: 3 + Math.floor(rand() * 25),
    });
  }
  sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return { sessions };
}

// ── Dimensions & breakdowns ──────────────────────────────────────────────────

/** Plausible value distributions per dimension, ordered by size. */
const DEMO_DIMENSION_VALUES: Record<string, [string, number][]> = {
  platform: [["ios", 62], ["android", 38]],
  os_version: [["17.4", 34], ["17.2", 26], ["14", 22], ["16.6", 18]],
  device_model: [["iPhone 15", 28], ["Pixel 8", 21], ["iPhone 13", 19], ["Galaxy S23", 17], ["iPhone SE", 15]],
  manufacturer: [["Apple", 62], ["Samsung", 21], ["Google", 17]],
  app_version: [["2.1.0", 58], ["2.0.4", 27], ["1.9.2", 15]],
  app_build: [["412", 58], ["408", 27], ["390", 15]],
  app_name: [["Bananalytics Demo", 100]],
  locale: [["en-US", 41], ["de-DE", 27], ["fr-FR", 16], ["es-ES", 16]],
  timezone: [["Europe/Berlin", 34], ["America/New_York", 29], ["Europe/London", 21], ["Asia/Tokyo", 16]],
  country: [["Germany", 31], ["United States", 27], ["United Kingdom", 16], ["France", 14], ["Japan", 12]],
  country_code: [["DE", 31], ["US", 27], ["GB", 16], ["FR", 14], ["JP", 12]],
  city: [["Berlin", 22], ["New York", 20], ["London", 16], ["Paris", 14], ["Tokyo", 12], ["Munich", 8]],
  event: [["screen_view", 44], ["signup_started", 21], ["add_to_cart", 19], ["purchase_complete", 16]],
  type: [["track", 71], ["screen", 25], ["identify", 4]],
  "properties.plan": [["free", 74], ["pro", 21], ["team", 5]],
  "properties.source": [["organic", 46], ["app_store", 28], ["referral", 16], ["paid_ads", 10]],
};

const DEMO_DIMENSIONS: Dimension[] = [
  { key: "app_build", label: "App Build", group: "App" },
  { key: "app_name", label: "App Name", group: "App" },
  { key: "app_version", label: "App Version", group: "App" },
  { key: "city", label: "City", group: "Location" },
  { key: "country", label: "Country", group: "Location" },
  { key: "country_code", label: "Country Code", group: "Location" },
  { key: "device_model", label: "Device Model", group: "Device" },
  { key: "event", label: "Event Name", group: "Event" },
  { key: "locale", label: "Locale", group: "App" },
  { key: "manufacturer", label: "Manufacturer", group: "Device" },
  { key: "os_version", label: "OS Version", group: "Device" },
  { key: "platform", label: "Platform", group: "Device" },
  { key: "timezone", label: "Timezone", group: "App" },
  { key: "type", label: "Event Type", group: "Event" },
  { key: "properties.plan", label: "plan", group: "Custom" },
  { key: "properties.source", label: "source", group: "Custom" },
];

function generateDimensions(): { dimensions: Dimension[] } {
  return { dimensions: DEMO_DIMENSIONS };
}

function generateBreakdown(key: string | null, segment: Segment): BreakdownResponse {
  const dimensionKey = key ?? "platform";
  const all = DEMO_DIMENSION_VALUES[dimensionKey] ?? [["(not set)", 100] as [string, number]];

  // Breaking down by a dimension that is already filtered leaves that one value,
  // the same way the real query would.
  const pinned = filterValue(segment, dimensionKey);
  const shares = pinned ? all.filter(([value]) => value === pinned) : all;

  const totalEvents = scale(48_500, segment);

  return {
    key: dimensionKey,
    label: DEMO_DIMENSIONS.find((d) => d.key === dimensionKey)?.label ?? dimensionKey,
    breakdown: shares.map(([value, share]) => {
      // A pinned value carries the whole (already scaled) volume of the segment.
      const count = pinned ? totalEvents : Math.round((totalEvents * share) / 100);
      // Roughly 6 events per person, with a little variation per bucket.
      const uniqueUsers = Math.round(count / (5.5 + (share % 3) * 0.4));
      // Revenue tracks the segment's conversion strength, not just its size, so
      // the biggest segment is not automatically the most valuable one.
      const strength = segmentStrength(value);
      const payingUsers = Math.round(uniqueUsers * 0.06 * strength);

      return {
        value,
        count,
        unique_users: uniqueUsers,
        revenue: Math.round(payingUsers * 21.4 * strength * 100) / 100,
        paying_users: payingUsers,
      };
    }),
  };
}

/** Per-segment conversion multipliers, so segments differ in a believable way. */
function segmentStrength(value: string): number {
  const strengths: Record<string, number> = {
    ios: 1.25,
    android: 0.72,
    pro: 1.6,
    team: 1.8,
    free: 0.85,
    organic: 1.3,
    paid_ads: 0.6,
  };
  return strengths[value] ?? 0.9 + (value.length % 5) * 0.08;
}

/**
 * A growing audience with weekday seasonality. WAU and MAU are derived from DAU
 * with the ratios a healthy consumer app tends to show (roughly 3.5x and 9x),
 * so the stickiness figure lands in a believable range.
 */
function generateActiveUsers(segment: Segment): { active_users: ActiveUsersPoint[] } {
  const points: ActiveUsersPoint[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    // Weekends dip; the baseline grows slowly across the month.
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const growth = 1 + (29 - i) * 0.012;
    const dau = scale(1180 * growth * (weekend ? 0.78 : 1) * (0.95 + rand() * 0.1), segment);
    const wau = Math.round(dau * 3.4 * (0.98 + rand() * 0.04));
    const mau = Math.round(dau * 8.8 * (0.98 + rand() * 0.04));

    points.push({
      bucket: day.toISOString().split("T")[0],
      dau,
      wau,
      mau,
      stickiness: (dau / mau) * 100,
    });
  }

  return { active_users: points };
}

/**
 * A month of revenue that mirrors the DAU curve: weekday-heavy, slowly growing,
 * with a small share of people paying.
 */
function generateRevenue(currency: string | null, segment: Segment): RevenueSummary {
  const points: RevenuePoint[] = [];
  const today = new Date();
  let totalRevenue = 0;
  let transactions = 0;

  for (let i = 29; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const growth = 1 + (29 - i) * 0.014;
    const dayTransactions = scale(46 * growth * (weekend ? 0.72 : 1) * (0.9 + rand() * 0.2), segment, true);
    const dayRevenue = Math.round(dayTransactions * (17 + rand() * 9) * 100) / 100;

    totalRevenue += dayRevenue;
    transactions += dayTransactions;

    points.push({
      bucket: day.toISOString().split("T")[0],
      revenue: dayRevenue,
      transactions: dayTransactions,
      paying_users: Math.round(dayTransactions * 0.82),
    });
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  const payingUsers = Math.round(transactions * 0.74);
  // Active people scale with raw volume, paying ones with conversion strength —
  // that gap is what ARPU and the paying share are meant to show.
  const activeUsers = Math.max(1, scale(12_400, segment));

  return {
    currency: currency || "EUR",
    available_currencies: ["EUR", "USD"],
    total_revenue: totalRevenue,
    transactions,
    paying_users: payingUsers,
    active_users: activeUsers,
    arpu: totalRevenue / activeUsers,
    arppu: totalRevenue / payingUsers,
    average_order_value: totalRevenue / transactions,
    paying_share: (payingUsers / activeUsers) * 100,
    timeseries: points,
  };
}

// ── Router ───────────────────────────────────────────────────────────────────

export function getDemoResponse(path: string): unknown {
  // Parse path and query string
  const [pathPart, queryString] = path.split("?");
  const cleanPath = pathPart.replace(/^\/query\//, "");
  const params = new URLSearchParams(queryString || "");

  // Every endpoint honours the active filters, so the filter bar visibly moves
  // the numbers instead of leaving the demo looking static.
  const segment = parseSegment(params);

  switch (cleanPath) {
    case "stats":
      return generateStats(segment);
    case "events/timeseries":
      return generateTimeseries(segment);
    case "events/top":
      return generateTopEvents(segment);
    case "events/names":
      return generateEventNames();
    case "events":
      return generateEvents(params.get("user_id") || undefined);
    case "live":
      return generateLive(segment);
    case "geo":
      return generateGeo(params.get("group_by") || undefined, segment);
    case "funnel":
      return generateFunnel(
        params.get("steps") || undefined,
        params.get("window") || undefined,
        params.get("breakdown") || undefined,
        segment,
      );
    case "breakdown":
      return generateBreakdown(params.get("key"), segment);
    case "dimensions":
      return generateDimensions();
    case "active-users":
      return generateActiveUsers(segment);
    case "revenue":
      return generateRevenue(params.get("currency"), segment);
    case "retention":
      return generateRetention();
    case "sessions":
      return generateSessions();
    default:
      return {};
  }
}
