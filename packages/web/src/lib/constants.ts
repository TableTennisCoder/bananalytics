/** Go backend base URL (server-side only). */
export const BACKEND_URL = process.env.ROCHADE_BACKEND_URL || "http://localhost:8080";

/** Cookie name for the encrypted secret key. */
export const AUTH_COOKIE = "rochade_session";

/** Default polling intervals in milliseconds. */
export const POLL_INTERVAL = {
  LIVE: 5_000,
  OVERVIEW: 10_000,
  EVENTS: 15_000,
  DEFAULT: 30_000,
} as const;

/** Default time range: last 7 days. */
export function defaultTimeRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

/** Today's time range. */
export function todayTimeRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}
