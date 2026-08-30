"use client";

import { useEffect, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import {
  estimateInclusionFee,
  formatFeeXlm,
  type FeeEstimate,
} from "@/lib/feeStrategy";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

/**
 * Live inclusion-fee estimate for the current network conditions, refreshed on
 * an interval so the figure shown to the user before signing tracks congestion.
 */
export function useNetworkFee(pollMs = 20_000): {
  estimate: FeeEstimate | null;
  displayXlm: string;
} {
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);

  useEffect(() => {
    let cancelled = false;
    const server = new rpc.Server(RPC_URL);

    const refresh = async () => {
      const next = await estimateInclusionFee(server);
      if (!cancelled) setEstimate(next);
    };

    refresh();
    const id = setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return {
    estimate,
    displayXlm: estimate ? formatFeeXlm(estimate.inclusionFee) : "—",
  };
}
