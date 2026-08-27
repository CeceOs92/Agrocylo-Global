"use client";

import { useEffect } from "react";
import { rpc } from "@stellar/stellar-sdk";
import {
  prunePendingTransactions,
  resolvePendingTransactions,
} from "@/lib/pendingTransactions";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

/**
 * On load (and periodically), re-checks any transaction that was submitted but
 * not confirmed before the tab closed / refreshed, and updates its stored
 * status. This is what lets a "pending" state survive a refresh and resolve
 * itself instead of stranding the user on a false failure.
 */
export default function PendingTransactionsResolver() {
  useEffect(() => {
    let cancelled = false;
    const server = new rpc.Server(RPC_URL);

    const tick = async () => {
      try {
        await resolvePendingTransactions({
          getTransaction: (hash) => server.getTransaction(hash),
        });
        if (!cancelled) prunePendingTransactions();
      } catch {
        /* offline / RPC error — try again on the next tick */
      }
    };

    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
