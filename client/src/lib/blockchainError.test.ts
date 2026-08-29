import { describe, it, expect } from "vitest";
import { mapBlockchainError } from "./blockchainError";

describe("mapBlockchainError", () => {
  it("maps insufficient balance errors", () => {
    const result = mapBlockchainError(new Error("insufficient funds"));
    expect(result.kind).toBe("insufficient_balance");
    expect(result.title).toBe("Insufficient Balance");
    expect(result.action).toContain("Check wallet balance");
  });

  it("maps user rejection errors", () => {
    const result = mapBlockchainError(new Error("User rejected the transaction"));
    expect(result.kind).toBe("user_rejected");
    expect(result.title).toBe("Transaction Rejected");
    expect(result.action).toContain("Approve");
  });

  it("maps network/timeout errors", () => {
    const result = mapBlockchainError(new Error("network timeout"));
    expect(result.kind).toBe("network_unavailable");
    expect(result.title).toBe("Network Unavailable");
    expect(result.action).toContain("Retry");
  });

  it("maps unknown errors", () => {
    const result = mapBlockchainError(new Error("something weird"));
    expect(result.kind).toBe("unknown");
    expect(result.title).toBe("Unknown Error");
  });

  it("handles empty error gracefully", () => {
    const result = mapBlockchainError(null);
    expect(result.kind).toBe("unknown");
  });

  it("handles string errors", () => {
    const result = mapBlockchainError("insufficient balance");
    expect(result.kind).toBe("insufficient_balance");
  });
});
