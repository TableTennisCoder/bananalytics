import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, USER_SESSION_COOKIE } from "@/lib/constants";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const backendRes = await fetch(`${BACKEND_URL}/v1/projects/${id}/keys/rotate`, {
    method: "POST",
    headers: { Cookie: `${USER_SESSION_COOKIE}=${token}` },
  });
  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
