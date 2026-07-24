import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CertificationBadge } from "../CertificationBadge";

describe("CertificationBadge", () => {
  const mockCertifications = [
    {
      id: "1",
      type: "organic",
      issuingOrganization: "USDA",
      issuedAt: "2024-01-01",
      expiresAt: "2025-01-01",
      verified: true,
    },
    {
      id: "2",
      type: "fair-trade",
      issuingOrganization: "Fair Trade USA",
      issuedAt: "2024-02-01",
      verified: false,
    },
  ];

  it("renders nothing when no certifications", () => {
    const { container } = render(<CertificationBadge certifications={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders compact badges", () => {
    render(<CertificationBadge certifications={mockCertifications} compact />);
    expect(screen.getByText("organic")).toBeInTheDocument();
    expect(screen.getByText("fair-trade")).toBeInTheDocument();
  });

  it("renders full certification details", () => {
    render(<CertificationBadge certifications={mockCertifications} />);
    expect(screen.getByText(/organic certification/i)).toBeInTheDocument();
    expect(screen.getByText(/fair-trade certification/i)).toBeInTheDocument();
  });

  it("shows verification status", () => {
    render(<CertificationBadge certifications={mockCertifications} />);
    const verifiedElements = screen.getAllByText(/✓ verified/i);
    expect(verifiedElements.length).toBeGreaterThan(0);
  });

  it("opens modal on details click", () => {
    render(<CertificationBadge certifications={mockCertifications} />);
    const detailsButton = screen.getAllByText(/view details/i)[0];
    fireEvent.click(detailsButton);
    
    expect(screen.getByText("USDA")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes modal on close button click", () => {
    render(<CertificationBadge certifications={mockCertifications} />);
    
    const detailsButton = screen.getAllByText(/view details/i)[0];
    fireEvent.click(detailsButton);
    
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("displays issuing organization in modal", () => {
    render(<CertificationBadge certifications={mockCertifications} />);
    
    const detailsButton = screen.getAllByText(/view details/i)[0];
    fireEvent.click(detailsButton);
    
    expect(screen.getByText("USDA")).toBeInTheDocument();
  });
});
