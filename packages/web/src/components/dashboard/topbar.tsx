"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, ExternalLink } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/live": "Live View",
  "/dashboard/events": "Event Explorer",
  "/dashboard/funnels": "Funnels",
  "/dashboard/retention": "Retention",
  "/dashboard/sessions": "Sessions",
  "/dashboard/journey": "User Journey",
  "/dashboard/geo": "Geography",
  "/dashboard/settings": "Settings",
};

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isDemo = pathname.startsWith("/demo");
  const normalizedPath = isDemo ? pathname.replace("/demo", "") : pathname;
  const title = pageTitles[normalizedPath] || "Dashboard";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/docs"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Docs
        </a>
        {!isDemo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Logout
          </Button>
        )}
      </div>
    </header>
  );
}
