"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDimensions, useBreakdown, groupDimensions } from "@/hooks/use-dimensions";
import { useEventNames } from "@/hooks/use-events";
import { useFilters } from "@/providers/filter-provider";
import { formatNumber, formatPercent } from "@/lib/format";
import { formatMoney } from "@/types/revenue";
import { NOT_SET, type BreakdownBucket } from "@/types/dimensions";
import { Layers, Search } from "lucide-react";

/** Metrics a breakdown can be ranked by. */
export const BREAKDOWN_METRICS = [
  { value: "count", label: "Events" },
  { value: "unique_users", label: "People" },
  { value: "revenue", label: "Revenue" },
] as const;

export type BreakdownMetric = (typeof BREAKDOWN_METRICS)[number]["value"];

/**
 * Ranks a dimension's values against each other.
 *
 * This is what turns a number into an explanation: an aggregate says 500 people
 * dropped off, a breakdown says 450 of them were on one platform.
 */
export function BreakdownTable({
  title = "Results",
  initialKey = "platform",
  metric: fixedMetric,
  currency = "",
  days = 7,
  showEventPicker = true,
  showMetricPicker = true,
}: {
  title?: string;
  initialKey?: string;
  /** Fixes the ranking metric and hides the picker. */
  metric?: BreakdownMetric;
  currency?: string;
  days?: number;
  showEventPicker?: boolean;
  showMetricPicker?: boolean;
}) {
  const [dimensionKey, setDimensionKey] = useState(initialKey);
  const [event, setEvent] = useState("");
  const [chosenMetric, setChosenMetric] = useState<BreakdownMetric>(fixedMetric ?? "count");

  const metric = fixedMetric ?? chosenMetric;

  const { data: dimensions } = useDimensions();
  const { data: eventNames } = useEventNames();
  const { data, isLoading } = useBreakdown(dimensionKey, event, days);
  const { addFilter } = useFilters();

  const buckets: BreakdownBucket[] = [...(data?.breakdown ?? [])].sort(
    (a, b) => b[metric] - a[metric],
  );
  const total = buckets.reduce((sum, bucket) => sum + bucket[metric], 0);
  const largest = buckets[0]?.[metric] ?? 0;

  const formatMetric = (bucket: BreakdownBucket) =>
    metric === "revenue" ? formatMoney(bucket.revenue, currency) : formatNumber(bucket[metric]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">{title}</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dimensionKey}
              onValueChange={(v: string | null) => {
                if (typeof v === "string") setDimensionKey(v);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue>
                  {(value: string) => dimensions?.find((d) => d.key === value)?.label ?? value}
                </SelectValue>
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

            {showEventPicker && (
              <Select
                value={event}
                onValueChange={(v: string | null) => {
                  if (typeof v === "string") setEvent(v === "__all__" ? "" : v);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All events</SelectItem>
                  {eventNames?.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {showMetricPicker && !fixedMetric && (
              <Select
                value={chosenMetric}
                onValueChange={(v: string | null) => {
                  if (typeof v === "string") setChosenMetric(v as BreakdownMetric);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue>
                    {(value: string) =>
                      BREAKDOWN_METRICS.find((m) => m.value === value)?.label ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BREAKDOWN_METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : buckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-sm">No data for this dimension</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[30%]">Share</TableHead>
                  <TableHead className="w-28 text-right">
                    {BREAKDOWN_METRICS.find((m) => m.value === metric)?.label}
                  </TableHead>
                  <TableHead className="w-24 text-right">People</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((bucket) => {
                  const share = total > 0 ? (bucket[metric] / total) * 100 : 0;
                  const relative = largest > 0 ? (bucket[metric] / largest) * 100 : 0;

                  return (
                    <TableRow key={bucket.value}>
                      <TableCell className="font-medium">
                        {bucket.value === NOT_SET ? (
                          <span className="italic text-muted-foreground">not set</span>
                        ) : (
                          bucket.value
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(relative, 1)}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                            {formatPercent(share)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMetric(bucket)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(
                          metric === "revenue" ? bucket.paying_users : bucket.unique_users,
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {bucket.value !== NOT_SET && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                            onClick={() => addFilter({ key: dimensionKey, value: bucket.value })}
                          >
                            <Search className="h-3 w-3" />
                            Focus
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
