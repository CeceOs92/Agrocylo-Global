/**
 * load-test/shared/env.js
 *
 * Centralised environment-variable config with safe defaults.
 * Every scenario imports this so there is one place to change base URLs.
 */

// k6 exposes process.env as __ENV
const e = __ENV;

export const ENV = {
  // ── Server (server/) ──────────────────────────────────────────────────────
  SERVER_BASE_URL: e.SERVER_BASE_URL || "http://localhost:5000",

  // ── Agro-Production server (agro-production/server/) ─────────────────────
  AGRO_BASE_URL: e.AGRO_BASE_URL || "http://localhost:5001",

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Must match the JWT_SECRET configured in the target server.
  // For staging/CI, inject via env rather than committing a real secret.
  JWT_SECRET: e.JWT_SECRET || "dev-secret-key-minimum32chars!!",

  // Wallet addresses embedded in test tokens.
  // Swap these out to match pre-seeded rows in the staging database.
  TEST_WALLET_ADDRESS: e.TEST_WALLET_ADDRESS || "GBTEST000000000000000000000000000000000000000000000000000",
  TEST_SELLER_ADDRESS: e.TEST_SELLER_ADDRESS || "GBSELLER0000000000000000000000000000000000000000000000000",

  // ── Agro-production test fixtures ─────────────────────────────────────────
  // A campaign that is in FUNDING status in the staging database.
  TEST_CAMPAIGN_ID: e.TEST_CAMPAIGN_ID || "",

  // ── Load profile ──────────────────────────────────────────────────────────
  LOAD_PROFILE: e.LOAD_PROFILE || "smoke",

  // Per-profile VU counts (overridable)
  K6_SMOKE_VUS:   parseInt(e.K6_SMOKE_VUS   || "5",   10),
  K6_LOAD_VUS:    parseInt(e.K6_LOAD_VUS    || "100", 10),
  K6_SOAK_VUS:    parseInt(e.K6_SOAK_VUS    || "50",  10),
  K6_SOAK_DURATION: e.K6_SOAK_DURATION || "10m",
};
