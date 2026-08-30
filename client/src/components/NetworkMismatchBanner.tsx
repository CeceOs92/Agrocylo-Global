"use client";

/**
 * Persistent, page-level banner shown whenever the connected wallet's active
 * network does not match the network this app is configured for.
 *
 * This is deliberately a always-visible banner (not a toast): while it is
 * showing, signing and submission are refused by `WalletContext.signAndSubmit`
 * and `lib/stellarTransactions`, so checkout / escrow actions cannot proceed until
 * the user switches their wallet to the correct network.
 */

import { AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import {
  getStellarEnv,
  normalizeToPassphrase,
  MAINNET_PASSPHRASE,
} from "@/services/stellar/networkConfig";

function friendlyName(passphrase: string | null): string {
  if (!passphrase) return "an unknown network";
  if (passphrase === MAINNET_PASSPHRASE) return "Mainnet";
  return passphrase === "Test SDF Network ; September 2015"
    ? "Testnet"
    : passphrase;
}

export function NetworkMismatchBanner() {
  const { networkMismatch, network } = useWallet();

  if (!networkMismatch) return null;

  const expectedEnv = getStellarEnv();
  const walletName = friendlyName(normalizeToPassphrase(network));

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-[60] w-full border-b border-red-700 bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white"
    >
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        Wrong wallet network. Your wallet is on{" "}
        <strong>{walletName}</strong> but this app runs on{" "}
        <strong>{expectedEnv === "mainnet" ? "Mainnet" : "Testnet"}</strong>.
        Switch your wallet&apos;s network to continue — checkout and escrow
        actions are blocked until it matches.
      </span>
    </div>
  );
}

export default NetworkMismatchBanner;
