import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, AUTH_COOKIE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const { secretKey } = await request.json();

  if (!secretKey || typeof secretKey !== "string") {
    return NextResponse.json({ error: "Secret key is required" }, { status: 400 });
  }

  // Verify the key against the Go backend by hitting a query endpoint
  const verifyRes = await fetch(`${BACKEND_URL}/v1/query/events/names`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "Invalid secret key" }, { status: 401 });
  }

  // Store the secret key in an httpOnly cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, secretKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
