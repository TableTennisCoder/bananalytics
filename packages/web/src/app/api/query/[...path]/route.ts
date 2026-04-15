import { NextRequest } from "next/server";
import { backendFetch } from "@/lib/backend-client";

/**
 * Catch-all proxy for all /api/query/* requests.
 * Forwards to the Go backend with the secret key from the session cookie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const queryPath = `/v1/query/${path.join("/")}`;
  const search = request.nextUrl.searchParams.toString();
  const fullPath = search ? `${queryPath}?${search}` : queryPath;

  const backendRes = await backendFetch(fullPath);
  const data = await backendRes.json();

  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
