import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/constants";

/**
 * Proxy (Next.js 16 middleware replacement).
 *
 * Two responsibilities:
 * 1. Redirect `?isDemo=true` on any /dashboard/* route to the equivalent
 *    /demo/dashboard/* route (so visitors can hand out a single URL like
 *    https://app.bananalytics.xyz/dashboard?isDemo=true and end up in demo).
 * 2. Protect /dashboard/* routes — redirects to /login if no session cookie.
 *    The login page handles the needs_setup → /setup redirect.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. ?isDemo=true → demo route
  if (pathname.startsWith("/dashboard") && searchParams.get("isDemo") === "true") {
    const demoUrl = new URL(`/demo${pathname}`, request.url);
    // strip the query param so subsequent navigation stays clean
    return NextResponse.redirect(demoUrl);
  }

  // 2. Auth gate
  if (pathname.startsWith("/dashboard")) {
    const session = request.cookies.get(USER_SESSION_COOKIE);
    if (!session?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
