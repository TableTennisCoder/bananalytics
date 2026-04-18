import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, USER_SESSION_COOKIE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendRes = await fetch(`${BACKEND_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();
  const response = NextResponse.json(data, { status: backendRes.status });

  // Forward the session cookie from the Go backend (Set-Cookie header)
  const setCookie = backendRes.headers.get("set-cookie");
  if (setCookie && backendRes.ok) {
    // Parse the token value from the set-cookie header
    const match = setCookie.match(new RegExp(`${USER_SESSION_COOKIE}=([^;]+)`));
    if (match) {
      response.cookies.set(USER_SESSION_COOKIE, match[1], {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
  }

  return response;
}
