"use client";

import { useState } from "react";
import { Filter, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDimensions, useBreakdown, groupDimensions } from "@/hooks/use-dimensions";
import { useFilters } from "@/providers/filter-provider";
import { formatNumber } from "@/lib/format";
import { NOT_SET } from "@/types/dimensions";

/**
 * Narrows every chart on the dashboard to a segment.
 *
 * Picking a dimension loads its actual values with counts, so you choose from
 * what the data contains rather than having to know the values up front.
 */
export function FilterBar() {
  const { filters, addFilter, removeFilter, clearFilters } = useFilters();
  const [pendingKey, setPendingKey] = useState<string>("");

  const { data: dimensions } = useDimensions();
  const { data: values, isLoading: valuesLoading } = useBreakdown(pendingKey || undefined, undefined, 30);

  const dimensionLabel = (key: string) =>
    dimensions?.find((d) => d.key === key)?.label ?? key;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Segment
      </span>

      {filters.map((filter, index) => (
        <span
          key={`${filter.key}-${filter.value}`}
          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-xs"
        >
          <span className="text-muted-foreground">{dimensionLabel(filter.key)}</span>
          <span className="font-medium text-primary">{filter.value}</span>
          <button
            type="button"
            onClick={() => removeFilter(index)}
            aria-label={`Remove ${dimensionLabel(filter.key)} filter`}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {/* Step 1: pick a dimension. */}
      <Select
        value={pendingKey}
        onValueChange={(v: string | null) => {
          if (typeof v === "string") setPendingKey(v);
        }}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <span className="flex items-center gap-1.5">
            <Plus className="h-3 w-3" />
            <SelectValue placeholder="Add filter">
              {(value: string) => dimensionLabel(value)}
            </SelectValue>
          </span>
        </SelectTrigger>
        <SelectContent>
          {groupDimensions(dimensions).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {items.map((dimension) => (
                <SelectItem key={dimension.key} value={dimension.key}>
                  {dimension.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {/* Step 2: pick one of the values that dimension actually has. */}
      {pendingKey && (
        <Select
          onValueChange={(v: string | null) => {
            if (typeof v === "string") {
              addFilter({ key: pendingKey, value: v });
              setPendingKey("");
            }
          }}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder={valuesLoading ? "Loading..." : "Choose a value"} />
          </SelectTrigger>
          <SelectContent>
            {values?.breakdown
              ?.filter((bucket) => bucket.value !== NOT_SET)
              .map((bucket) => (
                <SelectItem key={bucket.value} value={bucket.value}>
                  {bucket.value}
                  <span className="ml-2 text-muted-foreground">
                    {formatNumber(bucket.count)}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 text-xs text-muted-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
