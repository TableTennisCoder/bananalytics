/** Overview dashboard statistics. */
export interface StatsOverview {
  total_events: number;
  unique_users: number;
  active_sessions: number;
  events_per_minute: number;
  top_country: string;
  /** Revenue in the same range, denominated in top_currency. */
  revenue: number;
  top_currency: string;

  /**
   * The same totals for the window immediately before this one, present when
   * the request asked to compare.
   *
   * Active sessions and events-per-minute are absent on purpose: both describe
   * the last half hour, which has no "previous".
   */
  previous?: StatsTotals;
}

/** The comparable subset of an overview. */
export interface StatsTotals {
  total_events: number;
  unique_users: number;
  revenue: number;
}

/** Configuration for chart date range and granularity. */
export interface ChartConfig {
  from: string;
  to: string;
  interval: "minute" | "hour" | "day";
}
