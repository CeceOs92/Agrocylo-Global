"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSellerOrders } from "@/hooks/queries/useOrders";
import type { Order } from "@/types/order";

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "orderId",
    header: "Order",
    cell: ({ getValue }) => (
      <span className="text-sm font-medium">#{String(getValue())}</span>
    ),
  },
  {
    accessorKey: "buyer",
    header: "Buyer",
    cell: ({ getValue }) => {
      const v = String(getValue() ?? "");
      return (
        <span className="font-mono text-xs">
          {v ? `${v.slice(0, 6)}…${v.slice(-4)}` : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    enableGlobalFilter: false,
    cell: ({ getValue }) => (
      <span className="text-sm font-medium">
        {(Number(getValue() ?? 0) / 1e7).toFixed(2)} XLM
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableGlobalFilter: false,
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    enableGlobalFilter: false,
    cell: ({ getValue }) => {
      const v = Number(getValue());
      if (!v) return <span>—</span>;
      return (
        <span className="text-muted-foreground text-sm">
          {new Date(v * 1000).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableGlobalFilter: false,
    enableSorting: false,
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link href={`/orders/${row.original.orderId}`}>
          View <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    ),
  },
];

export default function FarmerOrdersDashboard() {
  const { data: orders = [], isLoading, error } = useSellerOrders();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Orders"
        description="Incoming orders from buyers — confirm delivery to release funds from escrow."
      />

      {error ? (
        <div className="bg-destructive/10 text-destructive border-destructive/30 rounded-2xl border p-6">
          {error instanceof Error ? error.message : "Failed to load orders."}
        </div>
      ) : isLoading ? (
        <div className="bg-card text-muted-foreground rounded-2xl border p-10 text-center text-sm">
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-2xl border p-10 text-center">
          <h3 className="text-lg font-semibold">No orders yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Once buyers place orders for your products, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Search by order ID or buyer address…"
        />
      )}
    </div>
  );
}
