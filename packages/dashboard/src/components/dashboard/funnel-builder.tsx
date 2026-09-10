"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventNames } from "@/hooks/use-events";
import { useFunnel } from "@/hooks/use-funnel";
import { useDimensions, groupDimensions } from "@/hooks/use-dimensions";
import { useTimeRange } from "@/hooks/use-time-range";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { FunnelSegments } from "@/components/dashboard/funnel-segments";
import { formatNumber, formatPercent, formatDuration } from "@/lib/format";
import { FUNNEL_WINDOWS, type FunnelStep, type FunnelWindow } from "@/types/funnel";
import { Plus, Trash2, GitBranch, Clock, TrendingDown } from "lucide-react";

/**
 * Interactive funnel builder and result view.
 *
 * Steps are evaluated in order by the backend: a person only counts for a step
 * once they have completed the one before it, within the selected window.
 */
export function FunnelBuilder({
  initialSteps = [],
  initialBreakdown = "",
}: {
  initialSteps?: string[];
  initialBreakdown?: string;
}) {
  const { from, to } = useTimeRange(7);
  const [steps, setSteps] = useState<string[]>(initialSteps);
  const [window, setWindow] = useState<FunnelWindow>("7d");
  const [breakdown, setBreakdown] = useState<string>(initialBreakdown);
  const { data: eventNames } = useEventNames();
  const { data: dimensions } = useDimensions();
  const { data } = useFunnel(steps, from, to, window, breakdown);

  const funnel = data?.funnel;
  const breakdownLabel =
    dimensions?.find((d) => d.key === data?.breakdown)?.label ?? data?.breakdown ?? "";
  const firstCount = funnel?.[0]?.count ?? 0;
  const lastStep = funnel?.[funnel.length - 1];

  // The step that loses the most people is where the money leaks.
  const biggestDrop = funnel
    ?.slice(1)
    .reduce<FunnelStep | undefined>(
      (worst, step) => (!worst || step.dropped > worst.dropped ? step : worst),
      undefined,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Funnels</h1>
          <p className="text-sm text-muted-foreground">
            Conversion through an ordered sequence of events
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Compare by</span>
            <Select
              value={breakdown}
              onValueChange={(v: string | null) => {
                if (typeof v === "string") setBreakdown(v === "__none__" ? "" : v);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Nothing">
                  {(value: string) =>
                    dimensions?.find((d) => d.key === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nothing</SelectItem>
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Complete within</span>
            <Select
              value={window}
              onValueChange={(v: string | null) => {
                if (typeof v === "string") setWindow(v as FunnelWindow);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNNEL_WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <FilterBar />

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">Funnel Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, i) => (
            <div key={`${step}-${i}`} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </div>
              <div className="flex-1 rounded-md border border-border px-3 py-2 text-sm">
                {step}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSteps(steps.filter((_, index) => index !== i))}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <Select
              onValueChange={(v: string | null) => {
                if (typeof v === "string") setSteps([...steps, v]);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add a step..." />
              </SelectTrigger>
              <SelectContent>
                {eventNames?.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Steps are counted in order: a person only reaches a step after completing the
            one before it, and must finish the whole funnel within the selected window.
          </p>
        </CardContent>
      </Card>

      {funnel && funnel.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Overall Conversion</p>
                <p className="mt-1 text-3xl font-bold text-primary">
                  {formatPercent(lastStep?.conversion_rate ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(lastStep?.count ?? 0)} of {formatNumber(firstCount)} people
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5" /> Biggest Drop-off
                </p>
                <p className="mt-1 truncate text-xl font-semibold">
                  {biggestDrop?.step ?? "—"}
                </p>
                <p className="mt-1 text-xs text-red-400">
                  {biggestDrop
                    ? `${formatNumber(biggestDrop.dropped)} people lost here`
                    : "No drop-off yet"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Median Time to Convert
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {lastStep?.median_seconds_from_prev !== undefined
                    ? formatDuration(lastStep.median_seconds_from_prev)
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">into the final step</p>
              </CardContent>
            </Card>
          </div>

          {data?.segments && data.segments.length > 0 && (
            <FunnelSegments segments={data.segments} dimensionLabel={breakdownLabel} />
          )}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-medium">Conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnel.map((step, i) => (
                <div key={`${step.step}-${i}`} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-medium">{step.step}</span>
                      {step.median_seconds_from_prev !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(step.median_seconds_from_prev)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatNumber(step.count)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPercent(step.conversion_rate)}
                      </span>
                      {i > 0 && step.dropped > 0 && (
                        <span className="text-xs text-red-400">
                          −{formatNumber(step.dropped)} ({formatPercent(100 - step.step_conversion_rate)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(step.conversion_rate, 0.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-muted-foreground">
          <GitBranch className="mb-3 h-8 w-8 opacity-30" />
          <p>
            {steps.length >= 2
              ? "No data for selected steps"
              : "Add at least 2 steps to build a funnel"}
          </p>
        </div>
      )}
    </div>
  );
}
