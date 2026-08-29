import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEscrowContract } from "./useEscrowContract";
import { WalletContext } from "@/context/WalletContext";
import type { WalletContextType } from "@/types/wallet";
import React from "react";

const mockSignAndSubmit = vi.fn();
const mockWallet: WalletContextType = {
  address: "GD5DJQJ7P5DLYX6LXZJ2J5LYXZJ2J5LYXZJ2J5LYXZJ2J5LYXZJ2",
  balance: "100",
  connected: true,
  loading: false,
  restoring: false,
  error: null,
  network: "TESTNET",
  activeWalletId: "freighter",
  connect: vi.fn(),
  disconnect: vi.fn(),
  refreshBalance: vi.fn(),
  signAndSubmit: mockSignAndSubmit,
};

vi.mock("@/services/stellar/contractService", () => ({
  confirmDelivery: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: "AAAA...",
      error: null,
    }),
  ),
  refundOrder: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: "BBBB...",
      error: null,
    }),
  ),
  openDispute: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: "CCCC...",
      error: null,
    }),
  ),
  getOrder: vi.fn(),
}));

vi.mock("@/lib/testMode", () => ({
  isTestMode: vi.fn(() => false),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    WalletContext.Provider,
    { value: mockWallet },
    children,
  );
}

describe("useEscrowContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignAndSubmit.mockResolvedValue({
      success: true,
      txHash: "TX_HASH_123",
    });
  });

  it("exposes the unified tx API with confirm/refund/dispute methods", () => {
    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    expect(result.current.tx.confirm).toBeInstanceOf(Function);
    expect(result.current.tx.refund).toBeInstanceOf(Function);
    expect(result.current.tx.dispute).toBeInstanceOf(Function);
    expect(result.current.tx.isLoading).toBe(false);
    expect(result.current.tx.error).toBeNull();
    expect(result.current.tx.blockchainError).toBeNull();
    expect(result.current.tx.activeAction).toBeNull();
  });

  it("sets isLoading during confirm and clears it afterward", async () => {
    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.tx.confirm("order-1");
    });

    expect(result.current.tx.isLoading).toBe(true);
    expect(result.current.tx.activeAction).toBe("confirm");

    await act(async () => {
      await promise;
    });

    expect(result.current.tx.isLoading).toBe(false);
    expect(result.current.tx.activeAction).toBeNull();
  });

  it("classifies insufficient_balance error with structured info", async () => {
    mockSignAndSubmit.mockRejectedValue(new Error("insufficient funds"));

    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    await act(async () => {
      try {
        await result.current.tx.confirm("order-1");
      } catch {
        // expected
      }
    });

    expect(result.current.tx.error).toBe("insufficient funds");
    expect(result.current.tx.blockchainError).not.toBeNull();
    expect(result.current.tx.blockchainError!.kind).toBe("insufficient_balance");
    expect(result.current.tx.blockchainError!.title).toBe("Insufficient Balance");
    expect(result.current.tx.blockchainError!.action).toContain("Check wallet balance");
  });

  it("classifies user_rejected error with structured info", async () => {
    mockSignAndSubmit.mockRejectedValue(new Error("User rejected the transaction"));

    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    await act(async () => {
      try {
        await result.current.tx.confirm("order-1");
      } catch {
        // expected
      }
    });

    expect(result.current.tx.blockchainError!.kind).toBe("user_rejected");
    expect(result.current.tx.blockchainError!.title).toBe("Transaction Rejected");
  });

  it("classifies network timeout with structured info", async () => {
    mockSignAndSubmit.mockRejectedValue(new Error("network timeout"));

    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    await act(async () => {
      try {
        await result.current.tx.refund("order-1");
      } catch {
        // expected
      }
    });

    expect(result.current.tx.blockchainError!.kind).toBe("network_unavailable");
    expect(result.current.tx.blockchainError!.title).toBe("Network Unavailable");
  });

  it("sets isLoading during refund and clears it afterward", async () => {
    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.tx.refund("order-1");
    });

    expect(result.current.tx.isLoading).toBe(true);
    expect(result.current.tx.activeAction).toBe("refund");

    await act(async () => {
      await promise;
    });

    expect(result.current.tx.isLoading).toBe(false);
    expect(result.current.tx.activeAction).toBeNull();
  });

  it("sets isLoading during dispute and clears it afterward", async () => {
    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.tx.dispute("order-1", "reason", "evidence");
    });

    expect(result.current.tx.isLoading).toBe(true);
    expect(result.current.tx.activeAction).toBe("dispute");

    await act(async () => {
      await promise;
    });

    expect(result.current.tx.isLoading).toBe(false);
    expect(result.current.tx.activeAction).toBeNull();
  });

  it("clears error via clearError", async () => {
    mockSignAndSubmit.mockRejectedValue(new Error("Some error"));

    const { result } = renderHook(() => useEscrowContract(), { wrapper });

    await act(async () => {
      try {
        await result.current.tx.confirm("order-1");
      } catch {
        // expected
      }
    });

    expect(result.current.tx.error).toBe("Some error");

    act(() => {
      result.current.tx.clearError();
    });

    expect(result.current.tx.error).toBeNull();
    expect(result.current.tx.blockchainError).toBeNull();
  });
});
