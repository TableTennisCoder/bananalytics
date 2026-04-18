/** A single analytics event from the API. */
export interface EventResult {
  id: string;
  event: string;
  type: "track" | "screen" | "identify";
  properties: Record<string, unknown>;
  user_id: string | null;
  anonymous_id: string;
  timestamp: string;
  session_id: string;
}

/** Filter parameters for querying events. */
export interface EventFilter {
  event?: string;
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** A single point in an event timeseries. */
export interface TimeseriesPoint {
  bucket: string;
  count: number;
}

/** A top event by count. */
export interface TopEvent {
  event: string;
  count: number;
}

/** Available interval granularities for timeseries. */
export type TimeseriesInterval = "minute" | "hour" | "day";
