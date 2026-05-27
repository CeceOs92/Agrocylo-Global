import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WalletProvider, useWallet } from "../context/WalletContext";

function TestConsumer() {
  const ctx = useWallet();
  return (
    <div>
      <span data-testid="addr">{ctx.address ?? "-"}</span>
      <button onClick={() => ctx.connect()}>connect</button>
      <span data-testid="connected">{String(ctx.connected)}</span>
    </div>
  );
}

describe("WalletProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // clear localStorage
    globalThis.localStorage?.clear?.();
  });

  it("connects using window.freighterApi", async () => {
    (globalThis as any).freighterApi = {
      getPublicKey: async () => "GTESTADDRESS",
    };
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    const btn = screen.getByText("connect");
    await act(async () => {
      btn.click();
      // allow effects
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId("connected").textContent).toBe("true");
    expect(screen.getByTestId("addr").textContent).toBe("GTESTADDRESS");
  });
});
