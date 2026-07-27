"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Leaf, MapPin, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyProducts } from "@/hooks/queries/useProducts";
import { buildForecastDashboard } from "@/services/forecastService";

const PriceForecastChart = dynamic(
  () =>
    import("@/components/shared/charts").then((m) => ({
      default: m.PriceForecastChart,
    })),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
);

const YieldEstimateChart = dynamic(
  () =>
    import("@/components/shared/charts").then((m) => ({
      default: m.YieldEstimateChart,
    })),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
);

/** Derive a simple seasonal baseline from product stock when real analytics are sparse. */
function pricesFromProducts(
  products: { price_per_unit: string; name: string }[],
): number[] {
  if (!products.length) return [];
  const base = products.map((p) => Number(p.price_per_unit) || 0).filter((n) => n > 0);
  if (!base.length) return [];
  const avg = base.reduce((a, b) => a + b, 0) / base.length;
  // Synthetic regional index curve around farmer's listed prices
  const factors = [0.92, 0.95, 0.98, 1.0, 1.04, 1.08, 1.05, 1.02, 0.99, 0.97, 0.94, 0.93];
  return factors.map((f) => Math.round(avg * f * 100) / 100);
}

export default function ForecastDashboardPage() {
  const { data: productsResponse, isLoading } = useMyProducts();
  const list = productsResponse?.items ?? [];

  const primary = list[0] as
    | { name?: string; location?: string; stock_quantity?: string | null; price_per_unit?: string; category?: string | null }
    | undefined;

  const dashboard = useMemo(() => {
    const crop = primary?.category || primary?.name || "Crop";
    const region = primary?.location || undefined;
    const historicalPrices = pricesFromProducts(
      list as { price_per_unit: string; name: string }[],
    );
    const stock = primary?.stock_quantity != null ? Number(primary.stock_quantity) : null;
    return buildForecastDashboard({
      region,
      crop: String(crop),
      historicalPrices,
      baseYield: stock && stock > 0 ? stock : historicalPrices.length ? historicalPrices[historicalPrices.length - 1]! * 4 : null,
    });
  }, [list, primary]);

  const latestPrice =
    [...dashboard.priceIndex].reverse().find((p) => typeof p.price === "number" && p.price > 0)
      ?.price ?? 0;
  const nextForecast =
    dashboard.priceIndex.find((p) => p.forecast != null && p.price == null)?.forecast ?? null;
  const avgYield =
    dashboard.yieldEstimates.length > 0
      ? dashboard.yieldEstimates.reduce((s, y) => s + y.estimated, 0) /
        dashboard.yieldEstimates.length
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Yield & price forecast"
        description="Regional price-index trends and seasonal yield estimates to plan production."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Region"
            value={dashboard.region}
            icon={MapPin}
            change={dashboard.crop}
          />
          <StatCard
            label="Price index"
            value={latestPrice ? latestPrice.toFixed(2) : "—"}
            icon={TrendingUp}
            change={
              nextForecast != null
                ? `Forecast next: ${Number(nextForecast).toFixed(2)}`
                : "Insufficient history"
            }
          />
          <StatCard
            label="Avg seasonal yield"
            value={avgYield ? avgYield.toFixed(1) : "—"}
            icon={Leaf}
            change="Estimated units / season"
          />
        </div>
      )}

      {dashboard.sparse && !isLoading ? (
        <div className="bg-card rounded-2xl border p-10 text-center">
          <BarChart3 className="text-muted-foreground mx-auto mb-3 size-8" />
          <h3 className="text-lg font-semibold">Sparse regional data</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Add products with location and pricing, or wait for the regional
            price-index service to populate this region. Charts will appear
            automatically once enough history exists.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="mb-4 font-semibold">Price-index trend</h2>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <PriceForecastChart data={dashboard.priceIndex} />
            )}
          </div>
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="mb-4 font-semibold">Seasonal yield estimates</h2>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <YieldEstimateChart data={dashboard.yieldEstimates} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
