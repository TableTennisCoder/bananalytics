"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/**
 * What the host-side backup script last reported.
 *
 * Nothing here changes faster than once a night, so this is asked once and
 * left alone rather than polled.
 */
export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: () => api.backups(),
    staleTime: 5 * 60_000,
  });
}
