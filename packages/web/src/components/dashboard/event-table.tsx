"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatRelative } from "@/lib/format";
import type { EventResult } from "@/types/events";

interface EventTableProps {
  events: EventResult[];
  isLoading?: boolean;
}

export function EventTable({ events, isLoading }: EventTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-border p-12">
        <p className="text-muted-foreground">No events found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[140px]">Time</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="w-[80px]">Type</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="w-[100px]">Session</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <>
              <TableRow
                key={event.id}
                className="cursor-pointer"
                onClick={() =>
                  setExpandedId(expandedId === event.id ? null : event.id)
                }
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatRelative(event.timestamp)}
                </TableCell>
                <TableCell className="font-medium">{event.event}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {event.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                  {event.user_id || event.anonymous_id.slice(0, 12) + "..."}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {event.session_id ? event.session_id.slice(0, 8) + "..." : "—"}
                </TableCell>
              </TableRow>
              {expandedId === event.id && (
                <TableRow key={`${event.id}-detail`}>
                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Properties
                      </p>
                      <pre className="max-h-48 overflow-auto rounded-md bg-card p-3 font-mono text-xs">
                        {JSON.stringify(event.properties, null, 2)}
                      </pre>
                      <div className="flex gap-6 text-xs text-muted-foreground">
                        <span>
                          <strong>ID:</strong> {event.id}
                        </span>
                        <span>
                          <strong>Timestamp:</strong>{" "}
                          {formatTime(event.timestamp)}
                        </span>
                        <span>
                          <strong>Anonymous ID:</strong> {event.anonymous_id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
