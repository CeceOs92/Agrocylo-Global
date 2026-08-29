import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NetworkBadge } from "./NetworkBadge";

vi.mock("@/services/stellar/networkConfig", () => ({
  isMainnet: vi.fn(),
  isTestnet: vi.fn(),
}));

import { isMainnet, isTestnet } from "@/services/stellar/networkConfig";

describe("NetworkBadge", () => {
  const mockIsMainnet = isMainnet as ReturnType<typeof vi.fn>;
  const mockIsTestnet = isTestnet as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockIsMainnet.mockReturnValue(false);
    mockIsTestnet.mockReturnValue(true);
  });

  it("displays TESTNET badge when on testnet", () => {
    render(<NetworkBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("TESTNET");
    expect(badge).toHaveClass("bg-yellow-600");
  });

  it("displays MAINNET badge when on mainnet", () => {
    mockIsMainnet.mockReturnValue(true);
    mockIsTestnet.mockReturnValue(false);

    render(<NetworkBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("MAINNET");
    expect(badge).toHaveClass("bg-red-600");
  });

  it("displays UNKNOWN badge when network is not recognized", () => {
    mockIsMainnet.mockReturnValue(false);
    mockIsTestnet.mockReturnValue(false);

    render(<NetworkBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("UNKNOWN");
    expect(badge).toHaveClass("bg-yellow-600");
  });

  it("does not render when detection fails", () => {
    mockIsMainnet.mockImplementation(() => {
      throw new Error("Config error");
    });

    const { container } = render(<NetworkBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("can be displayed without label", () => {
    render(<NetworkBadge showLabel={false} />);

    const badge = screen.getByRole("status");
    expect(badge).not.toHaveTextContent("TESTNET");
  });

  it("applies custom className", () => {
    render(<NetworkBadge className="custom-class" />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("custom-class");
  });

  it("has appropriate aria-label and title for accessibility", () => {
    render(<NetworkBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Network: TESTNET");
    expect(badge).toHaveAttribute("title");
  });

  it("includes warning in title for mainnet", () => {
    mockIsMainnet.mockReturnValue(true);
    mockIsTestnet.mockReturnValue(false);

    render(<NetworkBadge />);

    const badge = screen.getByRole("status");
    expect(badge.getAttribute("title")).toContain("REAL FUNDS");
  });
});
