import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/contractService", () => ({
  buildInvest: vi.fn(),
}));

vi.mock("@/lib/signTransaction", () => ({
  signAndSubmitTransaction: vi.fn(),
}));

vi.mock("@/services/investmentService", () => {
  class InvestmentIndexingTimeoutError extends Error {
    constructor(public readonly txHash: string) {
      super("The transaction is confirmed but is still waiting to be indexed.");
      this.name = "InvestmentIndexingTimeoutError";
    }
  }

  return {
    InvestmentIndexingTimeoutError,
    waitForIndexedInvestment: vi.fn(),
  };
});

import { useInvest } from "@/hooks/useInvest";
import { buildInvest } from "@/lib/contractService";
import { signAndSubmitTransaction } from "@/lib/signTransaction";
import {
  InvestmentIndexingTimeoutError,
  waitForIndexedInvestment,
} from "@/services/investmentService";

const request = {
  campaignId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  onChainCampaignId: "7",
  investorAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  amount: 1_250_000n,
};

const indexedInvestment = {
  id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  campaignId: request.campaignId,
  investorAddress: request.investorAddress,
  amount: request.amount.toString(),
  ledger: 123,
  txHash: "a".repeat(64),
  createdAt: "2026-01-01T00:00:00.000Z",
};

const mockBuildInvest = vi.mocked(buildInvest);
const mockSignAndSubmit = vi.mocked(signAndSubmitTransaction);
const mockWaitForIndexedInvestment = vi.mocked(waitForIndexedInvestment);

function mockConfirmedTransaction() {
  mockBuildInvest.mockResolvedValue({ success: true, data: "prepared-xdr" });
  mockSignAndSubmit.mockImplementation(async (_xdr, onStage) => {
    onStage?.("signing");
    onStage?.("submitting");
    onStage?.("confirming");
    return { success: true, txHash: indexedInvestment.txHash, status: "SUCCESS" };
  });
}

describe("useInvest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces a failed simulation without opening the wallet", async () => {
    mockBuildInvest.mockResolvedValue({ success: false, error: "Simulation failed: campaign closed" });
    const { result } = renderHook(() => useInvest());

    await act(async () => {
      await result.current.invest(request);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toContain("Simulation failed");
    expect(mockSignAndSubmit).not.toHaveBeenCalled();
  });

  it("surfaces wallet rejection without treating an API response as success", async () => {
    mockBuildInvest.mockResolvedValue({ success: true, data: "prepared-xdr" });
    mockSignAndSubmit.mockResolvedValue({ success: false, error: "Transaction rejected by wallet" });
    const { result } = renderHook(() => useInvest());

    await act(async () => {
      await result.current.invest(request);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toContain("rejected by wallet");
    expect(mockWaitForIndexedInvestment).not.toHaveBeenCalled();
  });

  it("keeps a confirmed transaction in recovery mode when indexing times out", async () => {
    mockConfirmedTransaction();
    mockWaitForIndexedInvestment.mockRejectedValue(
      new InvestmentIndexingTimeoutError(indexedInvestment.txHash),
    );
    const { result } = renderHook(() => useInvest());

    await act(async () => {
      await result.current.invest(request);
    });

    expect(result.current.phase).toBe("awaiting_index");
    expect(result.current.txHash).toBe(indexedInvestment.txHash);

    await act(async () => {
      await result.current.invest(request);
    });
    expect(mockBuildInvest).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate submission while a first transaction is building", async () => {
    type BuildResult = Awaited<ReturnType<typeof buildInvest>>;
    let resolveBuild!: (value: BuildResult) => void;
    mockBuildInvest.mockReturnValueOnce(
      new Promise<BuildResult>((resolve) => {
        resolveBuild = resolve;
      }),
    );
    mockSignAndSubmit.mockResolvedValue({ success: false, error: "Transaction rejected by wallet" });
    const { result } = renderHook(() => useInvest());

    let first: Promise<unknown>;
    let duplicate: Promise<unknown>;
    act(() => {
      first = result.current.invest(request);
      duplicate = result.current.invest(request);
    });
    expect(mockBuildInvest).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveBuild({ success: true, data: "prepared-xdr" });
      await Promise.all([first!, duplicate!]);
    });
  });

  it("reports success only after the matching confirmed investment is indexed", async () => {
    mockConfirmedTransaction();
    mockWaitForIndexedInvestment.mockResolvedValue(indexedInvestment);
    const { result } = renderHook(() => useInvest());

    await act(async () => {
      await result.current.invest(request);
    });

    expect(mockWaitForIndexedInvestment).toHaveBeenCalledWith({
      campaignId: request.campaignId,
      investorAddress: request.investorAddress,
      amount: request.amount.toString(),
      txHash: indexedInvestment.txHash,
    });
    expect(result.current.phase).toBe("indexed");
    expect(result.current.investment).toEqual(indexedInvestment);
  });
});
