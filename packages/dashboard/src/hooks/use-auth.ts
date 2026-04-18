"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthStatus } from "@/types/user";

async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/auth/status", { cache: "no-store" });
  if (!res.ok) throw new Error("auth status check failed");
  return res.json();
}

/**
 * Returns the current auth status: needs_setup, unauthenticated, or authenticated.
 * Used by the dashboard layout and proxy to determine where to redirect.
 */
export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth", "status"],
    queryFn: fetchAuthStatus,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
