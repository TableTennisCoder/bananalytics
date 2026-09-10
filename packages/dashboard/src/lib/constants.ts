/** Go backend base URL (server-side only). */
export const BACKEND_URL = process.env.BANANA_BACKEND_URL || "http://localhost:8080";

/** Cookie name for the encrypted secret key (legacy — being phased out). */
export const AUTH_COOKIE = "banana_session";

/** Cookie name for the user authentication session token. */
export const USER_SESSION_COOKIE = "banana_user_session";

/** Cookie name for the active project ID (which project the user is viewing). */
export const ACTIVE_PROJECT_COOKIE = "banana_active_project";

/** Default polling intervals in milliseconds. */
export const POLL_INTERVAL = {
  LIVE: 5_000,
  OVERVIEW: 10_000,
  EVENTS: 15_000,
  DEFAULT: 30_000,
} as const;

/**
 * Midnight UTC on the day `t` falls in.
 *
 * Ranges are anchored to UTC rather than to the viewer's local midnight because
 * that is the day the backend aggregates by. Anchoring locally would ask for a
 * window the daily rollups cannot express, sending every query back to a full
 * scan of the raw events.
 */
export function startOfUTCDay(t: Date): Date {
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/** Midnight UTC, `days` whole days before the day `t` falls in. */
export function utcDaysAgo(t: Date, days: number): Date {
  const start = startOfUTCDay(t);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

/** Default time range: the last 7 whole days plus today so far. */
export function defaultTimeRange(): { from: string; to: string } {
  const to = new Date();
  return {
    from: utcDaysAgo(to, 7).toISOString(),
    to: to.toISOString(),
  };
}

/** Today's time range, in UTC days. */
export function todayTimeRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: startOfUTCDay(now).toISOString(),
    to: now.toISOString(),
  };
}
