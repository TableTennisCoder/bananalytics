"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLive } from "@/hooks/use-live";
import { formatRelative } from "@/lib/format";
import { Radio, Users, Zap } from "lucide-react";

export default function LivePage() {
  const { data: live } = useLive();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Live View</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs text-green-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Updating every 5s
        </span>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-3xl font-bold">{live?.active_users ?? 0}</p>
              <p className="text-xs text-muted-foreground">in the last 5 minutes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Events / Minute</p>
              <p className="text-3xl font-bold">{live?.events_last_minute ?? 0}</p>
              <p className="text-xs text-muted-foreground">in the last 60 seconds</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Event Stream */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-medium">Event Stream</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {live?.recent_events?.length ? (
              live.recent_events.map((event, i) => (
                <div
                  key={event.id || i}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{event.event}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.user_id || event.anonymous_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant="secondary" className="text-xs">
                      {event.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {formatRelative(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Radio className="mb-3 h-8 w-8 opacity-30" />
                <p>Waiting for events...</p>
                <p className="text-xs mt-1">Events will appear here in real-time</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
