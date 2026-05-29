"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, Users, ShoppingBag, AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  EarningsLineChart,
  OrdersBarChart,
} from "@/components/shared/charts";
import {
  fetchAnalyticsData,
  type AnalyticsData,
} from "@/services/adminService";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const analyticsData = await fetchAnalyticsData();
      setData(analyticsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics data"
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const series = data?.series ?? ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => ({
    month: m,
    gross: 0,
    net: 0,
  }));

  const ordersSeries = data?.ordersSeries ?? ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => ({
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

      {error && (
        <div className="bg-destructive/10 border-destructive/30 flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <Button
            onClick={() => void loadData()}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-secondary/50 rounded-lg border border-border h-32 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Monthly Volume"
            value={data?.monthlyVolume ?? "—"}
            change="Last 30 days"
            icon={TrendingUp}
          />
          <StatCard
            label="Conversion Rate"
            value={data?.conversionRate ?? "—"}
            change="Order completion %"
            icon={BarChart3}
          />
          <StatCard
            label="New Users"
            value={data?.newUsers ?? "—"}
            change="Past 30 days"
            icon={Users}
          />
          <StatCard
            label="Orders Today"
            value={data?.ordersToday ?? "—"}
            change="Today's orders"
            icon={ShoppingBag}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Volume Over Time</h2>
          {isLoading ? (
            <div className="bg-secondary/50 rounded-lg h-64 animate-pulse" />
          ) : (
            <EarningsLineChart data={series} />
          )}
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Order Outcomes</h2>
          {isLoading ? (
            <div className="bg-secondary/50 rounded-lg h-64 animate-pulse" />
          ) : (
            <OrdersBarChart data={ordersSeries} />
          )}
        </div>
      </div>
    </div>
  );
}
