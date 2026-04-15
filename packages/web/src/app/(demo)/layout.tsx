import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DemoProvider } from "@/providers/demo-provider";
import Link from "next/link";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 pl-60">
          <Topbar />
          {/* Demo banner */}
          <div className="border-b border-primary/20 bg-primary/[0.06] px-6 py-2 flex items-center justify-between">
            <p className="text-xs text-primary font-medium">
              Demo Mode — You are viewing simulated data
            </p>
            <Link
              href="/docs#quick-start"
              className="text-xs text-primary/70 hover:text-primary transition-colors underline underline-offset-2"
            >
              Deploy your own
            </Link>
          </div>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </DemoProvider>
  );
}
