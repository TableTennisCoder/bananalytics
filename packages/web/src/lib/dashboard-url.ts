/**
 * Where the Bananalytics dashboard app lives.
 *
 * Marketing site is at `bananalytics.xyz`; the dashboard is on a separate
 * deployment (e.g. `app.bananalytics.xyz` for Cloud, or anywhere a self-hoster
 * runs it). This helper centralises the URL so any cross-origin link from the
 * marketing site can be updated in one place.
 *
 * Set `NEXT_PUBLIC_DASHBOARD_URL` in `.env.local` (dev) or in Vercel project
 * settings (prod) to point at your dashboard. Falls back to the production URL.
 */
const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://app.bananalytics.xyz";

/**
 * Build a fully-qualified URL on the dashboard origin.
 *
 * @example
 *   dashboardUrl("/login")                       // → https://app.bananalytics.xyz/login
 *   dashboardUrl("/dashboard?isDemo=true")       // → https://app.bananalytics.xyz/dashboard?isDemo=true
 */
export function dashboardUrl(path = "/"): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${DASHBOARD_URL.replace(/\/$/, "")}${path}`;
}

/** The login URL on the dashboard. Used by "Log in" buttons in the navbar. */
export const LOGIN_URL = dashboardUrl("/login");

/** The demo URL on the dashboard. The proxy redirects ?isDemo=true → /demo/dashboard. */
export const DEMO_URL = dashboardUrl("/dashboard?isDemo=true");
