"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useTodayRange } from "./use-time-range";

export function useStats() {
  const { from, to } = useTodayRange();

  return useQuery({
    queryKey: ["stats", from, to],
    queryFn: () => api.stats(from, to),
    refetchInterval: POLL_INTERVAL.OVERVIEW,
  });
}
