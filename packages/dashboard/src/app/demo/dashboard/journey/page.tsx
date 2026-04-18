"use client";

import { useEvents } from "@/hooks/use-events";
import { JourneyFlow } from "@/components/dashboard/journey-flow";
import { Skeleton } from "@/components/ui/skeleton";

export default function DemoJourneyPage() {
  const { data: events, isLoading } = useEvents({ user_id: "user_1842", limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Journey</h1>
        <p className="text-sm text-muted-foreground">
          Visualize the complete path a user took through your app
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">Viewing journey for</span>
        <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-primary">user_1842</code>
        <span className="text-xs text-muted-foreground">— {events?.length ?? 0} events across 1 session</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-[500px] w-full" />
      ) : !events?.length ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12">
          <p className="text-muted-foreground">No events found</p>
        </div>
      ) : (
        <JourneyFlow events={events} className="h-[500px] rounded-lg border border-border" />
      )}
    </div>
  );
}
