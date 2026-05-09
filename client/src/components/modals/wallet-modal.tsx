"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";

/**
 * "Connect Wallet" button that triggers the Freighter extension prompt.
 * Renders a compact icon button on mobile and the full label on desktop.
 */
export default function WalletModal() {
  const { connect, loading } = useWallet();

  return (
    <>
      <Button
        className="hidden sm:inline-flex"
        onClick={() => void connect()}
        disabled={loading}
        isLoading={loading}
      >
        <Wallet className="size-4" />
        Connect Wallet
      </Button>
      <Button
        size="icon"
        className="inline-flex sm:hidden"
        onClick={() => void connect()}
        disabled={loading}
        aria-label="Connect Wallet"
      >
        <Wallet className="size-4" />
      </Button>
    </>
  );
}
