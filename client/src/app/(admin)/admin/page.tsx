"use client";

import Link from "next/link";
import {
  Users,
  ShoppingBag,
  Package,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Activity,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";

// Live admin aggregates depend on backend endpoints that aren't built yet.
// Render placeholder values for now; once /api/admin/stats lands, hook it
// up and these constants go away.
const kpis = [
  {
    label: "Total Volume (TVL)",
    value: "—",
    change: "Awaiting /api/admin/stats",
    icon: DollarSign,
  },
  {
    label: "Platform Revenue",
    value: "—",
    change: "3% of completed orders",
    icon: TrendingUp,
  },
  { label: "Total Users", value: "—", change: "Coming soon", icon: Users },
  {
    label: "Active Products",
    value: "—",
    change: "Coming soon",
    icon: Package,
  },
  {
    label: "Total Orders",
    value: "—",
    change: "Coming soon",
    icon: ShoppingBag,
  },
  {
    label: "Pending Escrow",
    value: "—",
    change: "Open orders",
    icon: Shield,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Overview"
        description={`Real-time analytics — ${new Date().toLocaleDateString(
          "en-US",
          { dateStyle: "long" },
        )}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Activity</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/admin/orders">
                All orders <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <Separator className="my-4" />
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
            <Activity className="size-8" />
            <p>Live order events will appear here once the socket bridge wires up to the admin feed.</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Users</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/admin/users">
                All users <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <Separator className="my-4" />
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
            <Users className="size-8" />
            <p>Hooked up once /api/admin/users is exposed by the backend.</p>
          </div>
        </div>
      </div>

      {/* Sample-only block kept to demonstrate the StatusBadge rendering */}
      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between p-6">
          <h2 className="font-semibold">Status Reference</h2>
          <span className="text-muted-foreground text-xs">
            Visual key
          </span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-5">
          <StatusBadge status="Pending" />
          <StatusBadge status="Delivered" />
          <StatusBadge status="Completed" />
          <StatusBadge status="Refunded" />
          <StatusBadge status="Disputed" />
        </div>
      </div>
    </div>
  );
}
