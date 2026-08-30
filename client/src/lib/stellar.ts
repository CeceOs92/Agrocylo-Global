import { Horizon, rpc } from "@stellar/stellar-sdk";
import FreighterApi from "@stellar/freighter-api";
import {
  getStellarEnv,
  isMainnetEnv,
  MAINNET_PASSPHRASE,
  TESTNET_PASSPHRASE,
} from "../services/stellar/networkConfig";

// Map of Stellar network names to Horizon URLs
const HORIZON_URLS: Record<string, string> = {
  [MAINNET_PASSPHRASE]: "https://horizon.stellar.org",
  [TESTNET_PASSPHRASE]: "https://horizon-testnet.stellar.org",
};

// Map of Stellar network names to Soroban RPC URLs
const RPC_URLS: Record<string, string> = {
  [MAINNET_PASSPHRASE]: "https://soroban-rpc.mainnet.stellar.org",
  [TESTNET_PASSPHRASE]: "https://soroban-testnet.stellar.org",
};

/**
 * Network defaults, keyed off the single `NEXT_PUBLIC_STELLAR_ENV` switch.
 *
 * These are only ever a fallback when Freighter cannot be reached; a mainnet
 * build never falls back to testnet — see `mainnetGuard()`.
 */
export const DEFAULT_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  (getStellarEnv() === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
export const DEFAULT_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  (getStellarEnv() === "mainnet"
    ? "https://soroban-rpc.mainnet.stellar.org"
    : "https://soroban-testnet.stellar.org");

const DEFAULT_NETWORK_NAME =
  getStellarEnv() === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

/**
 * In a mainnet build, rethrows instead of letting a caller silently fall back
 * to a testnet endpoint when wallet detection fails AND no explicit mainnet
 * endpoint is configured. When `NEXT_PUBLIC_SOROBAN_RPC_URL` is set it already
 * points at mainnet, so falling back to it (via `DEFAULT_*`) is safe and we
 * don't throw — read-only calls like balance display keep working.
 */
function mainnetGuard(context: string, cause: unknown): void {
  if (isMainnetEnv() && !process.env.NEXT_PUBLIC_SOROBAN_RPC_URL) {
    throw new Error(
      `${context}, NEXT_PUBLIC_STELLAR_ENV=mainnet, and no NEXT_PUBLIC_SOROBAN_RPC_URL — ` +
        `refusing to fall back to testnet. ` +
        `Original error: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

let currentServer: Horizon.Server | null = null;
let currentRpcServer: rpc.Server | null = null;
let currentNetworkName: string | null = null;

/**
 * Get or create a Stellar Server instance based on the current Freighter network
 */
export async function getServer(): Promise<Horizon.Server> {
  try {
    // Fetch current network details from Freighter
    const networkDetails = await FreighterApi.getNetworkDetails();
    const networkName = networkDetails.network;

    // Only recreate server if network changed
    if (currentNetworkName === networkName && currentServer) {
      return currentServer;
    }

    const horizonUrl =
      HORIZON_URLS[networkName] ||
      networkDetails.networkUrl ||
      DEFAULT_HORIZON_URL;
    currentServer = new Horizon.Server(horizonUrl);
    currentNetworkName = networkName;
    return currentServer;
  } catch (err) {
    mainnetGuard("Failed to detect the wallet's network for Horizon", err);
    console.warn("Failed to detect Freighter network, using configured default:", err);
    if (!currentServer) {
      currentServer = new Horizon.Server(DEFAULT_HORIZON_URL);
      currentNetworkName = DEFAULT_NETWORK_NAME;
    }
    return currentServer;
  }
}

/**
 * Get or create a Soroban RPC Server instance based on the current Freighter network
 */
export async function getRpcServer(): Promise<rpc.Server> {
  try {
    const networkDetails = await FreighterApi.getNetworkDetails();
    const networkName = networkDetails.network;

    if (currentNetworkName === networkName && currentRpcServer) {
      return currentRpcServer;
    }

    const rpcUrl =
      RPC_URLS[networkName] ||
      (networkDetails as { rpcUrl?: string }).rpcUrl ||
      DEFAULT_RPC_URL;
    currentRpcServer = new rpc.Server(rpcUrl);
    // Keep network name in sync with Horizon if possible, but at least update if missing
    currentNetworkName = networkName;
    return currentRpcServer;
  } catch (err) {
    mainnetGuard("Failed to detect the wallet's network for Soroban RPC", err);
    console.warn("Failed to detect Freighter network for RPC, using configured default:", err);
    if (!currentRpcServer) {
      currentRpcServer = new rpc.Server(DEFAULT_RPC_URL);
      currentNetworkName = DEFAULT_NETWORK_NAME;
    }
    return currentRpcServer;
  }
}

export async function getXlmBalance(address: string): Promise<string> {
  try {
    const server = await getServer();
    const account = await server.loadAccount(address);
    const native = account.balances.find(
      (b: { asset_type: string }) => b.asset_type === "native",
    );
    return native?.balance ?? "0";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Unfunded accounts return 404 / "Not Found" from Horizon. That's a valid
    // empty-wallet state on testnet, not a failure — surface a zero balance.
    if (/404|not found/i.test(message)) {
      return "0";
    }
    throw err;
  }
}

/**
 * Get the current network name from Freighter (or the cached one from getServer)
 */
export async function getCurrentNetworkName(): Promise<string> {
  try {
    // Prefer window.freighter if available (e.g. Playwright test mocks).
    const freighterDirect =
      typeof window !== "undefined"
        ? window.freighter ?? window.freighterApi ?? null
        : null;

    if (freighterDirect) {
      return await freighterDirect.getNetwork();
    }

    const networkDetails = await FreighterApi.getNetworkDetails();
    return networkDetails.network;
  } catch (err) {
    mainnetGuard("Failed to read the wallet's network name", err);
    // If we can't reach the wallet, return the cached network name (if available)
    // or the configured default for this environment.
    console.warn("Failed to get network name:", err);
    return currentNetworkName || DEFAULT_NETWORK_NAME;
  }
}
