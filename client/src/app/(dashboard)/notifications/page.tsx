"use client";

import { useContext } from "react";
import { WalletContext } from "@/context/WalletContext";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationCenter } from "@/components/NotificationCenter";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export default function NotificationsPage() {
  const { address } = useContext(WalletContext);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="View your notification history and manage delivery preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NotificationCenter walletAddress={address} className="h-[calc(100vh-16rem)]" />
        </div>
        <div>
          <NotificationPreferences />
        </div>
      </div>
    </div>
  );
}
