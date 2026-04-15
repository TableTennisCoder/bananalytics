"use client";

import { Activity, Users, Radio, Zap, Globe, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { WorldMap } from "@/components/charts/world-map";
import { useStats } from "@/hooks/use-stats";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useTopEvents } from "@/hooks/use-events";
import { useLive } from "@/hooks/use-live";
import { useGeo } from "@/hooks/use-geo";
import { formatCompact, formatRelative, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { useTimeRange } from "@/hooks/use-time-range";

const chartConfig = {
  count: {
    label: "Events",
    color: "var(--chart-1)",
  },
};

export default function DashboardPage() {
  const { from, to } = useTimeRange(7);
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: timeseries, isLoading: tsLoading } = useTimeseries("hour");
  const { data: topEvents } = useTopEvents(from, to, 8);
  const { data: live } = useLive();
  const { data: geo } = useGeo("country");

  const topEventsTotal = topEvents?.reduce((s, e) => s + e.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              title="Events Today"
              value={formatCompact(stats?.total_events ?? 0)}
              icon={<Zap className="h-4 w-4" />}
            />
            <KpiCard
              title="Unique Users"
              value={formatCompact(stats?.unique_users ?? 0)}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              title="Active Sessions"
              value={String(stats?.active_sessions ?? 0)}
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              title="Events / min"
              value={(stats?.events_per_minute ?? 0).toFixed(1)}
              icon={<Radio className="h-4 w-4" />}
            />
            <KpiCard
              title="Top Country"
              value={stats?.top_country ?? "—"}
              icon={<Globe className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Row 2: Chart + Live Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Events Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tsLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={timeseries ?? []}>
                  <defs>
                    <linearGradient id="fillEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
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
                    dataKey="count"
                    stroke="var(--chart-1)"
                    fill="url(#fillEvents)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Live Activity
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  {live?.active_users ?? 0} active
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[268px] overflow-y-auto">
              {live?.recent_events?.length ? (
                live.recent_events.slice(0, 10).map((event, i) => (
                  <div
                    key={event.id || i}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {event.event}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.user_id || event.anonymous_id.slice(0, 8) + "..."}
                      </p>
                    </div>
                    <span className="ml-2 text-xs text-muted-foreground shrink-0">
                      {formatRelative(event.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recent events
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Events + Globe */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Events */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Top Events</CardTitle>
              <Badge variant="secondary" className="text-xs font-normal">
                Last 7 days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topEvents?.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right w-20">Count</TableHead>
                    <TableHead className="text-right w-20">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEvents.map((event, i) => {
                    const pct =
                      topEventsTotal > 0
                        ? (event.count / topEventsTotal) * 100
                        : 0;
                    return (
                      <TableRow key={event.event}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: `var(--chart-${(i % 5) + 1})`,
                              }}
                            />
                            <span className="text-sm font-medium">
                              {event.event}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(event.count)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="mr-2 h-4 w-4 opacity-30" />
                <p className="text-sm">No event data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Globe */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Users Worldwide
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorldMap data={geo ?? []} className="h-[380px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
