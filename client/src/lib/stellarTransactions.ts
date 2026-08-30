/**
 * Stellar / Soroban transaction pipeline — the ONE implementation.
 *
 * Consolidates what used to be three diverging modules (issue #809):
 *   - lib/signTransaction.ts       (real checkout path, no typed errors)
 *   - lib/soroban.ts               (a second status poller)
 *   - components/submitTransaction.ts (typed errors + retry, sandbox only)
 *
 * Every call site — the real order flow (CreateOrderForm → useEscrowContract →
 * WalletContext) and the escrow sandbox components — goes through here.
 *
 * Lifecycle:
 *   1. Frontend builds transaction (XDR)
 *   2. Wallet signs (Freighter prompt) — refused on a network mismatch
 *   3. Signed tx submitted to Soroban RPC, with retry/backoff on transient errors
 *   4. Poll for a terminal status and return a typed result
 */

import { TransactionBuilder } from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import FreighterApi from "@stellar/freighter-api";
import { getRpcServer } from "./stellar";
import { isTestMode } from "./testMode";
import {
  getExpectedNetworkPassphrase,
  normalizeToPassphrase,
} from "../services/stellar/networkConfig";

// ── Typed error classes ──────────────────────────────────────────────────

/** Thrown when the Soroban RPC is unreachable or returns a non-parseable response. */
export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Thrown when transaction polling exceeds the configured timeout. */
export class TimeoutError extends Error {
  public readonly hash: string;
  constructor(hash: string, timeoutMs: number) {
    super(`Transaction ${hash} was not confirmed within ${timeoutMs / 1000}s`);
    this.name = "TimeoutError";
    this.hash = hash;
  }
}

/** Thrown when the transaction reaches a terminal failure state on-chain. */
export class TransactionFailedError extends Error {
  public readonly hash: string;
  public readonly resultXdr?: string;
  constructor(hash: string, resultXdr?: string) {
    super(`Transaction ${hash} failed on-chain`);
    this.name = "TransactionFailedError";
    this.hash = hash;
    this.resultXdr = resultXdr;
  }
}

/**
 * Thrown when the connected wallet's active network does not match the network
 * the app is configured for. Refusing to sign/submit in this case prevents a
 * transaction being built for one ledger and executed against another.
 */
export class NetworkMismatchError extends Error {
  public readonly walletNetwork: string;
  public readonly expectedNetwork: string;
  constructor(walletNetwork: string, expectedNetwork: string) {
    super(
      `Wallet network mismatch: your wallet is on "${walletNetwork}" but this app is configured for "${expectedNetwork}". ` +
        "Switch your wallet to the correct network and try again.",
    );
    this.name = "NetworkMismatchError";
    this.walletNetwork = walletNetwork;
    this.expectedNetwork = expectedNetwork;
  }
}

// ── Types ────────────────────────────────────────────────────────────────

export type TransactionErrorKind =
  | "mismatch"
  | "rejected"
  | "network"
  | "timeout"
  | "failed";

export interface SignAndSubmitResult {
  success: boolean;
  txHash?: string;
  status?: string;
  resultXdr?: string;
  error?: string;
  /** Populated on failure so callers can branch without re-parsing `error`. */
  errorKind?: TransactionErrorKind;
}

export interface TransactionStatusResult {
  status: "SUCCESS" | "FAILED" | "PENDING" | "NOT_FOUND" | "TIMEOUT";
  txHash: string;
  resultXdr?: string;
  error?: string;
  response?: rpc.Api.GetTransactionResponse;
}

export interface SignTransactionOptions {
  /** Network passphrase override (app config is the source of truth otherwise). */
  networkPassphrase?: string;
  /** Polling timeout in ms after submission (default 30 000). */
  timeoutMs?: number;
  /** Polling interval in ms (default 2 000). */
  intervalMs?: number;
  /** Max submission retries for transient network errors (default 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff between retries (default 1 000). */
  baseDelayMs?: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 2_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;

// ── Helpers ──────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch failures
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("timeout") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("429")
    );
  }
  return false;
}

/**
 * The app's configured network is the source of truth for what we sign against.
 * The wallet's active network is only cross-checked — never silently trusted.
 * Throws {@link NetworkMismatchError} when they disagree, or in a mainnet build
 * with no passphrase configured (see `getExpectedNetworkPassphrase`).
 */
async function resolveNetworkPassphrase(override?: string): Promise<string> {
  if (override) return override;
  const expected = getExpectedNetworkPassphrase();
  try {
    const details = await FreighterApi.getNetworkDetails();
    const walletPassphrase =
      normalizeToPassphrase(details?.networkPassphrase) ??
      normalizeToPassphrase(details?.network);
    if (walletPassphrase && walletPassphrase !== expected) {
      throw new NetworkMismatchError(walletPassphrase, expected);
    }
  } catch (err) {
    if (err instanceof NetworkMismatchError) throw err;
    // Freighter unreachable (or a non-Freighter adapter): fall through to the
    // app's configured passphrase. WalletContext's mismatch guard + the
    // persistent banner still cover the wallet-on-wrong-network case.
  }
  return expected;
}

// ── Core API ─────────────────────────────────────────────────────────────

/**
 * Sign a transaction XDR using the Freighter wallet.
 * Throws if the user rejects, Freighter is unavailable, or the wallet network
 * does not match the app's configured network.
 */
