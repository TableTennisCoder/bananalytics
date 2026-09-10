/** A single step in funnel analysis. */
export interface FunnelStep {
  step: string;
  count: number;
  /** Percentage of the first step's people who reached this step. */
  conversion_rate: number;
  /** Percentage of the *previous* step's people who continued to this step. */
  step_conversion_rate: number;
  /** How many people were lost between the previous step and this one. */
  dropped: number;
  /** Median time people took to get here from the previous step. */
  median_seconds_from_prev?: number;
}

/** One funnel computed for a single value of a breakdown dimension. */
export interface FunnelSegment {
  value: string;
  steps: FunnelStep[];
}

/** Response shape of the funnel endpoint. */
export interface FunnelResponse {
  funnel: FunnelStep[];
  /** The conversion window the result was computed with. 0 means unbounded. */
  window_seconds: number;
  /** The dimension the segments were split by, when a breakdown was requested. */
  breakdown?: string;
  /** One funnel per dimension value, ranked by segment size. */
  segments?: FunnelSegment[];
}

/** Conversion windows offered in the funnel builder. */
export const FUNNEL_WINDOWS = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "none", label: "No limit" },
] as const;

export type FunnelWindow = (typeof FUNNEL_WINDOWS)[number]["value"];
