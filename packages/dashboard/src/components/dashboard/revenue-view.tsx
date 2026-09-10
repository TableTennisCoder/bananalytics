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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { useRevenue } from "@/hooks/use-revenue";
import { formatNumber, formatPercent } from "@/lib/format";
import { formatMoney } from "@/types/revenue";
import { Wallet, AlertTriangle } from "lucide-react";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
};

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

/**
 * What the app earned, and per whom.
 *
 * ARPU spreads revenue across everyone; ARPPU across only the people who paid.
 * The gap between the two is the size of the free-to-paid opportunity, which is
 * the number most worth acting on.
 */
export function RevenueView() {
  const [days, setDays] = useState("30");
  const [currency, setCurrency] = useState("");
  const { data, isLoading } = useRevenue(Number(days), currency);

  const money = (amount: number) => formatMoney(amount, data?.currency ?? "");
  const multiCurrency = (data?.available_currencies.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-sm text-muted-foreground">
            What the app earned, and which segments earned it
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {multiCurrency && (
            <Select
              value={currency || data?.currency || ""}
              onValueChange={(v: string | null) => {
                if (typeof v === "string") setCurrency(v);
              }}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data?.available_currencies.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code || "No currency"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={days}
            onValueChange={(v: string | null) => {
              if (typeof v === "string") setDays(v);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                {(value: string) => RANGES.find((r) => r.value === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FilterBar />

      {multiCurrency && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            This project reports revenue in {data?.available_currencies.length} currencies
            ({data?.available_currencies.map((c) => c || "none").join(", ")}). Figures below
            cover <span className="font-medium">{data?.currency || "the unlabelled one"}</span> only —
            amounts are never summed across currencies without an exchange rate.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Total Revenue"
              value={money(data?.total_revenue ?? 0)}
              hint={`${formatNumber(data?.transactions ?? 0)} transactions`}
              highlight
            />
            <Metric
              label="Paying People"
              value={formatNumber(data?.paying_users ?? 0)}
              hint={`${formatPercent(data?.paying_share ?? 0)} of ${formatNumber(data?.active_users ?? 0)} active`}
            />
            <Metric
              label="ARPU"
              value={money(data?.arpu ?? 0)}
              hint="per active person"
            />
            <Metric
              label="ARPPU"
              value={money(data?.arppu ?? 0)}
              hint="per paying person"
            />
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Revenue Over Time</CardTitle>
                <span className="text-xs text-muted-foreground">
                  Avg. order {money(data?.average_order_value ?? 0)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {!data?.timeseries?.length ? (
                <div className="flex h-[260px] flex-col items-center justify-center text-muted-foreground">
                  <Wallet className="mb-3 h-8 w-8 opacity-30" />
                  <p className="text-sm">No revenue recorded yet</p>
                  <p className="mt-1 max-w-sm text-center text-xs">
                    Send a <code className="font-mono text-primary">revenue</code> property with any
                    event, or call{" "}
                    <code className="font-mono text-primary">Bananalytics.trackRevenue()</code>.
                  </p>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={data.timeseries}>
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
                      width={56}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Where the money comes from — the same breakdown engine, ranked by revenue. */}
          <BreakdownTable
            title="Revenue by Segment"
            initialKey="country"
            metric="revenue"
            currency={data?.currency ?? ""}
            days={Number(days)}
          />
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
