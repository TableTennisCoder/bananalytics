/** Authentication state for the dashboard. */
export interface AuthState {
  isAuthenticated: boolean;
  projectId: string | null;
}

/** Login request payload. */
export interface LoginRequest {
  secretKey: string;
}
