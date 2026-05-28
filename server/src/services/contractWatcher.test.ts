import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: { Server: vi.fn() },
  scValToNative: vi.fn(),
  xdr: { ScVal: { fromXDR: vi.fn() } },
}));
vi.mock("../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../config/index.js", () => ({
  config: {
    contractId: "test-contract",
    rpcUrl: "https://testnet.local",
    wsPath: "/ws",
  },
}));
vi.mock("../config/database.js", () => ({
  prisma: {
    contractWatcherCheckpoint: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("./notificationService.js", () => ({
  NotificationService: { notify: vi.fn(), notifyFromEscrowEvent: vi.fn(), notifyOrderEvent: vi.fn() },
}));
vi.mock("./wsManager.js", () => ({
  wsManager: { broadcast: vi.fn(), broadcastTo: vi.fn(), clientCount: 0 },
vi.mock("./notificationService.js", () => ({
  NotificationService: { notifyFromEscrowEvent: vi.fn() },
}));
vi.mock("./wsManager.js", () => ({
  wsManager: { broadcast: vi.fn(), broadcastTo: vi.fn() },
}));
vi.mock("./events/blockchainEventIngestionService.js", () => ({
  BlockchainEventIngestionService: { ingestEvent: vi.fn() },
}));
vi.mock("./events/escrowEventIngestionService.js", () => ({
  EscrowEventIngestionService: { ingestEvent: vi.fn() },
}));
vi.mock("../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../config/index.js", () => ({
  config: { contractId: "CONTRACT", rpcUrl: "https://rpc.example", wsPath: "/ws" },
}));

import { dispatchEvent } from "./contractWatcher.js";
import { NotificationService } from "./notificationService.js";
import { wsManager } from "./wsManager.js";

describe("contractWatcher dispatchEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes a 'created' event to a notification and a broadcast", () => {
    dispatchEvent("created", ["order-1", "BUYER", "FARMER", "100", "TOKEN"], 42);

    expect(NotificationService.notifyFromEscrowEvent).toHaveBeenCalledWith({
      action: "created",
      buyerAddress: "BUYER",
      farmerAddress: "FARMER",
      orderId: "order-1",
      amount: "100",
      token: "TOKEN",
    });
    expect(wsManager.broadcast).toHaveBeenCalledWith("order:created", {
      orderId: "order-1",
      buyer: "BUYER",
      farmer: "FARMER",
      amount: "100",
      token: "TOKEN",
    });
  });

  it("broadcasts 'delivered' as a status update without a notification", () => {
    dispatchEvent("delivered", ["order-2", "FARMER", "BUYER", "1700000000"], 43);

    expect(wsManager.broadcast).toHaveBeenCalledWith("order:delivered", {
      orderId: "order-2",
      farmer: "FARMER",
      buyer: "BUYER",
    });
    expect(NotificationService.notifyFromEscrowEvent).not.toHaveBeenCalled();
  });

  it("routes 'confirmed' to a notification and a broadcast", () => {
    dispatchEvent("confirmed", ["order-3", "BUYER", "FARMER"]);

    expect(NotificationService.notifyFromEscrowEvent).toHaveBeenCalledWith({
      action: "confirmed",
      buyerAddress: "BUYER",
      farmerAddress: "FARMER",
      orderId: "order-3",
    });
    expect(wsManager.broadcast).toHaveBeenCalledWith("order:confirmed", {
      orderId: "order-3",
      buyer: "BUYER",
      farmer: "FARMER",
    });
  });

  it("routes 'refunded' to a notification and a broadcast", () => {
    dispatchEvent("refunded", ["order-4", "BUYER"]);

    expect(NotificationService.notifyFromEscrowEvent).toHaveBeenCalledWith({
      action: "refunded",
      buyerAddress: "BUYER",
      orderId: "order-4",
    });
    expect(wsManager.broadcast).toHaveBeenCalledWith("order:refunded", {
      orderId: "order-4",
      buyer: "BUYER",
    });
  });

  it("ignores unknown actions without notifying or broadcasting", () => {
    dispatchEvent("bogus", ["order-5"]);

    expect(NotificationService.notifyFromEscrowEvent).not.toHaveBeenCalled();
    expect(wsManager.broadcast).not.toHaveBeenCalled();
  });
});