export async function signTransaction(
  transactionXdr: string,
  opts?: Pick<SignTransactionOptions, "networkPassphrase">,
): Promise<string> {
  const networkPassphrase = await resolveNetworkPassphrase(opts?.networkPassphrase);

  // Prefer window.freighter if available (e.g. Playwright test mocks).
  const freighterDirect =
    typeof window !== "undefined"
      ? window.freighter ?? window.freighterApi ?? null
      : null;

  const signedXdr = freighterDirect
    ? await freighterDirect.signTransaction(transactionXdr, { networkPassphrase })
    : await FreighterApi.signTransaction(transactionXdr, { networkPassphrase });

  if (!signedXdr) {
    throw new Error("Transaction was rejected by the wallet");
  }
  return signedXdr;
}

/**
 * Poll the Soroban RPC for a transaction's terminal status.
 * Transient RPC errors during polling are swallowed until the timeout.
 */
export async function pollTransaction(
  txHash: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): Promise<TransactionStatusResult> {
  const server = await getRpcServer();
  const deadline = Date.now() + timeoutMs;

  let response = await server.getTransaction(txHash);
  while (
    response.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
    Date.now() < deadline
  ) {
    await delay(intervalMs);
    try {
      response = await server.getTransaction(txHash);
    } catch {
      // transient RPC error — keep polling until the deadline
    }
  }

  if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      status: "SUCCESS",
      txHash,
      resultXdr: response.resultMetaXdr?.toXDR("base64"),
      response,
    };
  }
  if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
    return {
      status: "FAILED",
      txHash,
      resultXdr: response.resultMetaXdr?.toXDR("base64"),
      error: "Transaction failed on-chain",
      response,
    };
  }
  return {
    status: "TIMEOUT",
    txHash,
    error: `Transaction polling timed out after ${timeoutMs / 1000}s`,
  };
}

/**
 * Submit a signed transaction XDR to the Soroban RPC and wait for a terminal
 * status. Retries transient network errors with exponential backoff.
 *
 * @throws {NetworkError}           RPC unreachable after all retries
 * @throws {TimeoutError}           not confirmed within the timeout
 * @throws {TransactionFailedError} terminal on-chain failure
 */
export async function submitTransactionOrThrow(
  signedXdr: string,
  opts?: SignTransactionOptions,
): Promise<{ txHash: string; resultXdr?: string }> {
  if (isTestMode()) {
    return {
      txHash: "0000000000000000000000000000000000000000000000000000000000000000",
      resultXdr: "AAAAAgAAAAB6Mcc=",
    };
  }

  const networkPassphrase = await resolveNetworkPassphrase(opts?.networkPassphrase);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  const server = await getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

  let sendResponse: rpc.Api.SendTransactionResponse | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      sendResponse = await server.sendTransaction(tx);
      break;
    } catch (error) {
      if (!isTransientError(error) || attempt === maxRetries) {
        throw new NetworkError(
          `Failed to submit transaction after ${attempt + 1} attempt(s): ${
            error instanceof Error ? error.message : String(error)
          }`,
          error,
        );
      }
      await delay(baseDelay * 2 ** attempt);
    }
  }
  if (!sendResponse) {
    throw new NetworkError("Failed to submit transaction: no response received");
  }
  if (sendResponse.status === "ERROR") {
    throw new TransactionFailedError(
      sendResponse.hash,
      sendResponse.errorResult?.toXDR("base64") ?? undefined,
    );
  }

  const polled = await pollTransaction(sendResponse.hash, timeoutMs, intervalMs);
  if (polled.status === "SUCCESS") {
    return { txHash: polled.txHash, resultXdr: polled.resultXdr };
  }
  if (polled.status === "FAILED") {
    throw new TransactionFailedError(polled.txHash, polled.resultXdr);
  }
  throw new TimeoutError(polled.txHash, timeoutMs);
}

/**
 * Submit a signed transaction and return a result object (never throws for the
 * expected failure modes). Failure results carry a typed `errorKind`.
 */
export async function submitTransaction(
  signedXdr: string,
  opts?: SignTransactionOptions,
): Promise<SignAndSubmitResult> {
  try {
    const { txHash, resultXdr } = await submitTransactionOrThrow(signedXdr, opts);
    return { success: true, txHash, status: "SUCCESS", resultXdr };
  } catch (err) {
    return toFailureResult(err);
  }
}

/**
 * End-to-end helper: sign then submit. The primary entry point for every
 * transaction-sending path in the app.
 */
export async function signAndSubmitTransaction(
  transactionXdr: string,
  opts?: SignTransactionOptions,
): Promise<SignAndSubmitResult> {
  try {
    const signedXdr = await signTransaction(transactionXdr, opts);
    return await submitTransaction(signedXdr, opts);
  } catch (err) {
    return toFailureResult(err);
  }
}

function toFailureResult(err: unknown): SignAndSubmitResult {
  if (err instanceof NetworkMismatchError) {
    return { success: false, error: err.message, errorKind: "mismatch" };
  }
  if (err instanceof TimeoutError) {
    return {
      success: false,
      txHash: err.hash,
      status: "TIMEOUT",
      error: err.message,
      errorKind: "timeout",
    };
  }
  if (err instanceof TransactionFailedError) {
    return {
      success: false,
      txHash: err.hash,
      status: "FAILED",
      resultXdr: err.resultXdr,
      error: err.message,
      errorKind: "failed",
    };
  }
  if (err instanceof NetworkError) {
    return { success: false, error: err.message, errorKind: "network" };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    error: message,
    errorKind: /rejected|denied|declined/i.test(message) ? "rejected" : undefined,
  };
}
