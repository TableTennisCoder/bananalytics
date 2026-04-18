"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessions } from "@/hooks/use-sessions";
import { formatDate, formatTime, formatDuration } from "@/lib/format";
import { Search, Activity } from "lucide-react";

export default function SessionsPage() {
  const [userId, setUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: sessions, isLoading } = useSessions(searchQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(userId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-sm text-muted-foreground">Explore user sessions and event timelines</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Enter user ID or anonymous ID..." value={userId} onChange={(e) => setUserId(e.target.value)} className="pl-9 font-mono" />
        </div>
        <Button type="submit" disabled={!userId}>Search</Button>
      </form>

      {!searchQuery ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-16 text-muted-foreground">
          <Activity className="mb-3 h-8 w-8 opacity-30" />
          <p>Search for a user to see their sessions</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !sessions?.length ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12">
          <p className="text-muted-foreground">No sessions found for this user</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? "s" : ""} found</p>
          {sessions.map((session) => {
            const duration = session.ended_at
              ? Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
              : 0;
            return (
              <Card key={session.session_id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">{session.session_id.slice(0, 12)}...</p>
                      {!session.ended_at && <Badge className="bg-green-500/10 text-green-500 text-xs">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(session.started_at)} at {formatTime(session.started_at)}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm font-medium">{session.event_count}</p>
                      <p className="text-xs text-muted-foreground">events</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{duration > 0 ? formatDuration(duration) : "—"}</p>
                      <p className="text-xs text-muted-foreground">duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
