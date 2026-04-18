"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProjects } from "@/hooks/use-projects";
import { ChevronDown, Plus, Check, Folder } from "lucide-react";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/constants";

export function ProjectSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hide entirely in demo mode
  const isDemo = pathname.startsWith("/demo");

  // Read active project from cookie on mount + whenever projects change
  useEffect(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${ACTIVE_PROJECT_COOKIE}=`));
    if (match) {
      setActiveId(match.split("=")[1]);
    } else if (projects && projects.length > 0) {
      setActiveId(projects[0].id);
    }
  }, [projects]);

  if (isDemo || !projects || projects.length === 0) return null;

  const active = projects.find((p) => p.id === activeId) ?? projects[0];

  const select = (projectId: string) => {
    document.cookie = `${ACTIVE_PROJECT_COOKIE}=${projectId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
    setActiveId(projectId);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{active.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 mt-1 z-40 w-56 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="py-1 max-h-64 overflow-y-auto">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => select(p.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === active.id && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-border">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/dashboard/projects/new");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new project
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
