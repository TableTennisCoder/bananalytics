"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
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

  return useQuery({
    queryKey: ["timeseries", f, t, interval, event],
    queryFn: () => api.timeseries(f, t, interval, event),
    refetchInterval: POLL_INTERVAL.OVERVIEW,
    select: (data) => data.timeseries,
  });
}
