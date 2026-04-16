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
