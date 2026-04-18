"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useSessions(userId: string) {
  return useQuery({
    queryKey: ["sessions", userId],
    queryFn: () => api.sessions(userId),
    enabled: !!userId,
    select: (data) => data.sessions,
  });
}
