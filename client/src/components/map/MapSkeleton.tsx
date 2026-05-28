"use client";

import { Map as MapIcon, Loader2 } from "lucide-react";

export default function MapSkeleton() {
  return (
    <div className="bg-secondary/40 relative h-full w-full">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="bg-primary/10 text-primary grid size-14 place-content-center rounded-full">
          <MapIcon className="size-6" />
        </div>
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading map…</p>
      </div>
    </div>
  );
}
