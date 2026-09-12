import type { StatsOverview } from "@/types/charts";
import type { EventResult, TimeseriesPoint, TopEvent, TimeseriesInterval } from "@/types/events";
import type { FunnelResponse } from "@/types/funnel";
import type { RetentionCohort } from "@/types/retention";
import type { Session } from "@/types/sessions";
import type { GeoData, LiveData } from "@/types/geo";
import type { BreakdownResponse, Dimension } from "@/types/dimensions";
import type { ActiveUsersResponse } from "@/types/active-users";
import type { CohortRevenueReport, RevenueSummary } from "@/types/revenue";

import { isDemoMode } from "./demo-mode";
import { getDemoResponse } from "./demo-data";

/** Typed API client for browser-side requests to Next.js API routes. */

async function fetchApi<T>(path: string): Promise<T> {
  if (isDemoMode()) {
    return getDemoResponse(path) as T;
  }
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

type QueryValue = string | number | boolean | string[] | undefined;

/**
 * Builds a query string. Array values become repeated parameters, which is how
 * the backend expects multiple `filter=key:value` entries.
 */
function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // A false flag is the same as an absent one for every endpoint here, and
    // leaving it out keeps the query string (and the cache key) clean.
    if (value === false) continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
    } else {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Filters applied on top of an endpoint's own parameters. */
export type Filters = string[] | undefined;

export const api = {
  stats: (from?: string, to?: string, filter?: Filters, compare?: boolean) =>
    fetchApi<StatsOverview>(`/query/stats${qs({ from, to, filter, compare })}`),

  timeseries: (
    from?: string,
    to?: string,
    interval?: TimeseriesInterval,
    event?: string,
    filter?: Filters,
  ) =>
    fetchApi<{ timeseries: TimeseriesPoint[] }>(
      `/query/events/timeseries${qs({ from, to, interval, event, filter })}`,
    ),

  topEvents: (from?: string, to?: string, limit?: number, filter?: Filters) =>
    fetchApi<{ events: TopEvent[] }>(`/query/events/top${qs({ from, to, limit, filter })}`),

  eventNames: () => fetchApi<{ names: string[] }>("/query/events/names"),

  events: (params?: {
    event?: string;
    user_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    filter?: Filters;
  }) => fetchApi<{ events: EventResult[] }>(`/query/events${qs({ ...(params ?? {}) })}`),

  funnel: (steps: string[], from?: string, to?: string, window?: string, filter?: Filters, breakdown?: string) =>
    fetchApi<FunnelResponse>(
      `/query/funnel${qs({ steps: steps.join(","), from, to, window, filter, breakdown })}`,
    ),

  sessions: (user_id: string) => fetchApi<{ sessions: Session[] }>(`/query/sessions${qs({ user_id })}`),

  retention: (from?: string, to?: string) =>
    fetchApi<{ retention: RetentionCohort[] }>(`/query/retention${qs({ from, to })}`),

  geo: (from?: string, to?: string, group_by?: "country" | "city", filter?: Filters) =>
    fetchApi<{ geo: GeoData[] }>(`/query/geo${qs({ from, to, group_by, filter })}`),

  breakdown: (
    key: string,
    from?: string,
    to?: string,
    event?: string,
    filter?: Filters,
    limit?: number,
  ) => fetchApi<BreakdownResponse>(`/query/breakdown${qs({ key, from, to, event, filter, limit })}`),

  dimensions: (from?: string, to?: string) =>
    fetchApi<{ dimensions: Dimension[] }>(`/query/dimensions${qs({ from, to })}`),

  activeUsers: (from?: string, to?: string, filter?: Filters) =>
    fetchApi<ActiveUsersResponse>(`/query/active-users${qs({ from, to, filter })}`),

  revenue: (
    from?: string,
    to?: string,
    currency?: string,
    filter?: Filters,
    interval?: string,
    compare?: boolean,
  ) =>
    fetchApi<RevenueSummary>(`/query/revenue${qs({ from, to, currency, filter, interval, compare })}`),

  cohortRevenue: (from?: string, to?: string, currency?: string, interval?: string) =>
    fetchApi<CohortRevenueReport>(`/query/cohort-revenue${qs({ from, to, currency, interval })}`),

  live: () => fetchApi<LiveData>("/query/live"),
};
