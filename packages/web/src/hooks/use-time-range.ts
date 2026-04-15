"use client";

import { useMemo } from "react";

/**
 * Returns a stable time range for the last N days.
 * Rounded to the nearest minute to prevent infinite re-render loops.
 */
export function useTimeRange(days: number = 7) {
  return useMemo(() => {
    const now = new Date();
    // Round to the current minute to keep the value stable across renders
    now.setSeconds(0, 0);

    const from = new Date(now);
    from.setDate(from.getDate() - days);

    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
    // Re-compute only every minute by keying on the minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, Math.floor(Date.now() / 60_000)]);
}

/**
 * Returns a stable time range for today.
 */
export function useTodayRange() {
  return useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      from: start.toISOString(),
      to: now.toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(Date.now() / 60_000)]);
}
