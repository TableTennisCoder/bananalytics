"use client";

import { useMemo } from "react";
import { startOfUTCDay, utcDaysAgo } from "@/lib/constants";

/**
 * Returns a stable time range covering the last N whole days plus today so far.
 *
 * The range starts at a UTC midnight rather than at this moment N days ago. The
 * charts already bucket by UTC day, so a mid-day start produced a first bar that
 * held only part of a day and read as a drop. It also lets the backend answer
 * from its daily rollups instead of scanning raw events.
 *
 * Rounded to the current minute so the value is stable across renders.
 */
export function useTimeRange(days: number = 7) {
  return useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);

    return {
      from: utcDaysAgo(now, days).toISOString(),
      to: now.toISOString(),
    };
    // Re-compute only every minute by keying on the minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, Math.floor(Date.now() / 60_000)]);
}

/**
 * Returns a stable time range for today, measured in UTC days to match how the
 * backend buckets and aggregates.
 */
export function useTodayRange() {
  return useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);

    return {
      from: startOfUTCDay(now).toISOString(),
      to: now.toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(Date.now() / 60_000)]);
}
