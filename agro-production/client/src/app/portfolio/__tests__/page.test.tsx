import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PortfolioPage from "../page";

vi.mock("@/components/PriceChart", () => ({
  PriceChart: () => <div data-testid="price-chart">Chart</div>,
}));

global.fetch = vi.fn();

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    render(<PortfolioPage />);
    expect(screen.getByTestId("price-chart")).toBeDefined();
  });

  it("renders error state", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Failed to fetch"));

    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no investments", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ investments: [], summary: null }),
    });

    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/no investments yet/i)).toBeInTheDocument();
    });
  });

  it("renders portfolio data correctly", async () => {
    const mockData = {
      investments: [
        {
          id: "1",
          campaignName: "Rice Farm",
          amountInvested: 1000,
          currentValue: 1200,
          roi: 20,
          status: "active",
          investedAt: new Date().toISOString(),
        },
      ],
      summary: {
        totalInvested: 1000,
        totalReturned: 1200,
        overallROI: 20,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText("Rice Farm")).toBeInTheDocument();
      expect(screen.getByText("$1000.00")).toBeInTheDocument();
      expect(screen.getByText("+20.00%")).toBeInTheDocument();
    });
  });
});
