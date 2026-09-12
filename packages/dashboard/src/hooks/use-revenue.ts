"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useFilters } from "@/providers/filter-provider";
import { useTimeRange } from "./use-time-range";

export function useRevenue(days = 30, currency?: string, interval: "day" | "hour" = "day") {
  const { from, to } = useTimeRange(days);
  const { params } = useFilters();

  return useQuery({
    queryKey: ["revenue", from, to, currency, params, interval, "compare"],
    // compare adds the preceding window of the same length, which is what makes
    // the deltas on the cards mean anything.
    queryFn: () => api.revenue(from, to, currency || undefined, params, interval, true),
    refetchInterval: POLL_INTERVAL.DEFAULT,
  });
}
