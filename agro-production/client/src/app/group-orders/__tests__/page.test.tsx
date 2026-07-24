import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GroupOrdersPage from "../page";

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ lastMessage: null }),
}));

global.fetch = vi.fn();

describe("GroupOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    render(<GroupOrdersPage />);
    expect(screen.getByText(/loading group orders/i)).toBeInTheDocument();
  });

  it("renders empty state when no orders", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<GroupOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText(/no active group orders/i)).toBeInTheDocument();
    });
  });

  it("renders group orders with progress", async () => {
    const mockOrders = [
      {
        id: "1",
        productName: "Tomatoes",
        currentQuantity: 50,
        targetQuantity: 100,
        pricePerUnit: 5.0,
        expiresAt: new Date().toISOString(),
        status: "open",
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockOrders,
    });

    render(<GroupOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText("Tomatoes")).toBeInTheDocument();
      expect(screen.getByText(/50 \/ 100/)).toBeInTheDocument();
    });
  });

  it("handles expired orders correctly", async () => {
    const mockOrders = [
      {
        id: "1",
        productName: "Expired Product",
        currentQuantity: 10,
        targetQuantity: 100,
        pricePerUnit: 5.0,
        expiresAt: new Date().toISOString(),
        status: "expired",
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockOrders,
    });

    render(<GroupOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText(/order expired/i)).toBeInTheDocument();
    });
  });
});
