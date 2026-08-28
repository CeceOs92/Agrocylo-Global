import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSubmittedTransaction,
  getPendingTransactions,
  getInFlightForIntent,
  hasInFlightForIntent,
  updatePendingTransaction,
  resolvePendingTransactions,
  clearPendingTransactions,
  prunePendingTransactions,
} from "../lib/pendingTransactions";

const INTENT = "invest:camp_42:GABC";

describe("pendingTransactions", () => {
  beforeEach(() => {
    clearPendingTransactions();
  });

  it("records a submitted transaction as in-flight for its intent", () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });

    expect(hasInFlightForIntent(INTENT)).toBe(true);
    expect(getInFlightForIntent(INTENT)?.hash).toBe("HASH1");
    expect(getPendingTransactions()).toHaveLength(1);
  });

  it("blocks a duplicate: a second in-flight intent is still detected", () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });
    // The guard checks this before signing a second transaction.
    expect(hasInFlightForIntent(INTENT)).toBe(true);
  });

  it("stops blocking once the time bound passes", () => {
    const past = Date.now() - 60_000;
    recordSubmittedTransaction({
      intent: INTENT,
      hash: "HASH1",
      timeoutSeconds: 30,
      now: past,
    });
    expect(hasInFlightForIntent(INTENT)).toBe(false);
  });

  it("restores pending state after a simulated refresh", () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });

    // A refresh = a brand new module read of localStorage.
    const afterRefresh = getPendingTransactions();
    expect(afterRefresh).toHaveLength(1);
    expect(afterRefresh[0].status).toBe("submitted");
    expect(getInFlightForIntent(INTENT)?.hash).toBe("HASH1");
  });

  it("resolves a transaction that confirms after the polling window to success", async () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });

    const resolved = await resolvePendingTransactions({
      getTransaction: async () => ({ status: "SUCCESS" }),
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe("confirmed");
    expect(getPendingTransactions()[0].status).toBe("confirmed");
  });

  it("resolves an on-chain failure to failed", async () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });

    const resolved = await resolvePendingTransactions({
      getTransaction: async () => ({ status: "FAILED" }),
    });

    expect(resolved[0].status).toBe("failed");
  });

  it("keeps a NOT_FOUND transaction pending while still inside its time bound", async () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });

    const resolved = await resolvePendingTransactions({
      getTransaction: async () => ({ status: "NOT_FOUND" }),
    });

    expect(resolved).toHaveLength(0);
    expect(getPendingTransactions()[0].status).toBe("submitted");
  });

  it("marks a NOT_FOUND transaction expired once its time bound has passed", async () => {
    recordSubmittedTransaction({
      intent: INTENT,
      hash: "HASH1",
      timeoutSeconds: 30,
      now: Date.now() - 60_000,
    });

    const resolved = await resolvePendingTransactions({
      getTransaction: async () => ({ status: "NOT_FOUND" }),
    });

    expect(resolved[0].status).toBe("expired");
  });

  it("prunes resolved and expired entries", () => {
    recordSubmittedTransaction({ intent: INTENT, hash: "HASH1", timeoutSeconds: 30 });
    recordSubmittedTransaction({ intent: "other", hash: "HASH2", timeoutSeconds: 30 });
    updatePendingTransaction("HASH2", "confirmed");

    prunePendingTransactions();

    const remaining = getPendingTransactions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].hash).toBe("HASH1");
  });
});
