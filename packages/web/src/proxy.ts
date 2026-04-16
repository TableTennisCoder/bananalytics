import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/constants";

/**
 * Proxy (Next.js 16 middleware replacement).
 * Protects /dashboard/* routes — redirects to /login if no user session cookie.
 * The login page itself handles the needs_setup → /setup redirect.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
