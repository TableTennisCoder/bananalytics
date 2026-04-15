"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventTable } from "@/components/dashboard/event-table";
import { useEvents, useEventNames } from "@/hooks/use-events";
import { useTimeseries } from "@/hooks/use-timeseries";
import { useTimeRange } from "@/hooks/use-time-range";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Search, X } from "lucide-react";

const chartConfig = {
  count: { label: "Events", color: "var(--chart-1)" },
};

export default function EventsPage() {
  const { from, to } = useTimeRange(7);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: eventNames } = useEventNames();
  const { data: events, isLoading } = useEvents({
    event: eventFilter || undefined,
    user_id: userFilter || undefined,
    from,
    to,
    limit: 50,
  });
  const { data: timeseries } = useTimeseries("hour", eventFilter || undefined, from, to);

  const filteredEvents = events?.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    return true;
  });

  const clearFilters = () => {
    setEventFilter("");
    setUserFilter("");
    setTypeFilter("all");
  };

  const hasFilters = eventFilter || userFilter || typeFilter !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Event Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Browse and filter individual events
        </p>
      </div>

      {/* Volume Chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Event Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[160px] w-full">
            <BarChart data={timeseries ?? []}>
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={eventFilter} onValueChange={(v) => setEventFilter(v ?? "")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            {eventNames?.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by user ID..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-[220px] pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="track">track</SelectItem>
            <SelectItem value="screen">screen</SelectItem>
            <SelectItem value="identify">identify</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Event Table */}
      <EventTable events={filteredEvents ?? []} isLoading={isLoading} />
    </div>
  );
}
