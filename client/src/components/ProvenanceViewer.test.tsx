import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProvenanceViewer from "./ProvenanceViewer";
import type { ProvenanceRecord } from "@/types/provenance";

const trackedRecord: ProvenanceRecord = {
  orderId: "ord-1",
  farmerAddress: "GFARMERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  farmerName: "Green Valley Farm",
  batchId: "BATCH-2026-042",
  harvestDate: "2026-06-01T00:00:00.000Z",
  originLocation: "Nairobi, KE",
  tracked: true,
  shareUrl: "https://agrocylo.app/orders/ord-1",
  milestones: [
    {
      id: "farm",
      label: "Farm origin",
      status: "completed",
      date: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "harvest",
      label: "Harvest",
      status: "completed",
      date: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "ship",
      label: "Shipped",
      status: "current",
    },
    {
      id: "deliver",
      label: "Delivered",
      status: "upcoming",
    },
  ],
};

describe("ProvenanceViewer", () => {
  it("shows loading skeletons", () => {
    const { container } = render(<ProvenanceViewer isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("falls back cleanly when provenance is untracked", () => {
    render(
      <ProvenanceViewer
        record={{
          tracked: false,
          milestones: [],
          shareUrl: "https://example.com",
        }}
      />,
    );

    expect(screen.getByTestId("provenance-fallback")).toBeInTheDocument();
    expect(
      screen.getByText(/not available for this listing/i),
    ).toBeInTheDocument();
  });

  it("renders farmer, batch, harvest and milestones when tracked", () => {
    render(<ProvenanceViewer record={trackedRecord} />);

    expect(screen.getByText("Green Valley Farm")).toBeInTheDocument();
    expect(screen.getByText("BATCH-2026-042")).toBeInTheDocument();
    expect(screen.getByText("Nairobi, KE")).toBeInTheDocument();
    expect(screen.getByText("Farm origin")).toBeInTheDocument();
    expect(screen.getByText("Harvest")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByTestId("provenance-qr")).toBeInTheDocument();
  });

  it("renders null record as fallback", () => {
    render(<ProvenanceViewer record={null} />);
    expect(screen.getByTestId("provenance-fallback")).toBeInTheDocument();
  });
});
