"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { FunnelSegment } from "@/types/funnel";
import { TrendingDown, TrendingUp } from "lucide-react";

/**
 * Compares one funnel per segment side by side.
 *
 * A single overall conversion rate hides that one segment converts at half the
 * rate of another; putting them next to each other is what makes that visible.
 */
export function FunnelSegments({
  segments,
  dimensionLabel,
}: {
  segments: FunnelSegment[];
  dimensionLabel: string;
}) {
  if (segments.length === 0) return null;

  const rateOf = (segment: FunnelSegment) => {
    const last = segment.steps[segment.steps.length - 1];
    return last?.conversion_rate ?? 0;
  };

  // Ranking by conversion rate puts the outliers at the two ends.
  const ranked = [...segments].sort((a, b) => rateOf(b) - rateOf(a));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const spread = rateOf(best) - rateOf(worst);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            Conversion by {dimensionLabel}
          </CardTitle>
          {ranked.length > 1 && spread > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-primary">{best.value}</span> converts{" "}
              {formatPercent(spread)} better than{" "}
              <span className="font-medium">{worst.value}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {ranked.map((segment, index) => {
          const entered = segment.steps[0]?.count ?? 0;
          const rate = rateOf(segment);

          return (
            <div key={segment.value} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{segment.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(entered)} entered
                  </span>
                  {ranked.length > 1 && index === 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      <TrendingUp className="h-3 w-3" /> best
                    </span>
                  )}
                  {ranked.length > 1 && index === ranked.length - 1 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      <TrendingDown className="h-3 w-3" /> worst
                    </span>
                  )}
                </div>
                <span className="font-mono text-sm">{formatPercent(rate)}</span>
              </div>

              {/* One bar per step, so the shape of the drop-off is comparable. */}
              <div className="flex gap-1">
                {segment.steps.map((step, stepIndex) => (
                  <div key={`${step.step}-${stepIndex}`} className="flex-1 space-y-1">
                    <div className="h-8 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary/80 transition-all"
                        style={{ width: `${Math.max(step.conversion_rate, 1)}%` }}
                      />
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground" title={step.step}>
                      {step.step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
