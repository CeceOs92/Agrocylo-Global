import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeatherAdvisoryWidget } from "../WeatherAdvisoryWidget";

vi.mock("next/dynamic", () => ({
  default: (fn: any) => {
    const Component = () => <div data-testid="farmer-map">Map</div>;
    Component.displayName = "DynamicFarmerMap";
    return Component;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

global.fetch = vi.fn();

describe("WeatherAdvisoryWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    render(<WeatherAdvisoryWidget />);
    expect(screen.getByText(/weather advisories/i)).toBeInTheDocument();
  });

  it("renders error state", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Failed to fetch"));

    render(<WeatherAdvisoryWidget />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load weather data/i)).toBeInTheDocument();
    });
  });

  it("renders no advisory state", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<WeatherAdvisoryWidget />);
    await waitFor(() => {
      expect(screen.getByText(/no active weather advisories/i)).toBeInTheDocument();
      expect(screen.getByText(/conditions are favorable/i)).toBeInTheDocument();
    });
  });

  it("renders active advisories", async () => {
    const mockAdvisories = [
      {
        id: "1",
        severity: "high",
        type: "Heavy Rain Warning",
        description: "Expect heavy rainfall in the next 24 hours",
        location: { lat: 10, lng: 20, name: "Farm Area" },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAdvisories,
    });

    render(<WeatherAdvisoryWidget />);
    await waitFor(() => {
      expect(screen.getByText("Heavy Rain Warning")).toBeInTheDocument();
      expect(screen.getByText(/expect heavy rainfall/i)).toBeInTheDocument();
    });
  });

  it("filters out expired advisories", async () => {
    const mockAdvisories = [
      {
        id: "1",
        severity: "low",
        type: "Expired Advisory",
        description: "This should not appear",
        location: { lat: 10, lng: 20, name: "Farm Area" },
        issuedAt: new Date(Date.now() - 172800000).toISOString(),
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockAdvisories,
    });

    render(<WeatherAdvisoryWidget />);
    await waitFor(() => {
      expect(screen.queryByText("Expired Advisory")).not.toBeInTheDocument();
      expect(screen.getByText(/no active weather advisories/i)).toBeInTheDocument();
    });
  });
});
