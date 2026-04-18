import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, USER_SESSION_COOKIE } from "@/lib/constants";

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/v1/auth/me`, {
    headers: { Cookie: `${USER_SESSION_COOKIE}=${sessionToken}` },
    cache: "no-store",
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
