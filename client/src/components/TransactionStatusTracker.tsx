"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Undo2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CopyButton from "@/components/shared/copy-button";
import { getOrder, type Order } from "@/services/stellar/contractService";
import { formatTruncatedAddress } from "@/lib/helpers/format-address";
import { cn } from "@/lib/utils";

export type EscrowStatus = "pending" | "funded" | "delivered" | "refunded";

export interface TransactionStatusTrackerProps {
  orderId: string;
  initialStatus?: EscrowStatus;
  onStatusChange?: (status: EscrowStatus, order: Order) => void;
  pollInterval?: number;
  className?: string;
}

interface StatusConfig {
  label: string;
  description: string;
  badge:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
  Icon: typeof Clock;
}

const statusConfig: Record<EscrowStatus, StatusConfig> = {
  pending: {
    label: "Pending",
    description: "Transaction is waiting for funding.",
    badge: "warning",
    Icon: Clock,
  },
  funded: {
    label: "Funded",
    description: "Escrow has been funded successfully.",
    badge: "default",
    Icon: Banknote,
  },
  delivered: {
    label: "Delivered",
    description: "Goods have been delivered and confirmed.",
    badge: "success",
    Icon: CheckCircle2,
  },
  refunded: {
    label: "Refunded",
    description: "Funds have been returned to the buyer.",
    badge: "destructive",
    Icon: Undo2,
  },
};

const ORDER = ["pending", "funded", "delivered", "refunded"] as const;

function mapOrderStatusToEscrowStatus(orderStatus: string): EscrowStatus {
  switch (orderStatus.toLowerCase()) {
    case "created":
    case "pending":
      return "pending";
    case "funded":
    case "active":
      return "funded";
    case "delivered":
    case "completed":
      return "delivered";
    case "refunded":
    case "cancelled":
      return "refunded";
    default:
      return "pending";
  }
}

export function TransactionStatusTracker({
  orderId,
  initialStatus,
  onStatusChange,
  pollInterval = 5000,
  className,
}: TransactionStatusTrackerProps) {
  const [status, setStatus] = useState<EscrowStatus>(
    initialStatus ?? "pending",
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchOrderStatus = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await getOrder(orderId);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch order status");
      }
      const orderData = result.data;
      const newStatus = mapOrderStatusToEscrowStatus(orderData.status);
      setOrder(orderData);
      setLastUpdated(new Date());
      if (newStatus !== status) {
        setStatus(newStatus);
        onStatusChange?.(newStatus, orderData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, status, onStatusChange]);

  useEffect(() => {
    void fetchOrderStatus();
    const id = setInterval(fetchOrderStatus, pollInterval);
    return () => clearInterval(id);
  }, [fetchOrderStatus, pollInterval]);

  const current = statusConfig[status];
  const currentIdx = ORDER.indexOf(status);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Transaction Status</CardTitle>
          <Badge variant={current.badge} className="gap-1.5">
            <current.Icon className="size-3.5" />
            {current.label}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{current.description}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status timeline */}
        <div className="flex items-center gap-1">
          {ORDER.map((s, i) => {
            const cfg = statusConfig[s];
            const isActive = i === currentIdx;
            const isPast = i < currentIdx;
            return (
              <div key={s} className="flex flex-1 items-center gap-1">
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-content-center rounded-full text-xs transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isPast && "bg-primary/30 text-primary",
                    !isActive &&
                      !isPast &&
                      "bg-muted text-muted-foreground",
                  )}
                >
                  <cfg.Icon className="size-4" />
                </div>
                {i < ORDER.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      isPast || isActive ? "bg-primary/40" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground grid grid-cols-4 text-center text-[10px]">
          {ORDER.map((s) => (
            <span key={s}>{statusConfig[s].label}</span>
          ))}
        </div>

        {/* Order details */}
        {order && (
          <>
            <Separator />
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <KV label="Order ID" value={order.orderId} mono />
              <KV
                label="Amount"
                value={`${(Number(order.amount) / 10_000_000).toFixed(2)} XLM`}
                bold
              />
              <KV
                label="Buyer"
                value={formatTruncatedAddress(order.buyer)}
                mono
                copyValue={order.buyer}
              />
              <KV
                label="Seller"
                value={formatTruncatedAddress(order.seller)}
                mono
                copyValue={order.seller}
              />
              <KV
                label="Created"
                value={new Date(order.createdAt * 1000).toLocaleString()}
              />
            </div>
          </>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border p-3 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <span className="bg-primary size-1.5 rounded-full" />
            )}
            Last updated {lastUpdated.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchOrderStatus()}
            disabled={isLoading}
          >
            <RefreshCcw
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function KV({
  label,
  value,
  mono,
  bold,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  copyValue?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <span
          className={cn(
            "truncate text-sm",
            mono && "font-mono text-xs",
            bold && "font-semibold",
          )}
        >
          {value}
        </span>
        {copyValue && (
          <CopyButton
            text={copyValue}
            className="text-muted-foreground hover:text-foreground inline-flex items-center"
            iconClassName="!size-3"
          />
        )}
      </div>
    </div>
  );
}

export default TransactionStatusTracker;
