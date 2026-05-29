"use client";

import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const DISTANCES = [
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "All", value: 0 },
];

interface DistanceFilterProps {
  selected: number;
  onChange: (km: number) => void;
}

export default function DistanceFilter({
  selected,
  onChange,
}: DistanceFilterProps) {
  return (
    <div className="bg-card/95 flex items-center gap-1 rounded-full border p-1 shadow-lg backdrop-blur-sm">
      <span className="text-muted-foreground inline-flex items-center gap-1 pl-3 pr-1 text-xs font-medium">
        <Compass className="size-3.5" />
        Range
      </span>
      {DISTANCES.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            selected === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
