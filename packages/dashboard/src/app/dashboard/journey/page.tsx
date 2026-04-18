"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEvents } from "@/hooks/use-events";
import { JourneyFlow } from "@/components/dashboard/journey-flow";
import { Search, Route } from "lucide-react";

export default function JourneyPage() {
  const [userId, setUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: events, isLoading } = useEvents(
    searchQuery ? { user_id: searchQuery, limit: 100 } : {}
  );

  const hasQuery = !!searchQuery;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(userId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Journey</h1>
        <p className="text-sm text-muted-foreground">
          Visualize the complete path a user took through your app
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter user ID or anonymous ID..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="pl-9 font-mono"
          />
        </div>
        <Button type="submit" disabled={!userId}>
          Search
        </Button>
      </form>

      {!hasQuery ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-16 text-muted-foreground">
          <Route className="mb-3 h-8 w-8 opacity-30" />
          <p>Search for a user to see their journey</p>
        </div>
      ) : isLoading ? (
        <div className="h-[500px] animate-pulse rounded-lg bg-muted" />
      ) : !events?.length ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12">
          <p className="text-muted-foreground">No events found for this user</p>
        </div>
      ) : (
        <JourneyFlow events={events} className="h-[500px] rounded-lg border border-border" />
      )}
    </div>
  );
}
