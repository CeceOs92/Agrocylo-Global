"use client";

import { useState } from "react";
import Image from "next/image";
import { Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { WALLET_ADAPTERS } from "@/lib/walletAdapters";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export default function WalletModal() {
  const { connect, loading, error } = useWallet();
  const [open, setOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const onMobile = isMobileBrowser();

  const handleSelect = async (adapterId: string) => {
    setConnectingId(adapterId);
    await connect(adapterId);
    setConnectingId(null);
    // Dialog stays open when there is an error so the user can read it.
    // connect-wallet-inner.tsx handles post-connection redirect on success.
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="hidden sm:inline-flex" disabled={loading}>
          <Wallet className="size-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="inline-flex sm:hidden"
          disabled={loading}
          aria-label="Connect Wallet"
        >
          <Wallet className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect a Wallet</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {WALLET_ADAPTERS.map((adapter) => {
            const unavailable = onMobile && !adapter.supportsMobile();
            const isConnecting = connectingId === adapter.id;

            return (
              <li key={adapter.id}>
                <button
                  type="button"
                  disabled={loading || unavailable}
                  onClick={() => void handleSelect(adapter.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={adapter.icon}
                      alt={adapter.name}
                      fill
                      className="object-contain p-1"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-none">{adapter.name}</p>
                    {unavailable && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Desktop only
                      </p>
                    )}
                    {adapter.supportsMobile() && onMobile && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Mobile supported
                      </p>
                    )}
                  </div>
                  {isConnecting && (
                    <span className="ml-auto size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {onMobile && (
          <p className="text-center text-xs text-muted-foreground">
            On mobile, only wallets marked &quot;Mobile supported&quot; work
            directly. Others require a desktop browser.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
