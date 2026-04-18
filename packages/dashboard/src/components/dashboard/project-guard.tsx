"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { isDemoMode } from "@/lib/demo-mode";

/**
 * Wraps the dashboard content area. If the authenticated user has no projects,
 * shows a friendly "create your first project" CTA instead of the dashboard.
 *
 * Bypassed for the projects/new page (so users can actually create a project)
 * and for demo mode (which doesn't need projects).
 */
export function ProjectGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isCreatePage = pathname === "/dashboard/projects/new";
  const isDemo = pathname.startsWith("/demo/");
  const skipGuard = isCreatePage || isDemo || isDemoMode();

  const { data: projects, isLoading, error } = useProjects();

  useEffect(() => {
    // Auto-redirect to project creation when there's no project and we're on the dashboard root
    if (!skipGuard && !isLoading && projects && projects.length === 0 && pathname === "/dashboard") {
      router.push("/dashboard/projects/new");
    }
  }, [skipGuard, isLoading, projects, pathname, router]);

  if (skipGuard) return <>{children}</>;
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  if (error) return <>{children}</>; // fall through if API errors — let the page show its own error

  if (!projects || projects.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="border-border max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto text-5xl">🍌</div>
            <div>
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first project to start collecting analytics.
              </p>
            </div>
            <Button onClick={() => router.push("/dashboard/projects/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
