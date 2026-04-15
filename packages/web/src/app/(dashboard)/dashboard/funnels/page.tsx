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
import { useTimeRange } from "@/hooks/use-time-range";
import { formatNumber, formatPercent } from "@/lib/format";
import { Plus, Trash2, GitBranch } from "lucide-react";

export default function FunnelsPage() {
  const { from, to } = useTimeRange(7);
  const [steps, setSteps] = useState<string[]>([]);
  const { data: eventNames } = useEventNames();
  const { data: funnel } = useFunnel(steps, from, to);

  const addStep = (event: string) => {
    if (!steps.includes(event)) setSteps([...steps, event]);
  };
  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const firstCount = funnel?.[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funnels</h1>
        <p className="text-sm text-muted-foreground">
          Analyze conversion rates through event sequences
        </p>
      </div>

      {/* Builder */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">Funnel Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 rounded-md border border-border px-3 py-2 text-sm">{step}</div>
              <Button variant="ghost" size="sm" onClick={() => removeStep(i)} className="h-8 w-8 p-0">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <Select onValueChange={(v: string | null) => { if (typeof v === "string") addStep(v); }}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add a step..." />
              </SelectTrigger>
              <SelectContent>
                {eventNames?.filter((n) => !steps.includes(n)).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {funnel && funnel.length > 0 ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium">Conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {funnel.map((step, i) => {
              const pct = firstCount > 0 ? (step.count / firstCount) * 100 : 0;
              const prevCount = i > 0 ? funnel[i - 1].count : step.count;
              const dropoff = prevCount > 0 ? ((prevCount - step.count) / prevCount) * 100 : 0;
              return (
                <div key={step.step} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <span className="font-medium">{step.step}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatNumber(step.count)}</span>
                      {i > 0 && <span className="text-xs text-red-400">-{formatPercent(dropoff)} drop</span>}
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-border bg-muted/30 p-4 mt-4 text-center">
              <p className="text-sm text-muted-foreground">Overall Conversion</p>
              <p className="text-3xl font-bold text-primary">
                {firstCount > 0 ? formatPercent(((funnel[funnel.length - 1]?.count ?? 0) / firstCount) * 100) : "0%"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-muted-foreground">
          <GitBranch className="mb-3 h-8 w-8 opacity-30" />
          <p>{steps.length >= 2 ? "No data for selected steps" : "Add at least 2 steps to build a funnel"}</p>
        </div>
      )}
    </div>
  );
}
