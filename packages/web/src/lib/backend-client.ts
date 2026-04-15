import { cookies } from "next/headers";
import { BACKEND_URL, AUTH_COOKIE } from "./constants";

/**
 * Server-side only: makes authenticated requests to the Go backend.
 * Reads the secret key from the encrypted session cookie.
 */
export async function backendFetch(path: string): Promise<Response> {
  const cookieStore = await cookies();
  const secretKey = cookieStore.get(AUTH_COOKIE)?.value;

  if (!secretKey) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `${BACKEND_URL}${path}`;

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}
