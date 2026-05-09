"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/context/ProfileContext";
import AccountModal from "@/components/modals/account-modal";
import WalletModal from "@/components/modals/wallet-modal";

/**
 * Switches between the connect button (`WalletModal`) and the account
 * dropdown (`AccountModal`) based on Freighter connection state.
 *
 * Also redirects to `/onboarding` the first time we observe a fresh
 * `connected` transition for a wallet that doesn't have a profile yet.
 */
export function ConnectWalletInner() {
  const { connected, address } = useWallet();
  const { profile, isLoaded } = useProfile();
  const router = useRouter();
  const prevConnected = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    const justConnected = connected && !prevConnected.current;
    prevConnected.current = connected;

    if (justConnected && address && !profile) {
      router.push("/onboarding");
    }
  }, [connected, address, profile, isLoaded, router]);

  if (connected) {
    return <AccountModal />;
  }
  return <WalletModal />;
}
