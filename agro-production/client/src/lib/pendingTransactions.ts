/**
 * Client-side persistence for submitted-but-unconfirmed transactions.
 *
 * A submitted Stellar transaction stays valid until its `setTimeout` time
 * bound expires and may be included after the client stops polling. Collapsing
 * that window into "failed" makes users retry and double-invest / double-order.
 * We instead persist every submitted tx hash keyed by its *intent* (a stable
 * string describing what the user is trying to do) so that:
 *
 *   - a still-pending intent blocks a duplicate submission, and
 *   - resolution resumes after a page refresh.
 *
 * The backend `Transaction` record (awaiting_signature/submitted status enum)
 * is the source of truth; this is the offline-capable mirror.
 */

export type PendingTxStatus = "submitted" | "confirmed" | "failed" | "expired";

export interface PendingTx {
  /** Stable identifier for what the user is doing, e.g. `invest:camp_42:GABC`. */
  intent: string;
  hash: string;
  status: PendingTxStatus;
  /** Epoch ms when the transaction was submitted. */
  createdAt: number;
  /** Epoch ms of the transaction's `setTimeout` bound, after which it is dead. */
  expiresAt: number;
}

const STORAGE_KEY = "agro:pending-transactions";

/** A pending tx is only "in flight" until its time bound passes. */
export function isInFlight(tx: PendingTx, now = Date.now()): boolean {
  return tx.status === "submitted" && tx.expiresAt > now;
}

function safeRead(): PendingTx[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingTx[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: PendingTx[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode, quota) — degrade to in-memory only */
  }
}

export function getPendingTransactions(): PendingTx[] {
  return safeRead();
}

/** The in-flight transaction for an intent, if any (expired ones are ignored). */
export function getInFlightForIntent(intent: string, now = Date.now()): PendingTx | null {
  return safeRead().find((tx) => tx.intent === intent && isInFlight(tx, now)) ?? null;
}

export function hasInFlightForIntent(intent: string, now = Date.now()): boolean {
  return getInFlightForIntent(intent, now) !== null;
}

/** Record a freshly-submitted transaction. Replaces any prior entry for the hash. */
export function recordSubmittedTransaction(params: {
  intent: string;
  hash: string;
  timeoutSeconds: number;
  now?: number;
}): PendingTx {
  const now = params.now ?? Date.now();
  const entry: PendingTx = {
    intent: params.intent,
    hash: params.hash,
    status: "submitted",
    createdAt: now,
    expiresAt: now + params.timeoutSeconds * 1000,
  };
  const list = safeRead().filter((tx) => tx.hash !== params.hash);
  list.push(entry);
  safeWrite(list);
  return entry;
}

/** Update the recorded status of a transaction once its outcome is known. */
export function updatePendingTransaction(hash: string, status: PendingTxStatus): void {
  const list = safeRead().map((tx) => (tx.hash === hash ? { ...tx, status } : tx));
  safeWrite(list);
}

/** Drop resolved/expired entries so the store does not grow unbounded. */
export function prunePendingTransactions(now = Date.now()): void {
  safeWrite(
    safeRead().filter((tx) => tx.status === "submitted" && tx.expiresAt > now),
  );
}

export interface TxStatusChecker {
  getTransaction: (hash: string) => Promise<{ status: string }>;
}

const SUCCESS_STATES = new Set(["SUCCESS"]);
const FAILURE_STATES = new Set(["FAILED", "ERROR"]);

/**
 * Re-check every still-in-flight transaction against the network and update its
 * stored status. Called on app load so a refresh resumes resolution instead of
 * leaving the user staring at a spinner or a false failure.
 *
 * Returns the resolved entries (confirmed / failed / expired) from this pass.
 */
export async function resolvePendingTransactions(
  checker: TxStatusChecker,
  now = Date.now(),
): Promise<PendingTx[]> {
  const list = safeRead();
  const resolved: PendingTx[] = [];

  for (const tx of list) {
    if (tx.status !== "submitted") continue;

    let networkStatus: string | null = null;
    try {
      networkStatus = (await checker.getTransaction(tx.hash)).status;
    } catch {
      networkStatus = null;
    }

    if (networkStatus && SUCCESS_STATES.has(networkStatus)) {
      tx.status = "confirmed";
      resolved.push(tx);
    } else if (networkStatus && FAILURE_STATES.has(networkStatus)) {
      tx.status = "failed";
      resolved.push(tx);
    } else if (tx.expiresAt <= now) {
      // Past its time bound and still not found: it can never be included now.
      tx.status = "expired";
      resolved.push(tx);
    }
    // else: still NOT_FOUND but within the time bound — genuinely pending.
  }

  safeWrite(list);
  return resolved;
}

/** Test / sign-out helper: wipe the store. */
export function clearPendingTransactions(): void {
  safeWrite([]);
}
