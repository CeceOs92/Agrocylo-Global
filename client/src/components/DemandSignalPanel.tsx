"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DemandVolume } from "./DemandVolume";
import { BuyerIntents } from "./BuyerIntents";
import { getDemandData } from "@/services/demandService";
import type { DemandData } from "@/types/demand";

const RegionalHeatMap = dynamic(() => import("./RegionalHeatMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-2xl" />,
});

export function DemandSignalPanel() {
  const [data, setData] = useState<DemandData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getDemandData();
        if (!cancelled) setData(result);
      } catch (error) {
        console.error("Failed to fetch demand data:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand Signals"
        description="Real-time aggregate data on buyer intents and market volume."
      >
        <div className="bg-primary/10 border-primary/30 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-primary size-2 animate-pulse rounded-full" />
          <span className="text-primary text-xs font-medium">
            Live updates
          </span>
        </div>
      </PageHeader>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[500px] w-full rounded-2xl lg:col-span-2" />
        </div>
      ) : (
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
                High demand for Grains in the North Central region (Abuja).
                Demand for Tubers is growing in the South West (Lagos). Current
                market trend shows a 12% increase in total buyer intents over
                the last 24 hours.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
