"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import type { EventFilter } from "@/types/events";

export function useEvents(filter: EventFilter = {}) {
  return useQuery({
    queryKey: ["events", filter],
    queryFn: () => api.events(filter),
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
  return useQuery({
    queryKey: ["topEvents", from, to, limit],
    queryFn: () => api.topEvents(from, to, limit),
    refetchInterval: POLL_INTERVAL.DEFAULT,
    select: (data) => data.events,
  });
}
