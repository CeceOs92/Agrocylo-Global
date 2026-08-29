import FreighterApi from "@stellar/freighter-api";
import { getFreighterPublicKey } from "@/lib/walletFreighter";
import { getFreighterSignerFromWindow } from "@/types/freighter";
import type { WalletAdapter } from "./types";

function hasWindowFreighter(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as { freighter?: unknown; freighterApi?: unknown };
  return Boolean(w.freighter || w.freighterApi);
}

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",
  installUrl: "https://freighter.app",

  isAvailable() {
    return hasWindowFreighter();
  },

  async getPublicKey() {
    return getFreighterPublicKey();
  },

  async getNetwork() {
    try {
      const details = await FreighterApi.getNetworkDetails();
      return { networkPassphrase: details.networkPassphrase };
    } catch {
      return null;
    }
  },

  async signTransaction(xdr, opts) {
    const signer = getFreighterSignerFromWindow();
    const signed = signer
      ? await signer.signTransaction(xdr, opts)
      : await FreighterApi.signTransaction(xdr, opts);
    if (!signed) throw new Error("Transaction rejected by Freighter");
    return signed;
  },
};
