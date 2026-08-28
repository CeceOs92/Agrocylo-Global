/**
 * Network Badge — displays the currently active network (testnet vs mainnet).
 *
 * Shown prominently in the UI so users always have a clear signal of which
 * network they're interacting with. Critical for preventing accidental mainnet
 * fund transfers when intended for testnet (or vice versa).
 */

import React, { useEffect, useState } from "react";
import { isMainnet, isTestnet } from "@/services/stellar/networkConfig";

export interface NetworkBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({
  className = "",
  showLabel = true,
}) => {
  const [network, setNetwork] = useState<"mainnet" | "testnet" | "unknown" | null>(null);

  useEffect(() => {
    try {
      if (isMainnet()) {
        setNetwork("mainnet");
      } else if (isTestnet()) {
        setNetwork("testnet");
      } else {
        setNetwork("unknown");
      }
    } catch {
      setNetwork(null);
    }
  }, []);

  if (!network) return null;

  const isMainnetNetwork = network === "mainnet";
  const badgeColor = isMainnetNetwork ? "bg-red-600" : "bg-yellow-600";
  const textColor = "text-white";
  const label = isMainnetNetwork ? "MAINNET" : network === "unknown" ? "UNKNOWN" : "TESTNET";

  return (
    <div
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${badgeColor} ${textColor} ${className}`}
      role="status"
      aria-label={`Network: ${label}`}
      title={`Connected to ${label}${isMainnetNetwork ? " — REAL FUNDS" : ""}`}
    >
      {showLabel ? label : null}
    </div>
  );
};

export default NetworkBadge;
