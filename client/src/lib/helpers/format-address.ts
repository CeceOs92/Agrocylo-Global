/**
 * Format a Stellar account address as `GABCD…WXYZ` for compact display.
 * Stellar public keys are 56-char strkey strings starting with G.
 */
export function formatTruncatedAddress(address: string | null | undefined): string {
  if (!address) return "";
  return address.length > 10
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}
