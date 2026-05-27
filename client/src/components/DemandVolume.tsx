"use client";

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DemandVolume as DemandVolumeType } from "@/types/demand";

interface DemandVolumeProps {
  data: DemandVolumeType;
}

export function DemandVolume({ data }: DemandVolumeProps) {
  const entries = Object.entries(data.category_breakdown);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="text-primary size-4" />
          Current Demand Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-baseline gap-2">
          <span className="text-primary text-4xl font-bold tracking-tight">
            {Number(data.total_volume).toLocaleString()}
          </span>
          <span className="text-muted-foreground text-lg font-medium">
            {data.unit}
          </span>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Breakdown by Category
          </p>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No category data.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {entries.map(([category, volume]) => (
                <div
                  key={category}
                  className="bg-secondary/40 flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span className="text-sm font-medium">{category}</span>
                  <Badge variant="secondary" className="text-xs">
                    {Number(volume).toLocaleString()} {data.unit}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
