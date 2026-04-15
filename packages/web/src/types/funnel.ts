/** A single step in funnel analysis. */
export interface FunnelStep {
  step: string;
  count: number;
}

/** Configuration for building a funnel query. */
export interface FunnelConfig {
  steps: string[];
  from: string;
  to: string;
}
