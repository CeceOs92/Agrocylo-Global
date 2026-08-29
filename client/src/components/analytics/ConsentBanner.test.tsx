import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConsentBanner from "./ConsentBanner";

const mockSetConsent = vi.fn();
let mockConsent: "granted" | "denied" | "unknown" = "unknown";

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    consent: mockConsent,
    setConsent: mockSetConsent,
  }),
}));

describe("ConsentBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsent = "unknown";
  });

  it("renders on first visit, when no consent choice has been made yet", () => {
    render(<ConsentBanner />);
    expect(screen.getByTestId("analytics-consent-banner")).toBeInTheDocument();
  });

  it("does not render on a subsequent visit once consent was granted", () => {
    mockConsent = "granted";
    render(<ConsentBanner />);
    expect(
      screen.queryByTestId("analytics-consent-banner"),
    ).not.toBeInTheDocument();
  });

  it("does not render on a subsequent visit once consent was denied", () => {
    mockConsent = "denied";
    render(<ConsentBanner />);
    expect(
      screen.queryByTestId("analytics-consent-banner"),
    ).not.toBeInTheDocument();
  });

  it('grants consent when "Accept" is clicked', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(mockSetConsent).toHaveBeenCalledWith("granted");
  });

  it('denies consent when "Decline" is clicked', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(mockSetConsent).toHaveBeenCalledWith("denied");
  });
});
