import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, USER_SESSION_COOKIE } from "@/lib/constants";

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE)?.value;

  const headers: Record<string, string> = {};
  if (sessionToken) {
    headers["Cookie"] = `${USER_SESSION_COOKIE}=${sessionToken}`;
  }

  const backendRes = await fetch(`${BACKEND_URL}/v1/auth/status`, {
    headers,
    cache: "no-store",
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
