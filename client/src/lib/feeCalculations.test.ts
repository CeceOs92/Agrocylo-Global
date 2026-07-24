import { describe, it, expect } from "vitest";
import {
  xlmToStroops,
  feeFromGrossStroops,
  netFromGrossStroops,
  displayFee,
  displayNet,
  STROOPS_PER_XLM,
  PLATFORM_FEE_BPS,
  BPS_DENOM,
} from "./feeCalculations";

describe("xlmToStroops", () => {
  it("converts whole XLM correctly", () => {
    expect(xlmToStroops(1)).toBe(10_000_000n);
    expect(xlmToStroops(100)).toBe(1_000_000_000n);
    expect(xlmToStroops(0)).toBe(0n);
  });

  it("converts 2-decimal XLM without floating-point drift", () => {
    expect(xlmToStroops(0.01)).toBe(100_000n);
    expect(xlmToStroops(0.99)).toBe(9_900_000n);
    expect(xlmToStroops(1.23)).toBe(12_300_000n);
    expect(xlmToStroops(10.50)).toBe(105_000_000n);
  });

  it("is deterministic and repeatable", () => {
    // Run the same conversion multiple times - should always yield same result
    for (let i = 0; i < 100; i++) {
      expect(xlmToStroops(123.45)).toBe(1_234_500_000n);
    }
  });

  it("handles price×quantity combos without stroop rounding drift", () => {
    // 2.33 XLM × 7 = 16.31 XLM → should be exactly 163,100,000 stroops
    const totalPrice = 2.33 * 7;
    expect(xlmToStroops(totalPrice)).toBe(163_100_000n);

    // 1.99 XLM × 3 = 5.97 XLM → should be exactly 59,700,000 stroops
    const totalPrice2 = 1.99 * 3;
    expect(xlmToStroops(totalPrice2)).toBe(59_700_000n);
  });

  it("handles negative and NaN inputs safely", () => {
    expect(xlmToStroops(-1)).toBe(0n);
    expect(xlmToStroops(NaN)).toBe(0n);
    expect(xlmToStroops(Infinity)).toBe(0n);
  });

  it("produces integer stroops for all 2-decimal inputs from 0.01 to 10000.00", () => {
    // Spot-check a range of values
    const testValues = [0.01, 0.10, 0.50, 1.00, 1.01, 5.55, 9.99, 10.00, 50.25, 100.00, 999.99, 1000.00];
    for (const xlm of testValues) {
      const stroops = xlmToStroops(xlm);
      const expected = BigInt(Math.round(xlm * 100)) * 100_000n;
      expect(stroops).toBe(expected);
    }
  });
});

describe("feeFromGrossStroops", () => {
  it("calculates 3% fee on gross stroops", () => {
    // 100 XLM = 1,000,000,000 stroops; 3% fee = 30,000,000 stroops
    expect(feeFromGrossStroops(1_000_000_000n)).toBe(30_000_000n);
  });

  it("rounds down (integer division)", () => {
    // 333 stroops * 300 / 10000 = 9 stroops (floor)
    expect(feeFromGrossStroops(333n)).toBe(9n);
  });

  it("returns 0 for amounts below fee threshold", () => {
    // 1 stroop * 300 / 10000 = 0
    expect(feeFromGrossStroops(1n)).toBe(0n);
    expect(feeFromGrossStroops(33n)).toBe(0n);
  });
});

describe("netFromGrossStroops", () => {
  it("returns gross minus fee", () => {
    expect(netFromGrossStroops(1_000_000_000n)).toBe(970_000_000n);
  });
});

describe("displayFee / displayNet", () => {
  it("calculates display fee correctly", () => {
    expect(displayFee(100)).toBe(3);
    expect(displayFee(50)).toBe(1.5);
    expect(displayFee(0)).toBe(0);
  });

  it("calculates display net correctly", () => {
    expect(displayNet(100)).toBe(97);
    expect(displayNet(50)).toBe(48.5);
  });
});

describe("Escrow amount consistency (Issue #626)", () => {
  it("cart and single-item flows produce same stroops for same listed price", () => {
    // Single-item flow: xlmToStroops(totalPrice) → escrows gross
    // Cart flow: should also escrow gross (full subtotal) now
    // Both paths should produce the same on-chain amount

    const listedPrice = 150.75; // XLM
    const cartSubtotalStroops = BigInt(15075) * 100_000n; // $150.75 in stroops from cart API

    const singleItemStroops = xlmToStroops(listedPrice);

    // They must be identical
    expect(singleItemStroops).toBe(cartSubtotalStroops);
    expect(singleItemStroops).toBe(1_507_500_000n);
  });

  it("fee is cosmetic only — gross is escrowed in both paths", () => {
    const gross = xlmToStroops(100); // 100 XLM
    const fee = feeFromGrossStroops(gross);
    const net = gross - fee;

    // The escrowed amount is gross, not net
    // Fee displayed to user is net, but what goes on-chain is gross
    expect(gross).toBe(1_000_000_000n);
    expect(fee).toBe(30_000_000n);
    expect(net).toBe(970_000_000n);

    // Gross should NOT equal net (the fee deduction is cosmetic)
    expect(gross).not.toBe(net);
  });
});
