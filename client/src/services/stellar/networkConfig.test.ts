import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getNetworkConfig, isMainnet, isTestnet } from "./networkConfig";

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
