"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectsListResponse, RotatedKeys } from "@/types/projects";

async function fetchProjects(): Promise<Project[]> {
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
