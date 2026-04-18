"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGeo } from "@/hooks/use-geo";
import { formatNumber } from "@/lib/format";
import { WorldMap } from "@/components/charts/world-map";

function countryFlag(code: string): string {
  return code.toUpperCase().split("").map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export default function GeoPage() {
  const [groupBy, setGroupBy] = useState<"country" | "city">("country");
  const { data: geo, isLoading } = useGeo(groupBy);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Geography</h1>
          <p className="text-sm text-muted-foreground">Where your users are located</p>
        </div>
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "country" | "city")}>
          <TabsList>
            <TabsTrigger value="country">Countries</TabsTrigger>
            <TabsTrigger value="city">Cities</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Interactive Globe */}
      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          <WorldMap
            data={geo ?? []}
            className="h-[500px] w-full"
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">{groupBy === "country" ? "Countries" : "Cities"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : !geo?.length ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>No geo data available. Enable GeoIP in the backend.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geo.map((row, i) => {
                    const total = geo.reduce((s, r) => s + r.count, 0);
                    const pct = total > 0 ? (row.count / total) * 100 : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <img
                            src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${row.country_code.toUpperCase()}.svg`}
                            alt={row.country}
                            className="inline-block mr-2 h-4 w-6 rounded-sm object-cover"
                          />
                          {groupBy === "city" && row.city ? `${row.city}, ${row.country}` : row.country}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(row.count)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(row.unique_users)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
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
    </div>
  );
}
