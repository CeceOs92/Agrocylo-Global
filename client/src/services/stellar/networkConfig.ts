/**
 * Stellar / Soroban network configuration.
 *
 * Reads the active network from environment variables so the same code
 * works against a local standalone instance, the public testnet, or
 * mainnet without any code changes.
 *
 * Environment variables (set in `.env.local`):
 *   NEXT_PUBLIC_SOROBAN_RPC_URL   - Soroban RPC endpoint (REQUIRED)
 *   NEXT_PUBLIC_NETWORK_PASSPHRASE - Stellar network passphrase (REQUIRED)
 *   NEXT_PUBLIC_CONTRACT_ID        - Deployed escrow contract address
 */

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

/**
 * Checks if network config indicates mainnet (not testnet).
 * Used for production-build validation and UI network badge display.
 */
export function isMainnet(): boolean {
  const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "";
  return passphrase === "Public Global Stellar Network ; September 2015";
}

/**
 * Checks if network config indicates testnet (diagnostic only).
 */
export function isTestnet(): boolean {
  const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "";
  return passphrase === "Test SDF Network ; September 2015";
}

/** Currency → token contract ID map, validated once at module load. */
export const TOKEN_CONTRACT_IDS: Record<string, string> = {
  XLM: process.env.NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT_ID ?? "",
  USDC: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID_USDC ?? "",
};

/**
 * Validates that a token contract ID is configured for the given currency.
 * Throws a user-readable error naming the missing env var before any signing starts.
 */
export function requireTokenContractId(currency: string): string {
  const id = TOKEN_CONTRACT_IDS[currency.toUpperCase()];
  if (!id) {
    throw new Error(
      `Token contract ID for ${currency} is not configured. ` +
        `Set NEXT_PUBLIC_TOKEN_CONTRACT_ID_${currency.toUpperCase()} in your environment.`,
    );
  }
  return id;
}

/**
 * Returns the active network configuration.
 *
 * REQUIRES NEXT_PUBLIC_SOROBAN_RPC_URL and NEXT_PUBLIC_NETWORK_PASSPHRASE to be set.
 * Fails fast (throws) rather than silently falling back to testnet, preventing
 * production builds from accidentally signing against the wrong network.
 */
export function getNetworkConfig(): NetworkConfig {
  const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "NEXT_PUBLIC_SOROBAN_RPC_URL is not configured. " +
        "Set this environment variable to your Soroban RPC endpoint " +
        "(e.g., https://soroban-testnet.stellar.org or https://soroban-rpc.mainnet.stellar.org). " +
        "Without this, the app cannot connect to the blockchain.",
    );
  }

  const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
  if (!networkPassphrase) {
    throw new Error(
      "NEXT_PUBLIC_NETWORK_PASSPHRASE is not configured. " +
        "Set this environment variable to your Stellar network passphrase " +
        '(e.g., "Test SDF Network ; September 2015" for testnet or ' +
        '"Public Global Stellar Network ; September 2015" for mainnet). ' +
        "Without this, the app cannot sign transactions.",
    );
  }

  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

  return { rpcUrl, networkPassphrase, contractId };
}

/**
 * Validates that a deployed contract ID is available at runtime.
 * Throws a descriptive error when it is missing so consumers don't
 * silently attempt contract operations that will fail.
 */
export function requireContractId(): string {
  const id = process.env.NEXT_PUBLIC_CONTRACT_ID;
  if (!id) {
    throw new Error(
      "Contract ID is not configured. " +
        "Set NEXT_PUBLIC_CONTRACT_ID in your environment to point to the deployed escrow contract address. " +
        "Contract-dependent features will be unavailable until this is set.",
    );
  }
  return id;
}

/**
 * Validates that the native token contract ID is configured.
 * Throws a user-readable error naming the missing env var before any signing starts.
 */
export function requireNativeTokenContractId(): string {
  const id = process.env.NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT_ID ?? "";
  if (!id) {
    throw new Error(
      "Native token contract ID is not configured. " +
        "Set NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT_ID in your environment. " +
        "Native XLM token operations will be unavailable until this is set.",
    );
  }
  return id;
}

/**
 * One-stop helper: given a currency code, returns the corresponding token
 * contract ID. Throws when the currency is unknown or not configured.
 *
 * Use this from cart checkout, escrow pages, and any contract service call
 * so that token resolution is always consistent.
 */
export function getTokenContractId(currency: string): string {
  return requireTokenContractId(currency);
}

/**
 * Checks whether the contract ID environment variable is configured,
 * without throwing. Useful for UI guards that want to show a fallback
 * message instead of crashing.
 */
export function isContractConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CONTRACT_ID;
}
