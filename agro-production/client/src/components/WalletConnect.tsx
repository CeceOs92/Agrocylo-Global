"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { trackWalletConnected, trackWalletDisconnected } from "@/lib/analytics";

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

interface WalletConnectProps {
  className?: string;
}

const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015"
  ? "Stellar Public Network"
  : "Stellar Test Network";

export default function WalletConnect({ className = "" }: WalletConnectProps) {
  const {
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
  } = useWallet();
  const busy = loading || reconnecting;
  const [showWalletList, setShowWalletList] = useState(false);
  const activeWallet = wallets.find((w) => w.id === walletId);

  async function handleConnect(id?: string) {
    if (id) selectWallet(id);
    setShowWalletList(false);
    const addr = await connect(id);
    if (addr) trackWalletConnected(addr);
  }

  function handleDisconnect() {
    trackWalletDisconnected();
    disconnect();
  }

  if (walletState === "connected" && address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span
          className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2.5 py-1.5 rounded-lg"
          title={address}
          aria-label={`Connected wallet: ${address}`}
        >
          {shortAddr(address)}
        </span>
        <button
          onClick={handleDisconnect}
          aria-label="Disconnect wallet"
          className="text-sm text-muted hover:text-foreground border border-border px-2.5 py-1.5 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (walletState === "wrong_network") {
    return (
      <div className={`flex flex-col items-start gap-1 ${className}`}>
        <p className="text-xs text-yellow-700 max-w-xs" role="alert">
          Connected to wrong network — switch to {NETWORK_NAME} in Freighter
        </p>
      </div>
    );
  }

  if (walletState === "unavailable") {
    return (
      <div className={`flex flex-col items-start gap-1 ${className}`}>
        <p className="text-xs text-red-600 max-w-xs" role="alert">
          Freighter extension not found.{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-red-700"
          >
            Install Freighter
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        onClick={() => handleConnect()}
        disabled={busy}
        aria-label={busy ? "Connecting wallet" : "Connect wallet"}
        className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {reconnecting
          ? "Reconnecting…"
          : loading
            ? "Connecting…"
            : `Connect ${activeWallet?.name ?? "Wallet"}`}
      </button>

      {wallets.length > 1 && !busy && (
        <div className="relative">
          <button
            onClick={() => setShowWalletList((v) => !v)}
            aria-expanded={showWalletList}
            className="text-xs text-muted hover:text-foreground underline"
          >
            Use a different wallet
          </button>
          {showWalletList && (
            <ul className="absolute z-10 mt-1 bg-white border border-border rounded-lg shadow-sm py-1 min-w-[10rem]">
              {wallets.map((wallet) => (
                <li key={wallet.id}>
                  <button
                    onClick={() => handleConnect(wallet.id)}
                    aria-label={`Connect ${wallet.name}${wallet.installed ? "" : " (not installed, opens install page)"}`}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary-50 flex items-center justify-between gap-2"
                  >
                    <span>{wallet.name}</span>
                    {!wallet.installed && (
                      <span className="text-xs text-muted">Install</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 max-w-xs" role="alert">{error}</p>
      )}
    </div>
  );
}
