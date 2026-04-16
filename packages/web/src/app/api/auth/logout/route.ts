import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, AUTH_COOKIE, USER_SESSION_COOKIE, ACTIVE_PROJECT_COOKIE } from "@/lib/constants";

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE)?.value;

  // Revoke session on backend
  if (sessionToken) {
    await fetch(`${BACKEND_URL}/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: `${USER_SESSION_COOKIE}=${sessionToken}` },
    }).catch(() => {});
  }

  // Clear all session cookies on the client
  const response = NextResponse.json({ success: true });
  response.cookies.delete(USER_SESSION_COOKIE);
  response.cookies.delete(AUTH_COOKIE);
  response.cookies.delete(ACTIVE_PROJECT_COOKIE);
  return response;
}
