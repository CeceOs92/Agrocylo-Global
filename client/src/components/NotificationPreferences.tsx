"use client";

/**
 * NotificationPreferences
 *
 * Per-type toggles (orders, disputes, price alerts, system),
 * delivery method selection (toast, email, push),
 * quiet hours range, sound toggle.
 * Preferences are persisted to localStorage until the API supports it.
 */

import { useEffect, useState } from "react";
import { Bell, Mail, Monitor, Volume2, VolumeX } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryMethod = "toast" | "email" | "push";

interface NotificationPrefs {
  types: {
    orders: boolean;
    disputes: boolean;
    priceAlerts: boolean;
    system: boolean;
    demandSignals: boolean;
  };
  delivery: Record<DeliveryMethod, boolean>;
  sound: boolean;
  quietHoursEnabled: boolean;
  quietStart: string; // "22:00"
  quietEnd: string;   // "08:00"
}

const DEFAULT_PREFS: NotificationPrefs = {
  types: {
    orders: true,
    disputes: true,
    priceAlerts: true,
    system: true,
    demandSignals: false,
  },
  delivery: {
    toast: true,
    email: false,
    push: false,
  },
  sound: true,
  quietHoursEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
};

const STORAGE_KEY = "agrocylo:notification-prefs";

function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? ({ ...DEFAULT_PREFS, ...JSON.parse(raw) } as NotificationPrefs) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Row({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function save(updated: NotificationPrefs) {
    setPrefs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function setType(key: keyof NotificationPrefs["types"], value: boolean) {
    save({ ...prefs, types: { ...prefs.types, [key]: value } });
  }

  function setDelivery(method: DeliveryMethod, value: boolean) {
    save({ ...prefs, delivery: { ...prefs.delivery, [method]: value } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="text-primary size-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Notification types */}
        <div>
          <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            Notification types
          </p>
          <div className="divide-y">
            <Row id="pref-orders" label="Order updates" description="Status changes for your orders" checked={prefs.types.orders} onChange={(v) => setType("orders", v)} />
            <Row id="pref-disputes" label="Disputes" description="New and resolved disputes" checked={prefs.types.disputes} onChange={(v) => setType("disputes", v)} />
            <Row id="pref-price" label="Price alerts" description="When commodities hit your targets" checked={prefs.types.priceAlerts} onChange={(v) => setType("priceAlerts", v)} />
            <Row id="pref-system" label="System announcements" checked={prefs.types.system} onChange={(v) => setType("system", v)} />
            <Row id="pref-demand" label="Demand signals" description="New buyer intents in your area" checked={prefs.types.demandSignals} onChange={(v) => setType("demandSignals", v)} />
          </div>
        </div>

        <Separator />

        {/* Delivery methods */}
        <div>
          <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            Delivery methods
          </p>
          <div className="divide-y">
            <Row id="del-toast" label="In-app toast" description="Instant notifications in the UI" checked={prefs.delivery.toast} onChange={(v) => setDelivery("toast", v)} />
            <Row id="del-email" label={<span className="flex items-center gap-1"><Mail className="size-3" /> Email</span> as unknown as string} checked={prefs.delivery.email} onChange={(v) => setDelivery("email", v)} />
            <Row id="del-push" label={<span className="flex items-center gap-1"><Monitor className="size-3" /> Browser push</span> as unknown as string} checked={prefs.delivery.push} onChange={(v) => setDelivery("push", v)} />
          </div>
        </div>

        <Separator />

        {/* Sound & quiet hours */}
        <div>
          <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            Sound & quiet hours
          </p>
          <Row
            id="pref-sound"
            label={
              <span className="flex items-center gap-1">
                {prefs.sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                Notification sounds
              </span> as unknown as string
            }
            checked={prefs.sound}
            onChange={(v) => save({ ...prefs, sound: v })}
          />
          <Row
            id="pref-quiet"
            label="Quiet hours"
            description="Suppress notifications during set hours"
            checked={prefs.quietHoursEnabled}
            onChange={(v) => save({ ...prefs, quietHoursEnabled: v })}
          />
          {prefs.quietHoursEnabled && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-xs">From</label>
                <input
                  type="time"
                  value={prefs.quietStart}
                  onChange={(e) => save({ ...prefs, quietStart: e.target.value })}
                  className="border-input rounded-md border bg-transparent px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-xs">To</label>
                <input
                  type="time"
                  value={prefs.quietEnd}
                  onChange={(e) => save({ ...prefs, quietEnd: e.target.value })}
                  className="border-input rounded-md border bg-transparent px-2 py-1 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
