"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useTimeRange } from "./use-time-range";

export function useGeo(groupBy: "country" | "city" = "country", from?: string, to?: string) {
  const defaults = useTimeRange(7);
  const f = from || defaults.from;
  const t = to || defaults.to;

  return useQuery({
    queryKey: ["geo", groupBy, f, t],
    queryFn: () => api.geo(f, t, groupBy),
    refetchInterval: POLL_INTERVAL.DEFAULT,
    select: (data) => data.geo,
  });
}
