import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getNetworkConfig,
  isMainnet,
  isTestnet,
  getStellarEnv,
  isMainnetEnv,
  getExpectedNetworkPassphrase,
  normalizeToPassphrase,
  isNetworkMismatch,
  MAINNET_PASSPHRASE,
  TESTNET_PASSPHRASE,
} from "./networkConfig";

describe("networkConfig — fail-fast on missing env vars", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when NEXT_PUBLIC_SOROBAN_RPC_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

    expect(() => getNetworkConfig()).toThrow(
      /NEXT_PUBLIC_SOROBAN_RPC_URL is not configured/
    );
  });

  it("throws when NEXT_PUBLIC_NETWORK_PASSPHRASE is missing", () => {
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    expect(() => getNetworkConfig()).toThrow(
      /NEXT_PUBLIC_NETWORK_PASSPHRASE is not configured/
    );
  });

  it("throws when both RPC URL and network passphrase are missing", () => {
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    expect(() => getNetworkConfig()).toThrow(
      /NEXT_PUBLIC_SOROBAN_RPC_URL is not configured/
    );
  });

  it("succeeds with valid testnet config", () => {
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    process.env.NEXT_PUBLIC_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

    const config = getNetworkConfig();

    expect(config).toEqual({
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    });
  });

  it("succeeds with valid mainnet config", () => {
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban-rpc.mainnet.stellar.org";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
    process.env.NEXT_PUBLIC_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

    const config = getNetworkConfig();

    expect(config).toEqual({
      rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    });
  });

  it("allows CONTRACT_ID to be missing (optional)", () => {
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    delete process.env.NEXT_PUBLIC_CONTRACT_ID;

    const config = getNetworkConfig();

    expect(config.contractId).toBe("");
  });
});

describe("networkConfig — mainnet/testnet detection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("correctly identifies mainnet from passphrase", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";

    expect(isMainnet()).toBe(true);
    expect(isTestnet()).toBe(false);
  });

  it("correctly identifies testnet from passphrase", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

    expect(isMainnet()).toBe(false);
    expect(isTestnet()).toBe(true);
  });

  it("returns false for both when passphrase is unknown", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Unknown Network";

    expect(isMainnet()).toBe(false);
    expect(isTestnet()).toBe(false);
  });

  it("returns false for both when passphrase is missing", () => {
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    expect(isMainnet()).toBe(false);
    expect(isTestnet()).toBe(false);
  });
});

describe("networkConfig — NEXT_PUBLIC_STELLAR_ENV switch", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reads an explicit mainnet env", () => {
    process.env.NEXT_PUBLIC_STELLAR_ENV = "mainnet";
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(getStellarEnv()).toBe("mainnet");
    expect(isMainnetEnv()).toBe(true);
  });

  it("defaults to testnet when the env var is unset and passphrase is not mainnet", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_ENV;
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(getStellarEnv()).toBe("testnet");
  });

  it("infers mainnet from a mainnet passphrase when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_ENV;
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = MAINNET_PASSPHRASE;
    expect(getStellarEnv()).toBe("mainnet");
  });

  it("getExpectedNetworkPassphrase throws in mainnet mode when passphrase is unset", () => {
    process.env.NEXT_PUBLIC_STELLAR_ENV = "mainnet";
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(() => getExpectedNetworkPassphrase()).toThrow(/mainnet/i);
  });

  it("getExpectedNetworkPassphrase falls back to testnet in testnet mode", () => {
    process.env.NEXT_PUBLIC_STELLAR_ENV = "testnet";
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(getExpectedNetworkPassphrase()).toBe(TESTNET_PASSPHRASE);
  });
});

describe("networkConfig — wallet network mismatch detection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_STELLAR_ENV = "mainnet";
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = MAINNET_PASSPHRASE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ["Freighter passphrase", "Test SDF Network ; September 2015"],
    ["Freighter short name", "TESTNET"],
    ["Rabet lowercase", "testnet"],
    ["Albedo lowercase", "test"],
  ])("flags a mismatch for %s while the app is on mainnet", (_label, walletNet) => {
    expect(isNetworkMismatch(walletNet)).toBe(true);
  });

  it.each([
    ["Freighter passphrase", MAINNET_PASSPHRASE],
    ["Freighter short name", "PUBLIC"],
    ["Rabet lowercase", "mainnet"],
    ["pubnet alias", "pubnet"],
  ])("does not flag a match for %s while the app is on mainnet", (_label, walletNet) => {
    expect(isNetworkMismatch(walletNet)).toBe(false);
  });

  it("treats a null/unknown wallet network as 'cannot determine', not a mismatch", () => {
    expect(isNetworkMismatch(null)).toBe(false);
    expect(isNetworkMismatch(undefined)).toBe(false);
    expect(isNetworkMismatch("")).toBe(false);
  });

  it("treats a misconfigured app (mainnet mode, no passphrase) as a mismatch", () => {
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(isNetworkMismatch("PUBLIC")).toBe(true);
  });

  it("normalizeToPassphrase maps known shapes and passes unknown ones through", () => {
    expect(normalizeToPassphrase("TESTNET")).toBe(TESTNET_PASSPHRASE);
    expect(normalizeToPassphrase("mainnet")).toBe(MAINNET_PASSPHRASE);
    expect(normalizeToPassphrase("Standalone Network ; February 2017")).toBe(
      "Standalone Network ; February 2017",
    );
    expect(normalizeToPassphrase(null)).toBeNull();
  });
});
