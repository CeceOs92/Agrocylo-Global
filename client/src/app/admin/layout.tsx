import AuthGuard from "@/components/AuthGuard";

// Admin pages currently require any onboarded user; tighten to a dedicated
// `admin` role once the backend models it.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
