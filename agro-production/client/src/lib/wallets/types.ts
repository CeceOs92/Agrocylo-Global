export interface WalletNetworkDetails {
  networkPassphrase: string;
}

export interface WalletAdapter {
  id: string;
  name: string;
  installUrl: string;
  /** Whether the wallet's browser extension/API is present. Best-effort. */
  isAvailable(): boolean;
  getPublicKey(): Promise<string | null>;
  getNetwork(): Promise<WalletNetworkDetails | null>;
  signTransaction(xdr: string, opts: { networkPassphrase: string }): Promise<string>;
}
