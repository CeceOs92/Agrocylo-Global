import { describe, it, expect, vi, beforeEach } from "vitest";
import * as signTransactionModule from "./signTransaction";

vi.mock("@stellar/freighter-api", () => ({
  default: {
    getNetworkDetails: vi.fn(),
    signTransaction: vi.fn(),
  },
}));

vi.mock("./stellar", () => ({
  getRpcServer: vi.fn(),
}));

vi.mock("./testMode", () => ({
  isTestMode: vi.fn(() => false),
}));

import FreighterApi from "@stellar/freighter-api";

describe("signTransaction — network passphrase resolution", () => {
  const mockFreighterApi = FreighterApi as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when Freighter is unavailable and no override passphrase provided", async () => {
    mockFreighterApi.getNetworkDetails.mockRejectedValue(
      new Error("Freighter not installed")
    );

    // Access the private function via module evaluation
    // We need to test that signTransaction will fail without a passphrase override
    await expect(
      signTransactionModule.signTransaction(
        "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w==",
        {}
      )
    ).rejects.toThrow(
      /Unable to detect network from Freighter wallet/
    );
  });

  it("succeeds when Freighter provides network details", async () => {
    mockFreighterApi.getNetworkDetails.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
      network: "TESTNET",
    });

    mockFreighterApi.signTransaction.mockResolvedValue(
      "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w=="
    );

    const result = await signTransactionModule.signTransaction(
      "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w=="
    );

    expect(result).toBeDefined();
  });

  it("uses override passphrase when provided", async () => {
    // Even if Freighter fails, the override should be used
    mockFreighterApi.getNetworkDetails.mockRejectedValue(
      new Error("Freighter error")
    );
    mockFreighterApi.signTransaction.mockResolvedValue(
      "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w=="
    );

    const result = await signTransactionModule.signTransaction(
      "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w==",
      { networkPassphrase: "Public Global Stellar Network ; September 2015" }
    );

    expect(result).toBeDefined();
  });
});

describe("signTransaction — no silent testnet fallback", () => {
  const mockFreighterApi = FreighterApi as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fall back to testnet passphrase when Freighter fails", async () => {
    mockFreighterApi.getNetworkDetails.mockRejectedValue(
      new Error("Wallet locked")
    );

    await expect(
      signTransactionModule.signTransaction(
        "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w=="
      )
    ).rejects.toThrow(
      /Unable to detect network from Freighter wallet/
    );
  });
});
