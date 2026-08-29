import type { WalletAdapter } from "./types";

interface RabetConnectResult {
  publicKey?: string;
  error?: string;
}

interface RabetSignResult {
  xdr?: string;
  error?: string;
}

interface RabetBridge {
  connect(): Promise<RabetConnectResult>;
  sign(xdr: string, network: string): Promise<RabetSignResult>;
}

function getRabetBridge(): RabetBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as { rabet?: RabetBridge }).rabet;
  return bridge ?? null;
}

/** Rabet identifies networks by short name rather than full passphrase. */
function passphraseToRabetNetwork(networkPassphrase: string): string {
  return networkPassphrase.startsWith("Public Global Stellar Network")
    ? "mainnet"
    : "testnet";
}

export const rabetAdapter: WalletAdapter = {
  id: "rabet",
  name: "Rabet",
  installUrl: "https://rabet.io",

  isAvailable() {
    return getRabetBridge() !== null;
  },

  async getPublicKey() {
    const bridge = getRabetBridge();
    if (!bridge) return null;
    const result = await bridge.connect();
    if (result.error) throw new Error(result.error);
    return result.publicKey ?? null;
  },

  async getNetwork() {
    // Rabet exposes the active network only via the sign() response, not a
    // standalone lookup, so callers detect mismatches at sign time instead.
    return null;
  },

  async signTransaction(xdr, opts) {
    const bridge = getRabetBridge();
    if (!bridge) throw new Error("Rabet extension not found");
    const result = await bridge.sign(xdr, passphraseToRabetNetwork(opts.networkPassphrase));
    if (result.error) throw new Error(result.error);
    if (!result.xdr) throw new Error("Transaction rejected by Rabet");
    return result.xdr;
  },
};
