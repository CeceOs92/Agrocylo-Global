import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WalletProvider, useWallet } from "../context/WalletContext";
import { saveWalletSession } from "../lib/walletSession";

vi.mock("../lib/walletFreighter", () => ({
  getFreighterPublicKey: vi.fn(),
}));

import { getFreighterPublicKey } from "../lib/walletFreighter";

const mockGetPublicKey = vi.mocked(getFreighterPublicKey);

function TestConsumer() {
  const ctx = useWallet();
  return (
    <div>
      <span data-testid="addr">{ctx.address ?? "-"}</span>
      <button onClick={() => ctx.connect()}>connect</button>
      <span data-testid="connected">{String(ctx.connected)}</span>
      <span data-testid="reconnecting">{String(ctx.reconnecting)}</span>
    </div>
  );
}

describe("WalletProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage?.clear?.();
    delete (globalThis as { freighterApi?: unknown }).freighterApi;
  });

  it("connects using Freighter public key lookup", async () => {
    mockGetPublicKey.mockResolvedValue("GTESTADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("reconnecting").textContent).toBe("false");
    });

    const btn = screen.getByText("connect");
    await act(async () => {
      btn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
    });
    expect(screen.getByTestId("addr").textContent).toBe("GTESTADDRESS");
  });

  it("restores a valid saved session on startup", async () => {
    saveWalletSession({ address: "GSAVEDADDRESS", connectedAt: Date.now() });
    mockGetPublicKey.mockResolvedValue("GSAVEDADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
    });
    expect(screen.getByTestId("addr").textContent).toBe("GSAVEDADDRESS");
  });

  it("adopts the active wallet when it differs from the saved session", async () => {
    saveWalletSession({ address: "GOLDADDRESS", connectedAt: Date.now() });
    mockGetPublicKey.mockResolvedValue("GNEWADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("addr").textContent).toBe("GNEWADDRESS");
    });
    expect(screen.getByTestId("connected").textContent).toBe("true");
    expect(globalThis.localStorage.getItem("ap_walletSession")).toContain("GNEWADDRESS");
  });

  it("clears stale session when Freighter is unavailable", async () => {
    saveWalletSession({ address: "GSTALEADDRESS", connectedAt: Date.now() });
    mockGetPublicKey.mockResolvedValue(null);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("reconnecting").textContent).toBe("false");
    });
    expect(screen.getByTestId("connected").textContent).toBe("false");
    expect(globalThis.localStorage.getItem("ap_walletSession")).toBeNull();
  });
});
