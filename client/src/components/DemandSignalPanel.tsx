"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, RefreshCw, Clock } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DemandVolume } from "./DemandVolume";
import { BuyerIntents } from "./BuyerIntents";
import { getDemandData } from "@/services/demandService";
import type { DemandData } from "@/types/demand";
import { cn } from "@/lib/utils";

const RegionalHeatMap = dynamic(() => import("./RegionalHeatMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-2xl" />,
});

const AUTO_REFRESH_INTERVAL_MS = 30_000;

function formatLastUpdated(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString();
}

export function DemandSignalPanel() {
  const [data, setData] = useState<DemandData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [displayTime, setDisplayTime] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDemandData();
      setData(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch demand data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void load(), AUTO_REFRESH_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  // Relative time display ticker
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => setDisplayTime(formatLastUpdated(lastUpdated)), 5_000);
    setDisplayTime(formatLastUpdated(lastUpdated));
    return () => clearInterval(tick);
  }, [lastUpdated]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand Signals"
        description="Real-time aggregate data on buyer intents and market volume."
      >
        <div className="flex items-center gap-3">
          {/* Last updated */}
          {lastUpdated && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Clock className="size-3" />
              {displayTime}
            </span>
          )}

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              autoRefresh
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary/50 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground/50",
              )}
            />
            {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
          </button>

          {/* Manual refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={isLoading}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("size-3", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </PageHeader>

      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[500px] w-full rounded-2xl lg:col-span-2" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <DemandVolume data={data.volume} />
            <BuyerIntents intents={data.intents} />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <RegionalHeatMap data={data.heatMap} />

            <div className="bg-primary/5 border-primary/20 rounded-2xl border p-6">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="text-primary size-5" />
                <h3 className="font-semibold">Insights summary</h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {data.volume.growth_pct !== undefined && data.volume.growth_pct > 0
                  ? `Total demand is up ${data.volume.growth_pct.toFixed(1)}% vs last period. `
                  : ""}
                High demand for Grains in the North Central region (Abuja).
                Demand for Tubers is growing in the South West (Lagos). Fruits
                show the strongest category growth this period.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
