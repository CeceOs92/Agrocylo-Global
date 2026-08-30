import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as txModule from "./stellarTransactions";
import {
  NetworkMismatchError,
  TimeoutError,
  TransactionFailedError,
  NetworkError,
} from "./stellarTransactions";

vi.mock("@stellar/freighter-api", () => ({
  default: {
    getNetworkDetails: vi.fn(),
    signTransaction: vi.fn(),
  },
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      fromXDR: vi.fn(() => ({ _mockTx: true })),
    },
  };
});

const getRpcServer = vi.fn();
vi.mock("./stellar", () => ({ getRpcServer: () => getRpcServer() }));
vi.mock("./testMode", () => ({ isTestMode: vi.fn(() => false) }));

import FreighterApi from "@stellar/freighter-api";

const VALID_XDR = "AAAAAgAAAAABAABkdwAAAAIAAAABAAAAFgAAAAAABcekAAAB4w==";
const MAINNET = "Public Global Stellar Network ; September 2015";
const TESTNET = "Test SDF Network ; September 2015";

const freighter = FreighterApi as unknown as {
  getNetworkDetails: ReturnType<typeof vi.fn>;
  signTransaction: ReturnType<typeof vi.fn>;
};

// A minimal rpc.Server stub whose getTransaction sequence is scripted per test.
function mockServer(opts: {
  send?: unknown | (() => unknown);
  getTransaction: Array<{ status: string; resultMetaXdr?: { toXDR: () => string } }>;
}) {
  let i = 0;
  return {
    sendTransaction: vi.fn(async () => {
      const s = typeof opts.send === "function" ? (opts.send as () => unknown)() : opts.send;
      if (s instanceof Error) throw s;
      return s ?? { status: "PENDING", hash: "abc123" };
    }),
    getTransaction: vi.fn(async () => {
      const next = opts.getTransaction[Math.min(i, opts.getTransaction.length - 1)];
      i += 1;
      return next;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "testnet");
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
  freighter.getNetworkDetails.mockResolvedValue({ networkPassphrase: TESTNET });
  freighter.signTransaction.mockResolvedValue(VALID_XDR);
});

afterEach(() => vi.unstubAllEnvs());

describe("stellarTransactions — success path", () => {
  it("signAndSubmitTransaction resolves with SUCCESS and a hash", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({
        send: { status: "PENDING", hash: "hash-ok" },
        getTransaction: [
          { status: "NOT_FOUND" },
          { status: "SUCCESS", resultMetaXdr: { toXDR: () => "meta64" } },
        ],
      }),
    );

    const result = await txModule.signAndSubmitTransaction(VALID_XDR, {
      intervalMs: 1,
    });

    expect(result).toMatchObject({
      success: true,
      status: "SUCCESS",
      txHash: "hash-ok",
      resultXdr: "meta64",
    });
  });
});

describe("stellarTransactions — failure path", () => {
  it("surfaces a TransactionFailedError as errorKind 'failed'", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({
        send: { status: "PENDING", hash: "hash-fail" },
        getTransaction: [{ status: "FAILED", resultMetaXdr: { toXDR: () => "m" } }],
      }),
    );

    const result = await txModule.signAndSubmitTransaction(VALID_XDR, { intervalMs: 1 });

    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("failed");
    expect(result.txHash).toBe("hash-fail");
  });

  it("submitTransactionOrThrow throws TransactionFailedError on a terminal on-chain failure", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({
        send: { status: "PENDING", hash: "h" },
        getTransaction: [{ status: "FAILED" }],
      }),
    );
    await expect(
      txModule.submitTransactionOrThrow(VALID_XDR, { intervalMs: 1 }),
    ).rejects.toBeInstanceOf(TransactionFailedError);
  });
});

describe("stellarTransactions — timeout path", () => {
  it("surfaces a TimeoutError as errorKind 'timeout' when the tx never confirms", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({
        send: { status: "PENDING", hash: "hash-timeout" },
        getTransaction: [{ status: "NOT_FOUND" }],
      }),
    );

    const result = await txModule.signAndSubmitTransaction(VALID_XDR, {
      timeoutMs: 5,
      intervalMs: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("timeout");
    expect(result.status).toBe("TIMEOUT");
  });

  it("submitTransactionOrThrow throws TimeoutError", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({
        send: { status: "PENDING", hash: "h" },
        getTransaction: [{ status: "NOT_FOUND" }],
      }),
    );
    await expect(
      txModule.submitTransactionOrThrow(VALID_XDR, { timeoutMs: 5, intervalMs: 1 }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("stellarTransactions — network / retry path", () => {
  it("retries transient send errors then gives up with a NetworkError", async () => {
    const server = mockServer({
      send: () => new Error("Failed to fetch"),
      getTransaction: [{ status: "NOT_FOUND" }],
    });
    getRpcServer.mockResolvedValue(server);

    const result = await txModule.signAndSubmitTransaction(VALID_XDR, {
      maxRetries: 2,
      baseDelayMs: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errorKind).toBe("network");
    expect(server.sendTransaction).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("submitTransactionOrThrow throws NetworkError after exhausting retries", async () => {
    getRpcServer.mockResolvedValue(
      mockServer({ send: () => new Error("503"), getTransaction: [{ status: "NOT_FOUND" }] }),
    );
    await expect(
      txModule.submitTransactionOrThrow(VALID_XDR, { maxRetries: 1, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("stellarTransactions — network mismatch (issue #807)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_ENV", "mainnet");
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", MAINNET);
  });

  it("signTransaction throws NetworkMismatchError when the wallet is on another network", async () => {
    freighter.getNetworkDetails.mockResolvedValue({ networkPassphrase: TESTNET });
    await expect(txModule.signTransaction(VALID_XDR)).rejects.toBeInstanceOf(
      NetworkMismatchError,
    );
    expect(freighter.signTransaction).not.toHaveBeenCalled();
  });

  it("signAndSubmitTransaction returns errorKind 'mismatch'", async () => {
    freighter.getNetworkDetails.mockResolvedValue({ network: "TESTNET" });
    const result = await txModule.signAndSubmitTransaction(VALID_XDR);
    expect(result).toMatchObject({ success: false, errorKind: "mismatch" });
  });
});
