import type { StatsOverview } from "@/types/charts";
import type { EventResult, TimeseriesPoint, TopEvent, TimeseriesInterval } from "@/types/events";
import type { FunnelStep } from "@/types/funnel";
import type { RetentionCohort } from "@/types/retention";
import type { Session } from "@/types/sessions";
import type { GeoData, LiveData } from "@/types/geo";

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

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
  stats: (from?: string, to?: string) =>
    fetchApi<StatsOverview>(`/query/stats${qs({ from, to })}`),

  timeseries: (from?: string, to?: string, interval?: TimeseriesInterval, event?: string) =>
    fetchApi<{ timeseries: TimeseriesPoint[] }>(`/query/events/timeseries${qs({ from, to, interval, event })}`),

  topEvents: (from?: string, to?: string, limit?: number) =>
    fetchApi<{ events: TopEvent[] }>(`/query/events/top${qs({ from, to, limit })}`),

  eventNames: () =>
    fetchApi<{ names: string[] }>("/query/events/names"),

  events: (params?: { event?: string; user_id?: string; from?: string; to?: string; limit?: number; offset?: number }) =>
    fetchApi<{ events: EventResult[] }>(`/query/events${qs(params || {})}`),

  funnel: (steps: string[], from?: string, to?: string) =>
    fetchApi<{ funnel: FunnelStep[] }>(`/query/funnel${qs({ steps: steps.join(","), from, to })}`),

  sessions: (user_id: string) =>
    fetchApi<{ sessions: Session[] }>(`/query/sessions${qs({ user_id })}`),

  retention: (from?: string, to?: string) =>
    fetchApi<{ retention: RetentionCohort[] }>(`/query/retention${qs({ from, to })}`),

  geo: (from?: string, to?: string, group_by?: "country" | "city") =>
    fetchApi<{ geo: GeoData[] }>(`/query/geo${qs({ from, to, group_by })}`),

  live: () =>
    fetchApi<LiveData>("/query/live"),
};
