import { cookies } from "next/headers";
import { BACKEND_URL, USER_SESSION_COOKIE, ACTIVE_PROJECT_COOKIE } from "./constants";

/**
 * Server-side only: makes a query request to the Go backend on behalf of the user.
 *
 * Resolves the project secret key by:
 * 1. Reading the user session cookie
 * 2. Fetching the user's projects from the backend
 * 3. Picking the active project (from cookie) or the first one
 * 4. Using that project's secret key as Bearer auth
 */
export async function backendFetch(path: string): Promise<Response> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return jsonError(401, "not_authenticated", "user session required");
  }

  // Fetch the user's projects (server → server, includes session cookie)
  const projectsRes = await fetch(`${BACKEND_URL}/v1/projects`, {
    headers: { Cookie: `${USER_SESSION_COOKIE}=${sessionToken}` },
    cache: "no-store",
  });

  if (!projectsRes.ok) {
    return jsonError(projectsRes.status, "auth_failed", "failed to load projects");
  }

  const { projects } = (await projectsRes.json()) as {
    projects: Array<{ id: string; secret_key: string }>;
  };

  if (!projects || projects.length === 0) {
    return jsonError(404, "no_project", "no project available");
  }

  // Pick the active project (cookie) or the first one
  const activeProjectId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;
  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  // Forward to the Go backend's query API using the project's secret key
  return fetch(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${project.secret_key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
