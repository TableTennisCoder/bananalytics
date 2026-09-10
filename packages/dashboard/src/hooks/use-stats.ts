"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useFilters } from "@/providers/filter-provider";
import { useTodayRange } from "./use-time-range";

export function useStats() {
  const { from, to } = useTodayRange();
  const { params } = useFilters();

  return useQuery({
    queryKey: ["stats", from, to, params],
    queryFn: () => api.stats(from, to, params),
    refetchInterval: POLL_INTERVAL.OVERVIEW,
  });
}
