"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useFunnel(steps: string[], from?: string, to?: string) {
  return useQuery({
    queryKey: ["funnel", steps, from, to],
    queryFn: () => api.funnel(steps, from, to),
    enabled: steps.length >= 2,
    select: (data) => data.funnel,
  });
}
