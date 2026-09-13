"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useActiveProject } from "@/hooks/use-projects";

/** How often to re-ask while the answer is still "nothing yet". */
const WAITING_POLL = 5_000;

type NamesResponse = { names?: string[] | null };

function hasAny(data: NamesResponse): boolean {
  return (data.names?.length ?? 0) > 0;
}

/**
 * Whether this project had ever received an event when the page loaded, and
 * whether one has arrived since.
 *
 * /query/events/names carries no date filter, so an empty list means "never",
 * not "nothing in the range you happen to be looking at". Every other endpoint
 * is range-scoped and would greet someone who simply picked a quiet week with a
 * welcome screen.
 *
 * The two halves are deliberately separate questions. `startedEmpty` is asked
 * once and then frozen, because a welcome screen that vanishes mid-sentence the
 * instant an event lands is worse than one that stays a beat too long.
 * `arrived` is the live half, and only runs when there is something to wait for.
 *
 * Both are keyed by project: the backend resolves the project from a cookie the
 * switcher writes, so the same URL answers differently after a switch.
 */
export function useFirstEvent() {
  const { project } = useActiveProject();
  const projectId = project?.id;

  const initial = useQuery({
    queryKey: ["firstEvent", "initial", projectId],
    queryFn: () => api.eventNames(),
    enabled: Boolean(projectId),
    // Frozen on purpose — see above. Without this the answer would refresh out
    // from under the screen that depends on it.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // A freshly installed server is often still coming up when the browser
    // first asks.
    retry: 3,
    select: hasAny,
  });

  const startedEmpty = initial.isSuccess ? !initial.data : undefined;

  const watch = useQuery({
    queryKey: ["firstEvent", "watch", projectId],
    queryFn: () => api.eventNames(),
    // Nothing to watch for on a project that already has data, and nothing to
    // watch for once the answer has changed: it cannot change back.
    enabled: startedEmpty === true,
    refetchInterval: (q) => (q.state.data && hasAny(q.state.data) ? false : WAITING_POLL),
    // The one poll in this dashboard that keeps going while the tab is in the
    // background. Somebody integrating an SDK has this window behind their
    // editor or their phone, and the whole promise of the screen is that the
    // answer is already waiting when they look back. It costs one small query
    // every few seconds and stops for good at the first event.
    refetchIntervalInBackground: true,
    select: hasAny,
  });

  return {
    /**
     * True if the project had no events at all when this page loaded,
     * `undefined` until the backend has answered — the caller needs to tell "no
     * events" apart from "don't know yet", or a project with years of data
     * flashes a welcome screen on every load.
     */
    startedEmpty,
    /** True once an event has landed while the welcome screen was up. */
    arrived: watch.data === true,
  };
}
