"use client";

import { BarChart3, TrendingUp, Users, ShoppingBag } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  EarningsLineChart,
  OrdersBarChart,
} from "@/components/shared/charts";

export default function AdminAnalyticsPage() {
  // Until /api/admin/analytics is wired up, render zeroed series so the
  // charts and cards keep their layout — they'll fill in automatically once
  // the backend exposes aggregates.
  const series = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => ({
    month: m,
    gross: 0,
    net: 0,
  }));

  const ordersSeries = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => ({
    month: m,
    completed: 0,
    pending: 0,
    refunded: 0,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Platform-wide trends and historical aggregates."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly Volume"
          value="—"
          change="Awaiting backend"
          icon={TrendingUp}
        />
        <StatCard
          label="Conversion Rate"
          value="—"
          change="Order completion %"
          icon={BarChart3}
        />
        <StatCard
          label="New Users"
          value="—"
          change="Past 30 days"
          icon={Users}
        />
        <StatCard
          label="Orders Today"
          value="—"
          change="—"
          icon={ShoppingBag}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Volume Over Time</h2>
          <EarningsLineChart data={series} />
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Order Outcomes</h2>
          <OrdersBarChart data={ordersSeries} />
        </div>
      </div>
    </div>
  );
}
