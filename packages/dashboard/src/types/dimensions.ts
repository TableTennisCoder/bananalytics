/** A dimension events can be broken down or filtered by. */
export interface Dimension {
  /** Machine key, e.g. "platform" or "properties.plan". */
  key: string;
  /** Human-readable name. */
  label: string;
  /** Bucket for the dimension picker, e.g. "Device" or "Custom". */
  group: string;
}

/** One value of a dimension with its aggregates. */
export interface BreakdownBucket {
  value: string;
  count: number;
  unique_users: number;
  /** What this segment brought in — "where is the money", not just "where are the users". */
  revenue: number;
  paying_users: number;
}

/** Response shape of the breakdown endpoint. */
export interface BreakdownResponse {
  key: string;
  label: string;
  breakdown: BreakdownBucket[];
}

/** An active filter: a dimension narrowed to a single value. */
export interface ActiveFilter {
  key: string;
  value: string;
}

/** Placeholder the backend uses when an event carries no value for a dimension. */
export const NOT_SET = "(not set)";

/** Serializes filters into the repeated `filter=key:value` query parameters. */
export function filtersToParams(filters: ActiveFilter[]): string[] {
  return filters.map((f) => `${f.key}:${f.value}`);
}
