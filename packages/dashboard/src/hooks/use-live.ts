"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";

export function useLive() {
  return useQuery({
    queryKey: ["live"],
    queryFn: () => api.live(),
    refetchInterval: POLL_INTERVAL.LIVE,
  });
}
