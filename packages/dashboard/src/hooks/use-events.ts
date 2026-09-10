"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useFilters } from "@/providers/filter-provider";
import type { EventFilter } from "@/types/events";

export function useEvents(filter: EventFilter = {}) {
  const { params } = useFilters();

  return useQuery({
    queryKey: ["events", filter, params],
    queryFn: () => api.events({ ...filter, filter: params }),
    refetchInterval: POLL_INTERVAL.EVENTS,
    select: (data) => data.events,
  });
}

export function useEventNames() {
  return useQuery({
    queryKey: ["eventNames"],
    queryFn: () => api.eventNames(),
    staleTime: 60_000,
    select: (data) => data.names,
  });
}

export function useTopEvents(from?: string, to?: string, limit?: number) {
  const { params } = useFilters();

  return useQuery({
    queryKey: ["topEvents", from, to, limit, params],
    queryFn: () => api.topEvents(from, to, limit, params),
    refetchInterval: POLL_INTERVAL.DEFAULT,
    select: (data) => data.events,
  });
}
