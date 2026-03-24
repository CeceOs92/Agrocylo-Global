import type { SignAndSubmitResult } from "../lib/signTransaction";

export interface WalletState {
  address: string | null;
  balance: string | null; // XLM balance as human-readable string
  connected: boolean;
  loading: boolean;
  error: string | null;
  network: string | null; // Current Stellar network name
}

export interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  /** Sign a transaction XDR with Freighter, submit it, and wait for confirmation. */
  signAndSubmit: (transactionXdr: string) => Promise<SignAndSubmitResult>;
}
