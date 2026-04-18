/** A dashboard user. */
export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

/** Auth status response from /api/auth/status. */
export type AuthStatus =
  | { status: "needs_setup" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: User };

/** Setup request payload (first-run admin registration). */
export interface SetupRequest {
  email: string;
  password: string;
  name: string;
}

/** Login request payload. */
export interface LoginRequest {
  email: string;
  password: string;
}
