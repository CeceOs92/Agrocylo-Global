"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import type { WalletContextType } from "../types/wallet";
import { getXlmBalance } from "../lib/stellar";
import { signAndSubmitTransaction } from "../lib/signTransaction";
import type { SignAndSubmitResult } from "../lib/signTransaction";
import {
  trackWalletConnected,
  trackWalletDisconnected,
} from "@/lib/analytics";
import {
  WALLET_ADAPTERS,
  getPreferredAdapter,
  savePreferredAdapter,
  FreighterAdapter,
} from "../lib/walletAdapters";

const CONNECT_TIMEOUT_MS = 12_000;

const initialState: WalletContextType = {
  address: null,
  balance: null,
  connected: false,
  loading: false,
  error: null,
  network: null,
  activeWalletId: null,
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
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cachedAddr = localStorage.getItem("walletAddress");
    const cachedNet = localStorage.getItem("walletNetwork");
    const cachedWalletId = localStorage.getItem("activeWalletId");
    if (!cachedAddr) return;

    setAddress(cachedAddr);
    setConnected(true);
    if (cachedNet) setNetwork(cachedNet);
    if (cachedWalletId) setActiveWalletId(cachedWalletId);

    (async () => {
      try {
        const adapter =
          WALLET_ADAPTERS.find((a) => a.id === cachedWalletId) ??
          FreighterAdapter;
        const livePub = await adapter.getPublicKey();

        if (livePub && livePub !== cachedAddr) {
          setAddress(livePub);
          localStorage.setItem("walletAddress", livePub);
          const liveNet = await adapter.getNetwork();
          setNetwork(liveNet);
          localStorage.setItem("walletNetwork", liveNet);
          const b = await getXlmBalance(livePub);
          setBalance(b);
          return;
        }

        const b = await getXlmBalance(cachedAddr);
        setBalance(b);
      } catch {
        setAddress(null);
        setConnected(false);
        setNetwork(null);
        setBalance(null);
        setActiveWalletId(null);
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("walletNetwork");
        localStorage.removeItem("activeWalletId");
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

  const connect = async (adapterId?: string) => {
    setLoading(true);
    setError(null);

    const adapter =
      (adapterId ? WALLET_ADAPTERS.find((a) => a.id === adapterId) : null) ??
      getPreferredAdapter();

    const isMobile =
      typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

    if (isMobile && !adapter.supportsMobile()) {
      const deepLink = adapter.mobileDeepLink();
      const hint = deepLink
        ? `Open ${adapter.name} at ${deepLink} and try again.`
        : `${adapter.name} is not supported on mobile. Please use a desktop browser with the ${adapter.name} extension installed.`;
      setError(hint);
      setLoading(false);
      return;
    }

    try {
      const pub = await Promise.race([
        adapter.getPublicKey(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s. ` +
                    `Make sure ${adapter.name} is unlocked and try again.`,
                ),
            ),
            CONNECT_TIMEOUT_MS,
          ),
        ),
      ]);

      const networkName = await adapter.getNetwork();

      setAddress(pub);
      setNetwork(networkName);
      setConnected(true);
      setActiveWalletId(adapter.id);
      trackWalletConnected(pub, {
        network: networkName,
        adapter: adapter.name,
      });

      localStorage.setItem("walletAddress", pub);
      localStorage.setItem("walletNetwork", networkName);
      localStorage.setItem("activeWalletId", adapter.id);
      savePreferredAdapter(adapter.id);

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
    if (address) {
      trackWalletDisconnected({
        network: network ?? undefined,
        adapter: activeWalletId ?? undefined,
      });
    }
    setAddress(null);
    setBalance(null);
    setConnected(false);
    setError(null);
    setNetwork(null);
    setActiveWalletId(null);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletNetwork");
    localStorage.removeItem("activeWalletId");
  };

  const signAndSubmit = useCallback(
    async (transactionXdr: string): Promise<SignAndSubmitResult> => {
      if (!connected || !address) {
        return { success: false, error: "Wallet not connected" };
      }
      setError(null);
      try {
        const result = await signAndSubmitTransaction(transactionXdr);
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
    [connected, address],
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        connected,
        loading,
        error,
        network,
        activeWalletId,
        connect,
        disconnect,
        refreshBalance: async () => refreshBalance(),
        signAndSubmit,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
