import { redirect } from "next/navigation";

/**
 * Root of the dashboard app — always redirect to /login.
 * The /login page handles the needs_setup → /setup branching.
 * If the user has a valid session cookie, the proxy will pass through
 * to /dashboard via the post-login redirect.
 */
export default function Page() {
  redirect("/login");
}
