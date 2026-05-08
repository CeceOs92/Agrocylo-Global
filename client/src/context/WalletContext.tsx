"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import type { WalletContextType } from "../types/wallet";
import { getXlmBalance, getCurrentNetworkName } from "../lib/stellar";
import { signAndSubmitTransaction } from "../lib/signTransaction";
import type { SignAndSubmitResult } from "../lib/signTransaction";
import FreighterApi from "@stellar/freighter-api";

const initialState: WalletContextType = {
  address: null,
  balance: null,
  connected: false,
  loading: false,
  error: null,
  network: null,
  connect: async () => {},
  disconnect: () => {},
  refreshBalance: async () => {},
  signAndSubmit: async () => ({ success: false, error: "Wallet not connected" }),
};

export const WalletContext = createContext<WalletContextType>(initialState);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cachedAddr = localStorage.getItem("walletAddress");
    const cachedNet = localStorage.getItem("walletNetwork");
    if (!cachedAddr) return;

    // Show cached state immediately so the UI doesn't flash a disconnected nav.
    setAddress(cachedAddr);
    setConnected(true);
    if (cachedNet) setNetwork(cachedNet);

    // Then reconcile with Freighter — the user may have switched wallets
    // outside of our app, in which case the cached address is stale and would
    // sign transactions for the wrong account.
    (async () => {
      try {
        const freighterDirect = window.freighter ?? window.freighterApi ?? null;
        const livePub = freighterDirect
          ? await freighterDirect.getPublicKey()
          : await FreighterApi.getPublicKey();

        if (livePub && livePub !== cachedAddr) {
          // Wallet switched — adopt the live key and refetch.
          setAddress(livePub);
          localStorage.setItem("walletAddress", livePub);
          const liveNet = await getCurrentNetworkName();
          setNetwork(liveNet);
          localStorage.setItem("walletNetwork", liveNet);
          const b = await getXlmBalance(livePub);
          setBalance(b);
          return;
        }

        const b = await getXlmBalance(cachedAddr);
        setBalance(b);
      } catch {
        // Freighter unreachable (e.g. extension uninstalled). Treat the cached
        // session as disconnected rather than silently signing with stale data.
        setAddress(null);
        setConnected(false);
        setNetwork(null);
        setBalance(null);
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("walletNetwork");
      }
    })();
  }, []);

  const refreshBalance = async (addr?: string) => {
    try {
      const a = addr ?? address;
      if (!a) return;
      const b = await getXlmBalance(a);
      setBalance(b);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch balance:", errorMsg);
      setError(errorMsg);
    }
  };

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer window.freighter / window.freighterApi if available (e.g. Playwright test mocks).
      // The @stellar/freighter-api npm package uses browser-extension messaging which
      // is unavailable in headless test contexts.
      const freighterDirect =
        typeof window !== "undefined"
          ? window.freighter ?? window.freighterApi ?? null
          : null;

      // Get current network
      const networkName = freighterDirect?.getNetwork
        ? await freighterDirect.getNetwork()
        : await getCurrentNetworkName();
      setNetwork(networkName);
      localStorage.setItem("walletNetwork", networkName);

      // Get public key
      const pub = freighterDirect
        ? await freighterDirect.getPublicKey()
        : await FreighterApi.getPublicKey();
      if (!pub) {
        throw new Error("Could not get public key from Freighter");
      }
      setAddress(pub);
      localStorage.setItem("walletAddress", pub);
      setConnected(true);
      await refreshBalance(pub);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setConnected(false);
      setAddress(null);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance(null);
    setConnected(false);
    setError(null);
    setNetwork(null);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletNetwork");
  };

  const signAndSubmit = useCallback(
    async (transactionXdr: string): Promise<SignAndSubmitResult> => {
      if (!connected || !address) {
        return { success: false, error: "Wallet not connected" };
      }
      setError(null);
      try {
        const result = await signAndSubmitTransaction(transactionXdr);
        // Refresh balance after a successful on-chain transaction
        if (result.success) {
          await refreshBalance();
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [connected, address]
  );

  const ctx = {
    address,
    balance,
    connected,
    loading,
    error,
    network,
    connect,
    disconnect,
    refreshBalance: async () => refreshBalance(),
    signAndSubmit,
  };

  return (
    <WalletContext.Provider value={ctx}>{children}</WalletContext.Provider>
  );
};
