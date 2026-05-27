import type { ProductCategory } from "@/types";

const STELLAR_PUBKEY_RE = /^G[A-Z0-9]{55}$/;
const XSS_RE = /<[^>]*>|javascript:|on\w+\s*=|alert\(|confirm\(|prompt\(/gi;

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult =
  | { valid: true; sanitized: string }
  | { valid: false; error: string };

export function sanitizeString(input: string): string {
  return input.replace(XSS_RE, "").trim();
}

export function validateStellarAddress(address: string): ValidationResult {
  const sanitized = sanitizeString(address);
  if (!sanitized) return { valid: false, error: "Address is required" };
  if (!STELLAR_PUBKEY_RE.test(sanitized))
    return { valid: false, error: "Invalid Stellar public key format" };
  return { valid: true, sanitized };
}

export function validateAmount(
  input: string,
  min = 0,
  max = Infinity,
): ValidationResult {
  const sanitized = sanitizeString(input);
  if (!sanitized) return { valid: false, error: "Amount is required" };
  const num = Number(sanitized);
  if (isNaN(num) || !isFinite(num))
    return { valid: false, error: "Amount must be a valid number" };
  if (num <= min) return { valid: false, error: `Amount must be greater than ${min}` };
  if (num > max) return { valid: false, error: `Amount must not exceed ${max}` };
  return { valid: true, sanitized };
}

export function validateQuantity(
  input: string,
  min = 1,
  max = 999999,
): ValidationResult {
  const sanitized = sanitizeString(input);
  if (!sanitized) return { valid: false, error: "Quantity is required" };
  const num = Number(sanitized);
  if (!Number.isInteger(num) || num < min)
    return { valid: false, error: `Quantity must be at least ${min}` };
  if (num > max)
    return { valid: false, error: `Quantity must not exceed ${max}` };
  return { valid: true, sanitized: String(num) };
}

export function validateOptionalNumber(
  input: string,
  label: string,
): ValidationResult {
  const sanitized = sanitizeString(input);
  if (!sanitized) return { valid: true, sanitized: "" };
  const num = Number(sanitized);
  if (isNaN(num) || !isFinite(num) || num < 0)
    return { valid: false, error: `${label} must be a valid non-negative number` };
  return { valid: true, sanitized };
}

export function validateProductFilters(filters: {
  category?: ProductCategory | "";
  location?: string;
  minPrice?: string;
  maxPrice?: string;
}): { valid: boolean; sanitized: typeof filters; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const sanitized: typeof filters = { ...filters };

  if (filters.location) {
    sanitized.location = sanitizeString(filters.location);
  }

  if (filters.minPrice) {
    const result = validateOptionalNumber(filters.minPrice, "Min price");
    if (!result.valid) {
      errors.push({ field: "minPrice", message: result.error });
    } else {
      sanitized.minPrice = result.sanitized;
    }
  }

  if (filters.maxPrice) {
    const result = validateOptionalNumber(filters.maxPrice, "Max price");
    if (!result.valid) {
      errors.push({ field: "maxPrice", message: result.error });
    } else {
      sanitized.maxPrice = result.sanitized;
    }
  }

  if (
    sanitized.minPrice &&
    sanitized.maxPrice &&
    Number(sanitized.minPrice) > Number(sanitized.maxPrice)
  ) {
    errors.push({
      field: "maxPrice",
      message: "Max price must be greater than or equal to min price",
    });
  }

  return { valid: errors.length === 0, sanitized, errors };
}

export function validateCheckoutInput(input: {
  amountXlm: string;
}): ValidationResult {
  return validateAmount(input.amountXlm, 0);
}

export function validateCampaignTimestamps(deadline: string): ValidationResult {
  const sanitized = sanitizeString(deadline);
  if (!sanitized) return { valid: false, error: "Deadline is required" };
  const ts = Date.parse(sanitized);
  if (isNaN(ts)) return { valid: false, error: "Invalid date format" };
  return { valid: true, sanitized };
}

export function validateOrderData(data: {
  buyerAddress: string;
  campaignId: string;
  amount: string;
}): { valid: boolean; sanitized: typeof data; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const sanitized = { ...data };

  const addrResult = validateStellarAddress(data.buyerAddress);
  if (!addrResult.valid) {
    errors.push({ field: "buyerAddress", message: addrResult.error });
  } else {
    sanitized.buyerAddress = addrResult.sanitized;
  }

  if (!data.campaignId || !sanitizeString(data.campaignId)) {
    errors.push({ field: "campaignId", message: "Campaign ID is required" });
  } else {
    sanitized.campaignId = sanitizeString(data.campaignId);
  }

  const amtResult = validateAmount(data.amount, 0);
  if (!amtResult.valid) {
    errors.push({ field: "amount", message: amtResult.error });
  } else {
    sanitized.amount = amtResult.sanitized;
  }

  return { valid: errors.length === 0, sanitized, errors };
}
