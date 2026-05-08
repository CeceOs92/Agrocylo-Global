/**
 * Centralised E2E test-mode detection.
 *
 * Playwright tests inject a mock at `window.freighter.signTransaction`. When that
 * mock is present, services return deterministic dummy data instead of hitting
 * the real backend or Soroban RPC.
 *
 * This is the single source of truth — every other module imports it from here.
 */
export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.freighter?.signTransaction === "function";
}
