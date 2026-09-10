"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useFilters } from "@/providers/filter-provider";
import type { FunnelWindow } from "@/types/funnel";

export function useFunnel(
  steps: string[],
  from?: string,
  to?: string,
  window: FunnelWindow = "7d",
  breakdown?: string,
) {
  const { params } = useFilters();

  return useQuery({
    queryKey: ["funnel", steps, from, to, window, params, breakdown],
    queryFn: () => api.funnel(steps, from, to, window, params, breakdown || undefined),
    enabled: steps.length >= 2,
  });
}
