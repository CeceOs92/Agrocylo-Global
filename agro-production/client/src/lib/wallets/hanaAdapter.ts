import type { WalletAdapter } from "./types";

interface HanaStellarBridge {
  getPublicKey(): Promise<string>;
  signTransaction(xdr: string, opts: { networkPassphrase: string }): Promise<string>;
  getNetworkDetails(): Promise<{ networkPassphrase: string }>;
}

function getHanaBridge(): HanaStellarBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as { hanaWallet?: { stellar?: HanaStellarBridge } }).hanaWallet
    ?.stellar;
  return bridge ?? null;
}

export const hanaAdapter: WalletAdapter = {
  id: "hana",
  name: "Hana Wallet",
  installUrl: "https://hanawallet.io",

  isAvailable() {
    return getHanaBridge() !== null;
  },

  async getPublicKey() {
    const bridge = getHanaBridge();
    if (!bridge) return null;
    const pub = await bridge.getPublicKey();
    return pub || null;
  },

  async getNetwork() {
    const bridge = getHanaBridge();
    if (!bridge) return null;
    try {
      const details = await bridge.getNetworkDetails();
      return { networkPassphrase: details.networkPassphrase };
    } catch {
      return null;
    }
  },

  async signTransaction(xdr, opts) {
    const bridge = getHanaBridge();
    if (!bridge) throw new Error("Hana Wallet extension not found");
    const signed = await bridge.signTransaction(xdr, opts);
    if (!signed) throw new Error("Transaction rejected by Hana Wallet");
    return signed;
  },
};
