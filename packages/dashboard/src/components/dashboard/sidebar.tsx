"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  MousePointerClick,
  GitBranch,
  Users,
  Globe,
  Radio,
  Route,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/live", label: "Live", icon: Radio },
  { href: "/dashboard/events", label: "Events", icon: MousePointerClick },
  { href: "/dashboard/funnels", label: "Funnels", icon: GitBranch },
  { href: "/dashboard/retention", label: "Retention", icon: Users },
  { href: "/dashboard/sessions", label: "Sessions", icon: Activity },
  { href: "/dashboard/journey", label: "Journey", icon: Route },
  { href: "/dashboard/geo", label: "Geography", icon: Globe },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isDemo = pathname.startsWith("/demo");
  const prefix = isDemo ? "/demo" : "";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <span className="text-xl">&#x1F34C;</span>
        <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>Bananalytics</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const fullHref = `${prefix}${item.href}`;
          const isActive =
            item.href === "/dashboard"
              ? pathname === fullHref
              : pathname.startsWith(fullHref);

          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.label === "Live" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">Bananalytics v0.1</p>
      </div>
    </aside>
  );
}
