import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@stellar/freighter-api", () => ({
  default: { getNetworkDetails: vi.fn() },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Horizon: { Server: vi.fn(function (url: string) { return { url }; }) },
  rpc: {
    Server: vi.fn(function (url: string) { return { url }; }),
    Api: { GetTransactionStatus: { NOT_FOUND: "NOT_FOUND", SUCCESS: "SUCCESS", FAILED: "FAILED" } },
  },
}));

import FreighterApi from "@stellar/freighter-api";

const freighter = FreighterApi as unknown as {
  getNetworkDetails: ReturnType<typeof vi.fn>;
};

describe("stellar.ts — no silent testnet fallback in mainnet mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("getRpcServer throws when mainnet mode is active, Freighter errors, and no RPC URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "mainnet");
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "");
    freighter.getNetworkDetails.mockRejectedValue(new Error("Freighter not installed"));

    const { getRpcServer } = await import("./stellar");
    await expect(getRpcServer()).rejects.toThrow(/refusing to fall back to testnet/i);
  });

  it("getServer throws for the same reason (Horizon path)", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "mainnet");
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "");
    freighter.getNetworkDetails.mockRejectedValue(new Error("locked"));

    const { getServer } = await import("./stellar");
    await expect(getServer()).rejects.toThrow(/refusing to fall back to testnet/i);
  });

  it("falls back to the configured mainnet RPC URL (not testnet) when one is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "mainnet");
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "https://soroban-rpc.mainnet.stellar.org");
    freighter.getNetworkDetails.mockRejectedValue(new Error("locked"));

    const { getRpcServer } = await import("./stellar");
    const server = (await getRpcServer()) as unknown as { url: string };
    expect(server.url).toBe("https://soroban-rpc.mainnet.stellar.org");
  });

  it("still falls back to testnet in testnet/unset mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "testnet");
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "");
    freighter.getNetworkDetails.mockRejectedValue(new Error("locked"));

    const { getRpcServer } = await import("./stellar");
    const server = (await getRpcServer()) as unknown as { url: string };
    expect(server.url).toBe("https://soroban-testnet.stellar.org");
  });
});
