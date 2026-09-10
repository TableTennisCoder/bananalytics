import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DemoProvider } from "@/providers/demo-provider";
import { FilterProvider } from "@/providers/filter-provider";
import Link from "next/link";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <FilterProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 pl-60">
            <Topbar />
            {/* Demo banner */}
            <div className="border-b border-primary/20 bg-primary/[0.06] px-6 py-2 flex items-center justify-between">
              <p className="text-xs text-primary font-medium">
                Demo Mode — simulated data.{" "}
                <span className="font-normal text-primary/70">
                  Add a Segment filter and every chart follows it.
                </span>
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
      </FilterProvider>
    </DemoProvider>
  );
}
