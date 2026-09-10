"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useFilters } from "@/providers/filter-provider";
import { useTimeRange } from "./use-time-range";

/** The DAU/WAU/MAU curve — how many people use the app, not how many events fire. */
export function useActiveUsers(days = 30) {
  const { from, to } = useTimeRange(days);
  const { params } = useFilters();

  return useQuery({
    queryKey: ["activeUsers", from, to, params],
    queryFn: () => api.activeUsers(from, to, params),
    refetchInterval: POLL_INTERVAL.DEFAULT,
    select: (data) => data.active_users,
  });
}
