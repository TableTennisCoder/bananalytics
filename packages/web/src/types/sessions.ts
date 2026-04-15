/** A user session. */
export interface Session {
  session_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  event_count: number;
}

/** Computed session with duration. */
export interface SessionWithDuration extends Session {
  duration_seconds: number;
}
