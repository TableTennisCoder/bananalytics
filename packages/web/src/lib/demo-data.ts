import type { StatsOverview } from "@/types/charts";
import type {
  EventResult,
  TimeseriesPoint,
  TopEvent,
} from "@/types/events";
import type { FunnelStep } from "@/types/funnel";
import type { RetentionCohort } from "@/types/retention";
import type { Session } from "@/types/sessions";
import type { GeoData, LiveData } from "@/types/geo";

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

// ── Generators ───────────────────────────────────────────────────────────────

function generateStats(): StatsOverview {
  return {
    total_events: 24831,
    unique_users: 3412,
    active_sessions: 47,
    events_per_minute: 12.4,
    top_country: "United States",
  };
}

function generateTimeseries(): { timeseries: TimeseriesPoint[] } {
  const now = new Date();
  const points: TimeseriesPoint[] = [];
  for (let i = 167; i >= 0; i--) {
    const bucket = new Date(now.getTime() - i * 3600000);
    const hour = bucket.getHours();
    // Sinusoidal pattern: low at night (3am), high in afternoon (3pm)
    const base = 80 + 60 * Math.sin(((hour - 3) / 24) * Math.PI * 2);
    const noise = (rand() - 0.5) * 40;
    points.push({
      bucket: bucket.toISOString(),
      count: Math.max(5, Math.round(base + noise)),
    });
  }
  return { timeseries: points };
}

function generateTopEvents(): { events: TopEvent[] } {
  return {
    events: [
      { event: "screen_view", count: 8420 },
      { event: "button_click", count: 5230 },
      { event: "add_to_cart", count: 3150 },
      { event: "search", count: 2840 },
      { event: "signup_started", count: 2100 },
      { event: "purchase_complete", count: 1650 },
      { event: "signup_completed", count: 980 },
      { event: "share", count: 461 },
    ],
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

function generateLive(): LiveData {
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
    active_users: 23 + Math.floor(Math.random() * 10),
    events_last_minute: 8 + Math.floor(Math.random() * 6),
    recent_events: recent,
  };
}

function generateGeo(groupBy?: string): { geo: GeoData[] } {
  return { geo: groupBy === "city" ? CITIES : COUNTRIES };
}

function generateFunnel(stepsParam?: string): { funnel: FunnelStep[] } {
  const steps = stepsParam ? stepsParam.split(",") : ["signup_started", "signup_completed", "purchase_complete"];

  // Realistic drop-off rates per step position (each step retains 55-75%)
  const dropRates = [1.0, 0.68, 0.55, 0.62, 0.58, 0.50, 0.45, 0.40];
  let count = 2480;

  return {
    funnel: steps.map((step, i) => {
      if (i > 0) count = Math.round(count * (dropRates[i] ?? 0.50));
      return { step, count };
    }),
  };
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

// ── Router ───────────────────────────────────────────────────────────────────

export function getDemoResponse(path: string): unknown {
  // Parse path and query string
  const [pathPart, queryString] = path.split("?");
  const cleanPath = pathPart.replace(/^\/query\//, "");
  const params = new URLSearchParams(queryString || "");

  switch (cleanPath) {
    case "stats":
      return generateStats();
    case "events/timeseries":
      return generateTimeseries();
    case "events/top":
      return generateTopEvents();
    case "events/names":
      return generateEventNames();
    case "events":
      return generateEvents(params.get("user_id") || undefined);
    case "live":
      return generateLive();
    case "geo":
      return generateGeo(params.get("group_by") || undefined);
    case "funnel":
      return generateFunnel(params.get("steps") || undefined);
    case "retention":
      return generateRetention();
    case "sessions":
      return generateSessions();
    default:
      return {};
  }
}
