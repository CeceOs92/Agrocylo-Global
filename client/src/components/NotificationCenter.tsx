"use client";

/**
 * NotificationCenter
 *
 * Full-page or modal notification history with:
 *   - Filter tabs (All / Orders / Disputes / System)
 *   - Search input
 *   - Per-item mark-read, delete actions
 *   - Mark all read / Clear all bulk actions
 *   - Infinite-scroll "Load more" button
 *   - Unread badge count in the header
 */

import { useState } from "react";
import { Bell, Search, Trash2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNotifications, type NotificationFilter } from "@/hooks/useNotifications";
import type { OrderEventNotification } from "@/services/notification/api";

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "orders", label: "Orders" },
  { id: "disputes", label: "Disputes" },
  { id: "system", label: "System" },
];

interface NotificationCenterProps {
  walletAddress: string | null;
  className?: string;
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: OrderEventNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const date = new Date(notification.createdAt);
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-colors",
        notification.isRead
          ? "bg-secondary/30 border-transparent"
          : "bg-background border-primary/20",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {notification.type}
          </Badge>
          {!notification.isRead && (
            <span className="size-1.5 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-sm leading-relaxed">{notification.message}</p>
        <p className="text-muted-foreground text-xs mt-1">
          {date.toLocaleDateString()} · {date.toLocaleTimeString()}
        </p>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Mark as read"
            onClick={() => onMarkRead(notification.id)}
          >
            <span className="size-2 rounded-full bg-primary/60" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-7"
          title="Delete"
          onClick={() => onDelete(notification.id)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationCenter({ walletAddress, className }: NotificationCenterProps) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [search, setSearch] = useState("");

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  } = useNotifications({ walletAddress, filter, search });

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="text-primary size-5" />
            <CardTitle className="text-base">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              title="Clear all"
              onClick={clearAll}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" />
          <Input
            placeholder="Search notifications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-y-auto space-y-2 pt-4">
        {error && (
          <p className="text-destructive text-sm text-center py-4">{error}</p>
        )}

        {isLoading && notifications.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && notifications.length === 0 && !error && (
          <p className="text-muted-foreground text-sm text-center py-10">
            No notifications here.
          </p>
        )}

        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onMarkRead={(id) => void markRead([id])}
            onDelete={deleteNotification}
          />
        ))}

        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isLoading}
            onClick={() => void loadNextPage()}
          >
            {isLoading ? "Loading…" : "Load more"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
