"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/context/ProfileContext";
import { useWallet } from "@/hooks/useWallet";

export default function SettingsPage() {
  const { profile } = useProfile();
  const { address } = useWallet();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your profile, wallet, and notification preferences."
      />

      {/* Profile */}
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Profile</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          How buyers see you on the marketplace.
        </p>

        <div className="grid gap-5 max-w-2xl">
          <Input
            label="Display Name"
            defaultValue={profile?.display_name ?? ""}
            placeholder="Your farm or business name"
          />
          <Textarea
            placeholder="Tell buyers about your farm…"
            defaultValue={profile?.bio ?? ""}
            rows={3}
          />
          <div className="flex justify-end">
            <Button disabled>Save changes</Button>
          </div>
        </div>
      </section>

      {/* Wallet */}
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Wallet</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Stellar address linked to your profile.
        </p>

        <div className="grid gap-5 max-w-2xl">
          <div>
            <Label className="text-xs">Connected Address</Label>
            <p className="font-mono mt-1.5 break-all text-sm">
              {address ?? "Not connected"}
            </p>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Notifications</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          What you want to be notified about.
        </p>

        <div className="grid gap-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">New orders</p>
              <p className="text-muted-foreground text-xs">
                Get a toast when a buyer places an order.
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Payouts</p>
              <p className="text-muted-foreground text-xs">
                Notify me when funds settle to my wallet.
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Disputes</p>
              <p className="text-muted-foreground text-xs">
                Notify me when a buyer opens a dispute.
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>
        </div>
      </section>
    </div>
  );
}
