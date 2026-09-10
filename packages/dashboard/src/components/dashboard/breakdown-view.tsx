"use client";

import { FilterBar } from "@/components/dashboard/filter-bar";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";

/**
 * Splits any metric by a dimension.
 *
 * An aggregate tells you something happened; a breakdown tells you to whom, so
 * this is where a flat number becomes something to act on.
 */
export function BreakdownView({ initialKey = "platform" }: { initialKey?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Breakdown</h1>
        <p className="text-sm text-muted-foreground">
          Split events, people or revenue by platform, version, country or your own
          event properties
        </p>
      </div>

      <FilterBar />

      <BreakdownTable title="Results" initialKey={initialKey} />
    </div>
  );
}
