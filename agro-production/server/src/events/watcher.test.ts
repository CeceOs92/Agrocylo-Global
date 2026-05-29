import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports that pull these modules.
// ---------------------------------------------------------------------------
vi.mock("../db/client.js", () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config/index.js", () => ({
  config: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    contractId: "CTEST000000000000000000000000000000000000000000000000AA",
  },
}));

vi.mock("./parser.js", () => ({
  ProductionEventParser: { tryParse: vi.fn().mockReturnValue(null) },
}));

vi.mock("./persister.js", () => ({
  EventPersister: { persist: vi.fn().mockResolvedValue(undefined) },
}));

// rpc.Server mock
const mockGetEvents = vi.fn().mockResolvedValue({ events: [] });
const mockGetLatestLedger = vi.fn().mockResolvedValue({ sequence: 500 });

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: vi.fn().mockImplementation(() => ({
      getEvents: mockGetEvents,
      getLatestLedger: mockGetLatestLedger,
    })),
  },
}));

// ---------------------------------------------------------------------------
// After all mocks are declared we can import the module under test.
// ---------------------------------------------------------------------------
import { startProductionWatcher } from "./watcher.js";
import { prisma } from "../db/client.js";
import { ProductionEventParser } from "./parser.js";
import { EventPersister } from "./persister.js";
import logger from "../config/logger.js";

describe("startProductionWatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkpoint loading", () => {
    it("resumes from the last persisted ledger when a transaction record exists", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
        ledger: 300,
      } as never);

      await startProductionWatcher();

      expect(logger.info).toHaveBeenCalledWith(
        "Production watcher: resuming from persisted checkpoint",
        expect.objectContaining({ ledger: 300 }),
      );
    });

    it("falls back to the current ledger tip when no checkpoint exists", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
      mockGetLatestLedger.mockResolvedValueOnce({ sequence: 500 });

      await startProductionWatcher();

      expect(logger.info).toHaveBeenCalledWith(
        "Production watcher: no checkpoint found, starting from current ledger",
        expect.objectContaining({ ledger: 500 }),
      );
    });
  });

  describe("gap reconciliation", () => {
    it("fast-forwards checkpoint when gap exceeds MAX_LEDGER_GAP", async () => {
      // Checkpoint is at ledger 100; current tip is at 1200 → gap of 1100 > 1000.
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
        ledger: 100,
      } as never);
      mockGetLatestLedger.mockResolvedValue({ sequence: 1200 });

      await startProductionWatcher();

      expect(logger.warn).toHaveBeenCalledWith(
        "Production watcher: large ledger gap detected, fast-forwarding checkpoint",
        expect.objectContaining({ gap: 1100 }),
      );
    });

    it("does not fast-forward when the gap is within MAX_LEDGER_GAP", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
        ledger: 490,
      } as never);
      mockGetLatestLedger.mockResolvedValue({ sequence: 500 });

      await startProductionWatcher();

      expect(logger.warn).not.toHaveBeenCalledWith(
        "Production watcher: large ledger gap detected, fast-forwarding checkpoint",
        expect.anything(),
      );
    });
  });

  describe("poll loop", () => {
    it("calls getEvents with the correct startLedger on the first tick", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
        ledger: 300,
      } as never);
      mockGetLatestLedger.mockResolvedValue({ sequence: 301 });
      mockGetEvents.mockResolvedValue({ events: [] });

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({ startLedger: 300 }),
      );
    });

    it("advances the checkpoint after processing events", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce({
        ledger: 300,
      } as never);
      mockGetLatestLedger.mockResolvedValue({ sequence: 301 });

      const fakeEvent = {
        ledger: 302,
        id: "302-0",
        type: "contract",
        ledgerClosedAt: new Date().toISOString(),
        contractId: "CTEST",
        topic: [],
        value: "",
      };
      mockGetEvents.mockResolvedValueOnce({ events: [fakeEvent] });
      vi.mocked(ProductionEventParser.tryParse).mockReturnValueOnce(null);

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      // Second tick should use the advanced checkpoint (302 + 1 = 303).
      mockGetEvents.mockResolvedValueOnce({ events: [] });
      await vi.advanceTimersByTimeAsync(5_000);

      const calls = mockGetEvents.mock.calls;
      expect(calls[1][0]).toMatchObject({ startLedger: 303 });
    });

    it("logs and continues when getEvents throws", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
      mockGetLatestLedger.mockResolvedValue({ sequence: 500 });
      mockGetEvents.mockRejectedValueOnce(new Error("RPC timeout"));

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(logger.error).toHaveBeenCalledWith(
        "Production watcher poll error",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it("skips events that fail to parse (tryParse returns null)", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
      mockGetLatestLedger.mockResolvedValue({ sequence: 500 });

      const badEvent = {
        ledger: 501,
        id: "501-0",
        type: "contract",
        ledgerClosedAt: new Date().toISOString(),
        contractId: "CTEST",
        topic: [],
        value: "",
      };
      mockGetEvents.mockResolvedValueOnce({ events: [badEvent] });
      vi.mocked(ProductionEventParser.tryParse).mockReturnValueOnce(null);

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(EventPersister.persist).not.toHaveBeenCalled();
    });

    it("persists events that parse successfully", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
      mockGetLatestLedger.mockResolvedValue({ sequence: 500 });

      const rawEvent = {
        ledger: 501,
        id: "501-0",
        type: "contract",
        ledgerClosedAt: new Date().toISOString(),
        contractId: "CTEST",
        topic: [],
        value: "",
      };
      const parsedEvent = {
        action: "campaign.created" as const,
        ledger: 501,
        eventIndex: 0,
        timestamp: new Date(),
        rawId: "501-0",
        campaignId: "1",
        farmer: "GFARMER",
        token: "GTOKEN",
        targetAmount: "10000",
        deadline: "9999999",
      };

      mockGetEvents.mockResolvedValueOnce({ events: [rawEvent] });
      vi.mocked(ProductionEventParser.tryParse).mockReturnValueOnce(parsedEvent);

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(EventPersister.persist).toHaveBeenCalledWith(parsedEvent);
    });

    it("logs persist errors without crashing the poll loop", async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null);
      mockGetLatestLedger.mockResolvedValue({ sequence: 500 });

      const rawEvent = {
        ledger: 501,
        id: "501-0",
        type: "contract",
        ledgerClosedAt: new Date().toISOString(),
        contractId: "CTEST",
        topic: [],
        value: "",
      };
      const parsedEvent = {
        action: "campaign.settled" as const,
        ledger: 501,
        eventIndex: 0,
        timestamp: new Date(),
        rawId: "501-0",
        campaignId: "1",
        totalRevenue: "500",
      };

      mockGetEvents.mockResolvedValueOnce({ events: [rawEvent] });
      vi.mocked(ProductionEventParser.tryParse).mockReturnValueOnce(parsedEvent);
      vi.mocked(EventPersister.persist).mockRejectedValueOnce(new Error("write failed"));

      await startProductionWatcher();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(logger.error).toHaveBeenCalledWith(
        "EventPersister error",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });
  });
});
