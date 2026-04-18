/** Overview dashboard statistics. */
export interface StatsOverview {
  total_events: number;
  unique_users: number;
  active_sessions: number;
  events_per_minute: number;
  top_country: string;
}

/** Configuration for chart date range and granularity. */
export interface ChartConfig {
  from: string;
  to: string;
  interval: "minute" | "hour" | "day";
}
