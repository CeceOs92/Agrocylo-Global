import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSimulateTransaction } = vi.hoisted(() => ({
  mockSimulateTransaction: vi.fn(),
}));

const mockServerInstance = {
  simulateTransaction: mockSimulateTransaction,
  getLatestLedger: vi.fn().mockResolvedValue({ sequence: 100 }),
};

vi.mock("@stellar/stellar-sdk", () => {
  class MockServer {
    constructor() {
      return mockServerInstance;
    }
  }
  class MockContract {
    constructor(_id: string) {}
    call(..._args: unknown[]) {
      return {};
    }
  }
  class MockTransactionBuilder {
    constructor(_account: unknown, _opts: unknown) {}
    addOperation(_op: unknown) { return this; }
    setTimeout(_t: unknown) { return this; }
    build() { return {}; }
  }
  return {
    rpc: { Server: MockServer, Account: vi.fn() },
    Contract: MockContract,
    nativeToScVal: vi.fn((val: unknown) => ({ type: "u64", value: val })),
    scValToNative: vi.fn(),
    TransactionBuilder: MockTransactionBuilder,
    xdr: {},
  };
});

vi.mock("../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config/index.js", () => ({
  config: {
    contractId: "test-contract-id",
    rpcUrl: "https://soroban-testnet.stellar.org",
    nodeEnv: "development",
  },
}));

vi.mock("../config/database.js", () => ({
  prisma: {
    order: { findMany: vi.fn(), findUnique: vi.fn() },
    campaign: { findMany: vi.fn() },
    dispute: { findMany: vi.fn() },
    reconciliationAlert: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
  },
}));

import { runReconciliation, reconcileSingleOrder } from "./reconciliationService.js";
import { prisma } from "../config/database.js";
import { scValToNative } from "@stellar/stellar-sdk";

describe("reconciliationService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("runReconciliation", () => {
    it("returns empty report when no contract ID configured", async () => {
      const { config } = await import("../config/index.js");
      const originalContractId = config.contractId;
      (config as any).contractId = "";

      const report = await runReconciliation();

      expect(report.driftsFound).toBe(0);
      expect(report.errors).toContain("No CONTRACT_ID configured — skipping reconciliation");

      (config as any).contractId = originalContractId;
    });

    it("checks open orders against chain", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          id: "1",
          orderIdOnChain: "100",
          buyerAddress: "BUYER",
          sellerAddress: "SELLER",
          amount: "1000",
          token: "USDC",
          status: "Pending",
          productId: null,
          txHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any[]);
      vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);

      mockSimulateTransaction.mockResolvedValue({
        result: { retval: {} },
      });
      vi.mocked(scValToNative).mockReturnValue({
        buyer: "BUYER",
        farmer: "SELLER",
        amount: "1000",
        status: 0,
      });

      const report = await runReconciliation();

      expect(report.ordersChecked).toBe(1);
      expect(report.driftsFound).toBe(0);
    });

    it("detects status drift between DB and chain", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          id: "1",
          orderIdOnChain: "100",
          buyerAddress: "BUYER",
          sellerAddress: "SELLER",
          amount: "1000",
          token: "USDC",
          status: "Pending",
          productId: null,
          txHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any[]);
      vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);

      mockSimulateTransaction.mockResolvedValue({
        result: { retval: {} },
      });
      vi.mocked(scValToNative).mockReturnValue({
        buyer: "BUYER",
        farmer: "SELLER",
        amount: "1000",
        status: 2, // Completed
      });

      const report = await runReconciliation();

      expect(report.ordersChecked).toBe(1);
      expect(report.driftsFound).toBe(1);
      expect(report.alerts[0].driftType).toBe("status_mismatch");
      expect(report.alerts[0].dbValue).toEqual({ status: "Pending" });
      expect(report.alerts[0].chainValue).toEqual({ status: "Completed" });
    });

    it("detects amount drift between DB and chain", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          id: "1",
          orderIdOnChain: "100",
          buyerAddress: "BUYER",
          sellerAddress: "SELLER",
          amount: "1000",
          token: "USDC",
          status: "Pending",
          productId: null,
          txHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any[]);
      vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);

      mockSimulateTransaction.mockResolvedValue({
        result: { retval: {} },
      });
      vi.mocked(scValToNative).mockReturnValue({
        buyer: "BUYER",
        farmer: "SELLER",
        amount: "2000",
        status: 0,
      });

      const report = await runReconciliation();

      expect(report.driftsFound).toBe(1);
      expect(report.alerts[0].driftType).toBe("amount_mismatch");
    });

    it("persists alerts to database when drift found", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        {
          id: "1",
          orderIdOnChain: "100",
          buyerAddress: "BUYER",
          sellerAddress: "SELLER",
          amount: "1000",
          token: "USDC",
          status: "Pending",
          productId: null,
          txHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any[]);
      vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dispute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.reconciliationAlert.create).mockResolvedValue({} as any);

      mockSimulateTransaction.mockResolvedValue({
        result: { retval: {} },
      });
      vi.mocked(scValToNative).mockReturnValue({
        buyer: "BUYER",
        farmer: "SELLER",
        amount: "2000",
        status: 0,
      });

      await runReconciliation();

      expect(prisma.reconciliationAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: "order",
          entityId: "100",
          driftType: "amount_mismatch",
        }),
      });
    });
  });

  describe("reconcileSingleOrder", () => {
    it("throws when order not found in DB", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      await expect(reconcileSingleOrder("999")).rejects.toThrow("not found");
    });

    it("returns no findings when chain matches DB", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "1",
        orderIdOnChain: "100",
        buyerAddress: "BUYER",
        sellerAddress: "SELLER",
        amount: "1000",
        token: "USDC",
        status: "Pending",
        productId: null,
        txHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockSimulateTransaction.mockResolvedValue({
        result: { retval: {} },
      });
      vi.mocked(scValToNative).mockReturnValue({
        buyer: "BUYER",
        farmer: "SELLER",
        amount: "1000",
        status: 0,
      });

      const findings = await reconcileSingleOrder("100");

      expect(findings).toHaveLength(0);
    });
  });
});
