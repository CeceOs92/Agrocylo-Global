"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Order } from "@/types/order";

// Backend endpoint /api/admin/orders not exposed yet.
const orders: Order[] = [];

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
    accessorKey: "seller",
    header: "Seller",
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

export default function AdminOrdersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="All Orders"
        description="Every order placed across the platform."
      />

      {orders.length === 0 ? (
        <div className="bg-card rounded-2xl border p-10 text-center">
          <h3 className="text-lg font-semibold">No orders to show yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Hook up <code>/api/admin/orders</code> to populate this table.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="Search by order, buyer, or seller…"
        />
      )}
    </div>
  );
}
