"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_WALLET_ID, WALLET_ADAPTERS, getWalletAdapter } from "@/lib/wallets/registry";
import {
  clearWalletSession,
  loadWalletSession,
  saveWalletSession,
} from "@/lib/walletSession";

export type WalletState = "unavailable" | "disconnected" | "wrong_network" | "connected";

export interface WalletOption {
  id: string;
  name: string;
  installed: boolean;
  installUrl: string;
}

interface WalletContextType {
  address: string | null;
  connected: boolean;
  loading: boolean;
  reconnecting: boolean;
  error: string | null;
  walletState: WalletState;
  walletId: string;
  wallets: WalletOption[];
  connect: (walletId?: string) => Promise<string | null>;
  disconnect: () => void;
  selectWallet: (walletId: string) => void;
}

const defaultCtx: WalletContextType = {
  address: null,
  connected: false,
  loading: false,
  reconnecting: false,
  error: null,
  walletState: "disconnected",
  walletId: DEFAULT_WALLET_ID,
  wallets: [],
  connect: async () => null,
  disconnect: () => {},
  selectWallet: () => {},
};

export const WalletContext = createContext<WalletContextType>(defaultCtx);

function listWallets(): WalletOption[] {
  return WALLET_ADAPTERS.map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    installed: adapter.isAvailable(),
    installUrl: adapter.installUrl,
  }));
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string>(DEFAULT_WALLET_ID);
  const [wallets, setWallets] = useState<WalletOption[]>([]);

  useEffect(() => {
    setWallets(listWallets());
  }, []);

  const applyConnection = useCallback((pub: string, id: string) => {
    setAddress(pub);
    setConnected(true);
    setError(null);
    setWalletId(id);
    saveWalletSession({ address: pub, connectedAt: Date.now(), walletId: id });
  }, []);

  const clearConnection = useCallback(() => {
    setAddress(null);
    setConnected(false);
    setError(null);
    clearWalletSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const session = loadWalletSession();
      if (!session) return;

      const id = session.walletId ?? DEFAULT_WALLET_ID;
      setWalletId(id);
      setReconnecting(true);
      try {
        const pub = await getWalletAdapter(id).getPublicKey();
        if (cancelled) return;

        if (!pub) {
          clearWalletSession();
          return;
        }

        applyConnection(pub, id);
      } catch {
        if (!cancelled) clearWalletSession();
      } finally {
        if (!cancelled) setReconnecting(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applyConnection]);

  const connect = useCallback(
    async (requestedWalletId?: string) => {
      const id = requestedWalletId ?? walletId;
      setLoading(true);
      setError(null);
      try {
        const pub = await getWalletAdapter(id).getPublicKey();
        if (!pub) throw new Error(`Could not get public key from ${getWalletAdapter(id).name}`);
        applyConnection(pub, id);
        return pub;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setError(errMsg);
        setConnected(false);
        setAddress(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyConnection, walletId],
  );

  const disconnect = useCallback(() => {
    clearConnection();
  }, [clearConnection]);

  const selectWallet = useCallback((id: string) => {
    setWalletId(id);
  }, []);

  const walletState: WalletState = !connected
    ? address
      ? "wrong_network"
      : "disconnected"
    : "connected";

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        loading,
        reconnecting,
        error,
        walletState,
        walletId,
        wallets,
        connect,
        disconnect,
        selectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
