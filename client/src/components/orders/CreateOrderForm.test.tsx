import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateOrderForm } from "./CreateOrderForm";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => ({
    connected: true,
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "signed-xdr" }),
  })),
}));

vi.mock("@/hooks/useEscrowContract", () => ({
  useEscrowContract: vi.fn(() => ({
    createOrder: vi.fn().mockResolvedValue({ success: true }),
    createState: { loading: false, error: null, success: false, blockchainError: null },
  })),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({
    trackFunnelStep: vi.fn(),
    trackTransactionAttempt: vi.fn(),
    trackFormSubmission: vi.fn(),
  })),
}));

vi.mock("@/components/ContractGuard", () => ({
  ContractGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/services/stellar/networkConfig", () => ({
  requireNativeTokenContractId: vi.fn(() => "CAS3J6TYQXIQ5M5BZTTGQ5SREXQH5YMCN4FWNCZXXHTLRY555PK7XSCA"),
}));

vi.mock("@/lib/validation", () => ({
  createOrderFormSchema: {
    parse: vi.fn((data: unknown) => data),
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      const issues: { path: string[]; message: string }[] = [];
      const farmer = String(d.farmer ?? "").trim();
      if (!farmer || !/^G[A-Z0-9]{55}$/.test(farmer)) {
        issues.push({ path: ["farmer"], message: "Invalid Stellar address format" });
      }
      const amt = Number(d.amount);
      if (!d.amount || isNaN(amt) || amt <= 0) {
        issues.push({ path: ["amount"], message: "Amount must be greater than 0" });
      }
      if (!d.deliveryDeadline) {
        issues.push({ path: ["deliveryDeadline"], message: "Delivery deadline is required" });
      }
      if (issues.length > 0) {
        return { success: false, error: { issues } };
      }
      return { success: true, data };
    }),
  },
}));

vi.mock("@/components/FormError", () => ({
  FormError: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

vi.mock("@/lib/feeCalculations", () => ({
  PLATFORM_FEE_PCT: 3,
  xlmToStroops: (xlm: number) => BigInt(Math.round(xlm * 10_000_000)),
  displayFee: (grossXlm: number) => (grossXlm * 3) / 100,
  displayNet: (grossXlm: number) => grossXlm - (grossXlm * 3) / 100,
}));

const SUBMIT_BTN = /confirm & create escrow order/i;

function fillAllFields() {
  fireEvent.change(screen.getByLabelText(/farmer address/i), {
    target: { value: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37" },
  });
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText(/delivery deadline/i), {
    target: { value: "2026-12-31T23:59" },
  });
}

describe("CreateOrderForm - Checkout Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render form with all required fields", () => {
    render(<CreateOrderForm />);
    expect(screen.getByLabelText(/farmer address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. 50kg organic tomatoes/i)).toBeInTheDocument();
  });

  it("should calculate platform fee correctly", () => {
    render(<CreateOrderForm />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "100" } });

    expect(screen.getByText(/platform fee \(3%\)/i)).toBeInTheDocument();
    expect(screen.getByText("3.00 XLM")).toBeInTheDocument();
    expect(screen.getByText("97.00 XLM")).toBeInTheDocument();
  });

  it("should show validation error for invalid farmer address", async () => {
    render(<CreateOrderForm />);
    fillAllFields();
    // Now overwrite farmer with invalid value
    fireEvent.change(screen.getByLabelText(/farmer address/i), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BTN }));

    await waitFor(() => {
      expect(screen.getByText(/invalid stellar address/i)).toBeInTheDocument();
    });
  });

  it("should show validation error for zero amount", async () => {
    render(<CreateOrderForm />);
    fillAllFields();
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BTN }));

    await waitFor(() => {
      expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
    });
  });

  it("should show connect-wallet prompt when wallet is not connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      address: null,
      signTransaction: vi.fn(),
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      submitTransaction: vi.fn(),
    });

    render(<CreateOrderForm />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: SUBMIT_BTN })).not.toBeInTheDocument();
  });
});
