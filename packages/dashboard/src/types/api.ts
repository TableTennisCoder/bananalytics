/** Generic API response wrapper. */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

/** Pagination parameters for list queries. */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/** Time range filter for queries. */
export interface TimeRange {
  from: string; // ISO 8601
  to: string;   // ISO 8601
}
