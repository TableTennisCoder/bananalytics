"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { useActiveUsers } from "@/hooks/use-active-users";
import { formatCompact, formatPercent } from "@/lib/format";
import { Users } from "lucide-react";

const chartConfig = {
  mau: { label: "Monthly", color: "var(--chart-3)" },
  wau: { label: "Weekly", color: "var(--chart-2)" },
  dau: { label: "Daily", color: "var(--chart-1)" },
};

/**
 * Active people over time.
 *
 * Event volume can rise while the audience shrinks — one heavy user firing more
 * events looks identical to growth. This counts people instead, and the
 * DAU/MAU ratio (stickiness) shows how much of the monthly audience returns
 * on a given day.
 */
export function ActiveUsersChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useActiveUsers(days);

  const latest = data?.[data.length - 1];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">Active People</CardTitle>
          {latest && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">
                DAU <span className="font-mono text-foreground">{formatCompact(latest.dau)}</span>
              </span>
              <span className="text-muted-foreground">
                WAU <span className="font-mono text-foreground">{formatCompact(latest.wau)}</span>
              </span>
              <span className="text-muted-foreground">
                MAU <span className="font-mono text-foreground">{formatCompact(latest.mau)}</span>
              </span>
              <span className="text-muted-foreground">
                Stickiness{" "}
                <span className="font-mono text-primary">{formatPercent(latest.stickiness)}</span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !data?.length ? (
          <div className="flex h-[260px] flex-col items-center justify-center text-muted-foreground">
            <Users className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillMau" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.08} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                minTickGap={24}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                width={40}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="mau"
                stroke="var(--chart-3)"
                fill="url(#fillMau)"
                strokeWidth={1.5}
              />
              <Line type="monotone" dataKey="wau" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="dau" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
