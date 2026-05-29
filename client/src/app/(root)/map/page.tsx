"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Users } from "lucide-react";

import { useGeolocation } from "@/hooks/useGeolocation";
import { useFarmerLocations } from "@/hooks/useFarmerLocations";
import DistanceFilter from "@/components/map/DistanceFilter";
import MapSkeleton from "@/components/map/MapSkeleton";

const FarmerMap = dynamic(() => import("@/components/map/FarmerMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function MapPage() {
  const [radiusKm, setRadiusKm] = useState(50);
  const geo = useGeolocation();

  const { farmers, isLoading, error } = useFarmerLocations({
    latitude: geo.latitude,
    longitude: geo.longitude,
    radiusKm: radiusKm > 0 ? radiusKm : undefined,
  });

  return (
    // Header is fixed at h-20 (mobile) / h-28 (md+). Reserve that space.
    <div className="relative h-[calc(100vh-80px)] w-full md:h-[calc(100vh-112px)]">
      {/* Filter pill — floats at top, centred. */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
        <div className="pointer-events-auto">
          <DistanceFilter selected={radiusKm} onChange={setRadiusKm} />
        </div>
      </div>

      {/* Status pills — stack below the filter on the right. */}
      <div className="pointer-events-none absolute right-4 top-20 z-10 flex flex-col items-end gap-2">
        {!geo.isLoading && geo.error && (
          <Pill tone="warning">{geo.error}</Pill>
        )}
        {error && <Pill tone="destructive">{error}</Pill>}
      </div>

      {/* Farmer count */}
      {!isLoading && !geo.isLoading && (
        <div className="bg-card/95 absolute bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm">
          <Users className="text-muted-foreground size-3.5" />
          {farmers.length === 0
            ? "No farmers in this area"
            : `${farmers.length} farmer${farmers.length === 1 ? "" : "s"} nearby`}
        </div>
      )}

      {/* The map */}
      <div className="h-full w-full">
        {geo.isLoading ? (
          <MapSkeleton />
        ) : (
          <FarmerMap
            farmers={farmers}
            userLat={geo.latitude!}
            userLng={geo.longitude!}
            radiusKm={radiusKm}
          />
        )}
      </div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "warning" | "destructive";
  children: React.ReactNode;
}) {
  const colour =
    tone === "warning"
      ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <div
      className={`rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm ${colour}`}
    >
      {children}
    </div>
  );
}
