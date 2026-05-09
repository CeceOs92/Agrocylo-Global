import AuthGuard from "@/components/AuthGuard";
import { AdminSidebar } from "./_components/admin-sidebar";
import { AdminHeader } from "./_components/admin-header";
import { DashboardFooter } from "@/components/shared/dashboard-footer";

export const metadata = {
  title: {
    template: "%s | AgroCylo Admin",
    default: "Admin",
  },
};

// Admin pages currently require any onboarded user; tighten to a dedicated
// `admin` role once the backend models it.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main
          className="flex-1 overflow-y-auto p-6"
          data-lenis-prevent
        >
          <AuthGuard>{children}</AuthGuard>
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}
