"use client";

import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/demo-mode";
import { DEMO_PROJECT } from "@/lib/demo-data";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/constants";
import type { Project, ProjectsListResponse, RotatedKeys } from "@/types/projects";

async function fetchProjects(): Promise<Project[]> {
  // The demo runs without a backend, so hand back the stub project rather than
  // letting every page that needs one fail.
  if (isDemoMode()) return [DEMO_PROJECT];

  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch projects");
  const data: ProjectsListResponse = await res.json();
  return data.projects ?? [];
}

async function createProject(name: string): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || "failed to create project");
  }
  return res.json();
}

async function rotateKeys(projectId: string): Promise<RotatedKeys> {
  const res = await fetch(`/api/projects/${projectId}/keys/rotate`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || "failed to rotate keys");
  }
  return res.json();
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRotateKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rotateKeys,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/**
 * The cookie only changes through the switcher, which navigates afterwards, so
 * there is no store to subscribe to — just a value to read on render.
 */
const noUpdates = () => () => {};

function readActiveId(): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACTIVE_PROJECT_COOKIE}=`));
  return match ? match.split("=")[1] : null;
}

/**
 * The project the dashboard is currently pointed at.
 *
 * The switcher records the choice in a cookie the backend proxy reads too, so
 * the cookie — not React state — is the source of truth. Falls back to the
 * first project, which is what someone with exactly one project has selected
 * whether they ever touched the switcher or not.
 *
 * Read through useSyncExternalStore because there is no cookie on the server:
 * the server snapshot is null, and React reconciles the real value in without
 * the markup disagreeing with itself on hydration.
 */
export function useActiveProject() {
  const { data: projects, isLoading } = useProjects();
  const activeId = useSyncExternalStore(noUpdates, readActiveId, () => null);

  const project = projects?.find((p) => p.id === activeId) ?? projects?.[0];
  return { project, isLoading };
}
