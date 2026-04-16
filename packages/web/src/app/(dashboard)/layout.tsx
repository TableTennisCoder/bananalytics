import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { ProjectGuard } from "@/components/dashboard/project-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pl-60">
        <Topbar />
        <main className="p-6">
          <ProjectGuard>{children}</ProjectGuard>
        </main>
      </div>
    </div>
  );
}
