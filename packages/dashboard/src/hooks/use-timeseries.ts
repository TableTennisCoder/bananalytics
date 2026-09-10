"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useFilters } from "@/providers/filter-provider";
import { useTimeRange } from "./use-time-range";
import type { TimeseriesInterval } from "@/types/events";

export function useTimeseries(
  interval: TimeseriesInterval = "hour",
  event?: string,
  from?: string,
  to?: string,
) {
  const defaults = useTimeRange(7);
  const f = from || defaults.from;
  const t = to || defaults.to;
  const { params } = useFilters();

  return useQuery({
    queryKey: ["timeseries", f, t, interval, event, params],
    queryFn: () => api.timeseries(f, t, interval, event, params),
    refetchInterval: POLL_INTERVAL.OVERVIEW,
    select: (data) => data.timeseries,
  });
}
