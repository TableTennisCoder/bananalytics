"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useFilters } from "@/providers/filter-provider";
import { useTimeRange } from "./use-time-range";
import type { Dimension } from "@/types/dimensions";

/** Every dimension available for breakdowns and filters. */
export function useDimensions() {
  const { from, to } = useTimeRange(30);

  return useQuery({
    queryKey: ["dimensions", from, to],
    queryFn: () => api.dimensions(from, to),
    staleTime: 300_000,
    select: (data) => data.dimensions,
  });
}

/** Groups dimensions by their bucket for a sectioned picker. */
export function groupDimensions(dimensions: Dimension[] = []) {
  const groups = new Map<string, Dimension[]>();
  for (const dimension of dimensions) {
    const existing = groups.get(dimension.group);
    if (existing) {
      existing.push(dimension);
    } else {
      groups.set(dimension.group, [dimension]);
    }
  }
  return [...groups.entries()];
}

/** Ranks a dimension's values, honouring the active filters. */
export function useBreakdown(key: string | undefined, event?: string, days = 7) {
  const { from, to } = useTimeRange(days);
  const { params } = useFilters();

  return useQuery({
    queryKey: ["breakdown", key, event, from, to, params],
    queryFn: () => api.breakdown(key!, from, to, event || undefined, params),
    enabled: !!key,
  });
}
