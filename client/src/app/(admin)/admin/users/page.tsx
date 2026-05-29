"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";

interface AdminUser {
  wallet: string;
  displayName: string;
  role: "farmer" | "buyer";
  country: string;
  joined: string;
  orders: number;
  status: "active" | "suspended";
}

// Backend endpoint /api/admin/users isn't exposed yet — show the empty state
// for now. The DataTable will pick up live data the moment the hook lands.
const users: AdminUser[] = [];

const columns: ColumnDef<AdminUser>[] = [
  {
    id: "user",
    header: "User",
    accessorFn: (row) => `${row.displayName} ${row.wallet} ${row.country}`,
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{u.displayName}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {u.wallet.slice(0, 6)}…{u.wallet.slice(-4)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    enableGlobalFilter: false,
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="capitalize">
        {String(getValue())}
      </Badge>
    ),
  },
  {
    accessorKey: "country",
    header: "Country",
    enableGlobalFilter: false,
  },
  {
    accessorKey: "orders",
    header: "Orders",
    enableGlobalFilter: false,
  },
  {
    accessorKey: "joined",
    header: "Joined",
    enableGlobalFilter: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    enableGlobalFilter: false,
    cell: ({ getValue }) => {
      const status = String(getValue());
      return (
        <Badge variant={status === "active" ? "success" : "destructive"}>
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableGlobalFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const u = row.original;
      const isActive = u.status === "active";
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>View profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            {isActive ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <UserX className="size-3.5" />
                Suspend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem>
                <UserCheck className="size-3.5" />
                Reinstate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function AdminUsersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Every farmer and buyer registered on the platform."
      />

      {users.length === 0 ? (
        <div className="bg-card rounded-2xl border p-10 text-center">
          <h3 className="text-lg font-semibold">No users to show yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Hook up <code>/api/admin/users</code> to populate this table.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchPlaceholder="Search by name, wallet, or country…"
        />
      )}
    </div>
  );
}
