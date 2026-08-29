import { describe, it, expect, vi, beforeEach } from "vitest";
import { WALLET_ADAPTERS, getWalletAdapter, DEFAULT_WALLET_ID } from "../lib/wallets/registry";

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * Every adapter must honor the same contract regardless of which wallet
 * extension backs it, so the UI and signTransaction.ts can treat them
 * interchangeably.
 */
describe("wallet adapter conformance", () => {
  beforeEach(() => {
    delete (window as { freighter?: unknown }).freighter;
    delete (window as { freighterApi?: unknown }).freighterApi;
    delete (window as { rabet?: unknown }).rabet;
    delete (window as { hanaWallet?: unknown }).hanaWallet;
  });

  it("exposes at least three distinct adapters", () => {
    expect(WALLET_ADAPTERS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(WALLET_ADAPTERS.map((a) => a.id));
    expect(ids.size).toBe(WALLET_ADAPTERS.length);
  });

  it("falls back to the default adapter for an unknown id", () => {
    expect(getWalletAdapter("not-a-real-wallet").id).toBe(DEFAULT_WALLET_ID);
    expect(getWalletAdapter(undefined).id).toBe(DEFAULT_WALLET_ID);
  });

  for (const adapter of WALLET_ADAPTERS) {
    describe(`${adapter.name} (${adapter.id})`, () => {
      it("reports unavailable when no bridge is injected", () => {
        expect(adapter.isAvailable()).toBe(false);
      });

      it("getPublicKey resolves null when unavailable", async () => {
        if (adapter.id === "freighter") return; // falls through to @stellar/freighter-api, mocked elsewhere
        await expect(adapter.getPublicKey()).resolves.toBeNull();
      });

      it("signTransaction rejects when unavailable", async () => {
        if (adapter.id === "freighter") return; // falls through to @stellar/freighter-api, mocked elsewhere
        await expect(
          adapter.signTransaction("XDR", { networkPassphrase: NETWORK_PASSPHRASE }),
        ).rejects.toThrow();
      });
    });
  }

  it("Rabet adapter round-trips getPublicKey and signTransaction through the injected bridge", async () => {
    const connect = vi.fn(async () => ({ publicKey: "GRABET" }));
    const sign = vi.fn(async () => ({ xdr: "SIGNED_XDR" }));
    (window as unknown as { rabet: unknown }).rabet = { connect, sign };

    const adapter = getWalletAdapter("rabet");
    expect(adapter.isAvailable()).toBe(true);
    await expect(adapter.getPublicKey()).resolves.toBe("GRABET");
    await expect(
      adapter.signTransaction("XDR", { networkPassphrase: NETWORK_PASSPHRASE }),
    ).resolves.toBe("SIGNED_XDR");
    expect(sign).toHaveBeenCalledWith("XDR", "testnet");
  });

  it("Rabet adapter surfaces wallet errors", async () => {
    (window as unknown as { rabet: unknown }).rabet = {
      connect: vi.fn(async () => ({ error: "User rejected" })),
      sign: vi.fn(),
    };
    const adapter = getWalletAdapter("rabet");
    await expect(adapter.getPublicKey()).rejects.toThrow("User rejected");
  });

  it("Hana adapter round-trips getPublicKey, getNetwork, and signTransaction", async () => {
    (window as unknown as { hanaWallet: unknown }).hanaWallet = {
      stellar: {
        getPublicKey: vi.fn(async () => "GHANA"),
        getNetworkDetails: vi.fn(async () => ({ networkPassphrase: NETWORK_PASSPHRASE })),
        signTransaction: vi.fn(async () => "SIGNED_XDR"),
      },
    };
    const adapter = getWalletAdapter("hana");
    expect(adapter.isAvailable()).toBe(true);
    await expect(adapter.getPublicKey()).resolves.toBe("GHANA");
    await expect(adapter.getNetwork()).resolves.toEqual({
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    await expect(
      adapter.signTransaction("XDR", { networkPassphrase: NETWORK_PASSPHRASE }),
    ).resolves.toBe("SIGNED_XDR");
  });
});
