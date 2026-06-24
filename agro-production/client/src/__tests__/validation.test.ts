import { describe, expect, it } from "vitest";
import {
  MAX_I128,
  STROOPS_PER_XLM,
  parseXlmToStroops,
  validateCheckoutInput,
} from "@/lib/validation";

describe("parseXlmToStroops", () => {
  it.each([
    ["1", 10_000_000n],
    ["1.2", 12_000_000n],
    ["0.0000001", 1n],
    ["123456789.1234567", 1_234_567_891_234_567n],
    ["17014118346046923173168730371588.4105727", MAX_I128],
  ])("converts %s exactly", (input, expected) => {
    expect(parseXlmToStroops(input)).toEqual({
      valid: true,
      sanitized: input,
      stroops: expected,
    });
  });

  it.each([
    "",
    "   ",
    "0",
    "0.0000000",
    "-1",
    "+1",
    "1e3",
    "1.00000000",
    " 1",
    "1 ",
    "01",
    "1.",
    "17014118346046923173168730371588.4105728",
  ])("rejects unsafe input %j", (input) => {
    expect(parseXlmToStroops(input).valid).toBe(false);
  });

  it("uses the same rules for checkout validation", () => {
    expect(validateCheckoutInput({ amountXlm: "0.0000001" })).toEqual({
      valid: true,
      sanitized: "0.0000001",
    });
    expect(validateCheckoutInput({ amountXlm: "1e3" }).valid).toBe(false);
  });

  it("documents the base-unit scale", () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });
});
