import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import FreighterApi from "@stellar/freighter-api";
import { getFreighterSignerFromWindow } from "@/types/freighter";
import {
  getInFlightForIntent,
  recordSubmittedTransaction,
  updatePendingTransaction,
} from "@/lib/pendingTransactions";

/**
 * A submitted transaction has exactly three terminal-for-now outcomes. Never
 * collapse `pending` into `failed`: the transaction is still valid until its
 * `setTimeout` bound and may be included after we stop polling.
 */
export type TransactionOutcome = "confirmed" | "failed" | "pending";

export interface SignAndSubmitResult {
  /** `true` only when the transaction is confirmed on-chain. */
  success: boolean;
  outcome: TransactionOutcome;
  txHash?: string;
  status?: string;
  error?: string;
  /** Set when the guard blocked a duplicate submission for an in-flight intent. */
  duplicate?: boolean;
}

export type TransactionSubmissionStage = "signing" | "submitting" | "confirming";

export interface SignAndSubmitOptions {
  /**
   * Stable identifier for what the user is doing (e.g. `invest:camp_42:GABC`).
   * When provided, a still-in-flight transaction for the same intent blocks a
   * second submission, and this submission is persisted for post-refresh
   * resolution.
   */
  intent?: string;
  /** Poll window in ms before returning `pending`. */
  confirmTimeoutMs?: number;
}

export class NetworkMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `Network mismatch: expected "${expected}" but Freighter is connected to "${actual}"`
    );
    this.name = "NetworkMismatchError";
  }
}

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

/** Matches the `.setTimeout(30)` bound every builder applies. */
const TX_TIME_BOUND_SECONDS = 30;
const DEFAULT_CONFIRM_TIMEOUT_MS = 30_000;

async function resolveNetworkPassphrase(): Promise<string> {
  try {
    const details = await FreighterApi.getNetworkDetails();
    return details.networkPassphrase;
  } catch {
    return NETWORK_PASSPHRASE;
  }
}

export async function signAndSubmitTransaction(
  transactionXdr: string,
  onStage?: (stage: TransactionSubmissionStage) => void,
  options: SignAndSubmitOptions = {},
): Promise<SignAndSubmitResult> {
  const { intent } = options;
  const confirmTimeoutMs = options.confirmTimeoutMs ?? DEFAULT_CONFIRM_TIMEOUT_MS;

  try {
    // Duplicate-submission guard: if a transaction for this intent is still
    // within its time bound, do not sign another one.
    if (intent) {
      const inFlight = getInFlightForIntent(intent);
      if (inFlight) {
        return {
          success: false,
          outcome: "pending",
          duplicate: true,
          txHash: inFlight.hash,
          status: "PENDING",
          error:
            "A transaction for this action is already in progress. Wait for it to resolve before trying again.",
        };
      }
    }

    const networkPassphrase = await resolveNetworkPassphrase();

    if (networkPassphrase !== NETWORK_PASSPHRASE) {
      throw new NetworkMismatchError(NETWORK_PASSPHRASE, networkPassphrase);
    }

    onStage?.("signing");
    const signer = getFreighterSignerFromWindow();
    const signedXdr = signer
      ? await signer.signTransaction(transactionXdr, { networkPassphrase })
      : await FreighterApi.signTransaction(transactionXdr, { networkPassphrase });

    if (!signedXdr) throw new Error("Transaction rejected by wallet");

    const server = new rpc.Server(RPC_URL);
    const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    onStage?.("submitting");
    const sendResponse = await server.sendTransaction(tx);

    if (sendResponse.status === "ERROR") {
      return {
        success: false,
        outcome: "failed",
        error: `Submission failed: ${sendResponse.status}`,
      };
    }

    const txHash = sendResponse.hash;
    if (intent) {
      recordSubmittedTransaction({
        intent,
        hash: txHash,
        timeoutSeconds: TX_TIME_BOUND_SECONDS,
      });
    }

    const deadline = Date.now() + confirmTimeoutMs;
    onStage?.("confirming");
    let result = await server.getTransaction(txHash);

    while (
      result.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 1_000));
      result = await server.getTransaction(txHash);
    }

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      if (intent) updatePendingTransaction(txHash, "confirmed");
      return { success: true, outcome: "confirmed", txHash, status: "SUCCESS" };
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      if (intent) updatePendingTransaction(txHash, "failed");
      return {
        success: false,
        outcome: "failed",
        txHash,
        status: result.status,
        error: "Transaction failed on-chain",
      };
    }

    // Still NOT_FOUND after the poll window. The transaction is valid until its
    // time bound and may yet be included — report it as pending, not failed.
    return {
      success: false,
      outcome: "pending",
      txHash,
      status: "PENDING",
      error:
        "Transaction is still pending. It has not failed — its status will resolve automatically.",
    };
  } catch (err) {
    return {
      success: false,
      outcome: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
