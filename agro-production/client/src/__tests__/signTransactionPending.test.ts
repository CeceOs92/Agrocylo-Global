import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTransaction = vi.fn();
const getTransaction = vi.fn();

vi.mock("@stellar/freighter-api", () => ({
  default: {
    getNetworkDetails: vi.fn(async () => ({
      networkPassphrase: "Test SDF Network ; September 2015",
    })),
    signTransaction: vi.fn(async (xdr: string) => xdr),
  },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: function () {
      return { sendTransaction, getTransaction };
    },
    Api: {
      GetTransactionStatus: {
        NOT_FOUND: "NOT_FOUND",
        SUCCESS: "SUCCESS",
        FAILED: "FAILED",
      },
    },
  },
  TransactionBuilder: { fromXDR: (x: string) => x },
}));

vi.mock("@/types/freighter", () => ({
  getFreighterSignerFromWindow: () => null,
}));

import { signAndSubmitTransaction } from "../lib/signTransaction";
import {
  clearPendingTransactions,
  getPendingTransactions,
  recordSubmittedTransaction,
} from "../lib/pendingTransactions";

describe("signAndSubmitTransaction — three outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingTransactions();
  });

  it("reports a still-unconfirmed transaction as pending, not failed", async () => {
    sendTransaction.mockResolvedValue({ status: "OK", hash: "HASH_PENDING" });
    getTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const res = await signAndSubmitTransaction("XDR", undefined, {
      intent: "invest:c1:GABC",
      confirmTimeoutMs: 10,
    });

    expect(res.outcome).toBe("pending");
    expect(res.success).toBe(false);
    expect(res.txHash).toBe("HASH_PENDING");
    expect(res.status).toBe("PENDING");
    expect(res.error).not.toBe("Transaction failed on-chain");
  });

  it("resolves to success when the transaction confirms after the poll window", async () => {
    sendTransaction.mockResolvedValue({ status: "OK", hash: "HASH_OK" });
    // First poll: not found. Second poll (after the loop delay): success.
    getTransaction
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValue({ status: "SUCCESS" });

    const res = await signAndSubmitTransaction("XDR", undefined, {
      intent: "invest:c1:GABC",
      confirmTimeoutMs: 5_000,
    });

    expect(res.outcome).toBe("confirmed");
    expect(res.success).toBe(true);
    expect(getPendingTransactions()[0].status).toBe("confirmed");
  });

  it("blocks a duplicate submission while an intent is in flight", async () => {
    recordSubmittedTransaction({
      intent: "invest:c1:GABC",
      hash: "HASH_INFLIGHT",
      timeoutSeconds: 30,
    });

    const res = await signAndSubmitTransaction("XDR", undefined, { intent: "invest:c1:GABC" });

    expect(res.duplicate).toBe(true);
    expect(res.outcome).toBe("pending");
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it("persists the submitted hash so resolution resumes after refresh", async () => {
    sendTransaction.mockResolvedValue({ status: "OK", hash: "HASH_PERSIST" });
    getTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    await signAndSubmitTransaction("XDR", undefined, {
      intent: "order:o9:GXYZ",
      confirmTimeoutMs: 10,
    });

    const persisted = getPendingTransactions();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      intent: "order:o9:GXYZ",
      hash: "HASH_PERSIST",
      status: "submitted",
    });
  });
});
