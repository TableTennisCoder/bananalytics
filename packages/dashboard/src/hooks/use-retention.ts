"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";

export function useRetention(from?: string, to?: string) {
  return useQuery({
    queryKey: ["retention", from, to],
    queryFn: () => api.retention(from, to),
    refetchInterval: POLL_INTERVAL.DEFAULT,
    select: (data) => data.retention,
  });
}
