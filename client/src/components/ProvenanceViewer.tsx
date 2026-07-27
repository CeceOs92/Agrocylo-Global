"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Leaf,
  MapPin,
  QrCode,
  Share2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTruncatedAddress } from "@/lib/helpers/format-address";
import { cn } from "@/lib/utils";
import type { ProvenanceRecord } from "@/types/provenance";

export interface ProvenanceViewerProps {
  record?: ProvenanceRecord | null;
  isLoading?: boolean;
  className?: string;
  title?: string;
}

/** Lightweight QR via Google Charts API (no extra dependency). */
function QrImage({ value, size = 128 }: { value: string; size?: number }) {
  const src = useMemo(() => {
    const encoded = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
  }, [value, size]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Provenance QR code"
      width={size}
      height={size}
      className="rounded-lg border bg-white p-1"
      data-testid="provenance-qr"
    />
  );
}

export function ProvenanceViewer({
  record,
  isLoading = false,
  className,
  title = "Supply-chain provenance",
}: ProvenanceViewerProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!record || !record.tracked) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm" data-testid="provenance-fallback">
            Provenance tracking is not available for this listing yet. Orders
            placed after tracking is enabled will show farm origin, harvest
            batch, and delivery milestones here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Leaf className="size-3.5" />
            Traceable
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">Farmer</p>
            <p className="mt-0.5 font-medium">
              {record.farmerName ||
                (record.farmerAddress
                  ? formatTruncatedAddress(record.farmerAddress)
                  : "—")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Batch ID</p>
            <p className="mt-0.5 font-mono text-xs">
              {record.batchId ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Harvest date</p>
            <p className="mt-0.5">
              {record.harvestDate
                ? new Date(record.harvestDate).toLocaleDateString()
                : "—"}
            </p>
          </div>
          {record.originLocation && (
            <div>
              <p className="text-muted-foreground text-xs">Origin</p>
              <p className="mt-0.5 flex items-center gap-1">
                <MapPin className="size-3.5" />
                {record.originLocation}
              </p>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Delivery milestones</p>
          <ol className="space-y-3">
            {record.milestones.map((m) => (
              <li key={m.id} className="flex gap-3">
                <span className="mt-0.5 shrink-0">
                  {m.status === "completed" ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : m.status === "current" ? (
                    <Circle className="text-primary size-4 fill-current" />
                  ) : (
                    <Circle className="text-muted-foreground size-4" />
                  )}
                </span>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      m.status === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </p>
                  {m.description && (
                    <p className="text-muted-foreground text-xs">
                      {m.description}
                    </p>
                  )}
                  {m.date && (
                    <p className="text-muted-foreground text-xs">
                      {new Date(m.date).toLocaleString()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Separator />

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <QrCode className="size-4" />
              Shareable provenance
            </p>
            <p className="text-muted-foreground flex items-center gap-1 text-xs break-all">
              <Share2 className="size-3 shrink-0" />
              {record.shareUrl}
            </p>
          </div>
          <QrImage value={record.shareUrl} />
        </div>
      </CardContent>
    </Card>
  );
}

export default ProvenanceViewer;
