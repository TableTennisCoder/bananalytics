import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, USER_SESSION_COOKIE } from "@/lib/constants";

async function authHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  if (!token) return {};
  return { Cookie: `${USER_SESSION_COOKIE}=${token}` };
}

export async function GET(_request: NextRequest) {
  const headers = await authHeaders();
  const backendRes = await fetch(`${BACKEND_URL}/v1/projects`, {
    headers,
    cache: "no-store",
  });
  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
  };

  const backendRes = await fetch(`${BACKEND_URL}/v1/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
