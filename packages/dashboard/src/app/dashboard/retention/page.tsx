"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRetention } from "@/hooks/use-retention";
import { useTimeRange } from "@/hooks/use-time-range";
import { formatPercent } from "@/lib/format";
import type { RetentionRow } from "@/types/retention";
import { Users } from "lucide-react";

function processRetention(
  raw: Array<{ cohort: string; cohort_size: number; period: number; retained: number }>,
): RetentionRow[] {
  const map = new Map<string, RetentionRow>();
  for (const r of raw) {
    if (!map.has(r.cohort)) {
      map.set(r.cohort, { cohort: r.cohort, cohort_size: r.cohort_size, periods: {} });
    }
    const row = map.get(r.cohort)!;
    if (row.cohort_size > 0) {
      row.periods[r.period] = (r.retained / row.cohort_size) * 100;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.cohort.localeCompare(b.cohort));
}

function heatColor(pct: number): string {
  if (pct >= 80) return "bg-primary/80 text-white";
  if (pct >= 60) return "bg-primary/60 text-white";
  if (pct >= 40) return "bg-primary/40 text-white";
  if (pct >= 20) return "bg-primary/20 text-foreground";
  return "bg-muted text-muted-foreground";
}

export default function RetentionPage() {
  const { from, to } = useTimeRange(7);
  const { data: raw, isLoading } = useRetention(from, to);
  const rows = raw ? processRetention(raw) : [];
  const periods = rows.length > 0
    ? Array.from(new Set(rows.flatMap((r) => Object.keys(r.periods).map(Number)))).sort((a, b) => a - b)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Retention</h1>
        <p className="text-sm text-muted-foreground">Cohort analysis — how many users return over time</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">Retention Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-3 h-8 w-8 opacity-30" />
              <p>Not enough data for retention analysis</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-muted-foreground font-medium w-28">Cohort</th>
                    <th className="text-center p-2 text-muted-foreground font-medium w-16">Users</th>
                    {periods.map((p) => (
                      <th key={p} className="text-center p-2 text-muted-foreground font-medium w-16">Day {p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.cohort}>
                      <td className="p-2 font-mono text-xs">{row.cohort}</td>
                      <td className="p-2 text-center text-xs text-muted-foreground">{row.cohort_size}</td>
                      {periods.map((p) => {
                        const pct = row.periods[p];
                        return (
                          <td key={p} className="p-1">
                            {pct !== undefined ? (
                              <div className={`rounded px-2 py-1.5 text-center text-xs font-medium ${heatColor(pct)}`}>
                                {formatPercent(pct)}
                              </div>
                            ) : (
                              <div className="rounded px-2 py-1.5 text-center text-xs text-muted-foreground/30">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
