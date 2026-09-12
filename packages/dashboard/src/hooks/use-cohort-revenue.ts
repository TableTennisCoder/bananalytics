"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { POLL_INTERVAL } from "@/lib/constants";
import { useTimeRange } from "./use-time-range";

/**
 * Cohort lifetime value.
 *
 * The range picks which cohorts are reported, by when they were acquired — not
 * by when their revenue arrived. Ninety days of cohorts is enough to see a
 * trend without the table running off the screen.
 *
 * No segment filter: a cohort is defined by who was acquired, and narrowing it
 * after the fact would report a different population than the one counted.
 */
export function useCohortRevenue(interval: "week" | "month" = "week", currency?: string) {
  const { from, to } = useTimeRange(90);

  return useQuery({
    queryKey: ["cohort-revenue", from, to, currency, interval],
    queryFn: () => api.cohortRevenue(from, to, currency || undefined, interval),
    refetchInterval: POLL_INTERVAL.DEFAULT,
  });
}
