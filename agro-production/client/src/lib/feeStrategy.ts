/**
 * Network-aware fee selection and fee-bump helpers.
 *
 * `StellarSdk.BASE_FEE` (100 stroops) is only ever accepted when the network
 * is idle. On mainnet surge pricing a floor-fee transaction is simply dropped
 * and then expires at its `setTimeout` bound with no recovery path. These
 * helpers derive an inclusion fee from live `getFeeStats` data and let a
 * stuck transaction be re-submitted as a fee-bump without rebuilding it.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { formatStroops } from "./validation";

export type CongestionPercentile =
  | "min"
  | "mode"
  | "p10"
  | "p20"
  | "p30"
  | "p40"
  | "p50"
  | "p60"
  | "p70"
  | "p80"
  | "p90"
  | "p95"
  | "p99"
  | "max";

/** Protocol minimum – never bid below this. */
export const MIN_INCLUSION_FEE = Number(StellarSdk.BASE_FEE);

/** Percentile of the recent Soroban inclusion-fee distribution to bid at. */
export const DEFAULT_FEE_PERCENTILE: CongestionPercentile =
  (process.env.NEXT_PUBLIC_FEE_PERCENTILE as CongestionPercentile) || "p70";

/** Hard ceiling so a misreported surge cannot drain a wallet (default 1 XLM). */
export const MAX_INCLUSION_FEE = Number(
  process.env.NEXT_PUBLIC_MAX_INCLUSION_FEE ?? "10000000",
);

/** Multiplier applied on top of the percentile for headroom (default 1.15). */
export const FEE_HEADROOM_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_FEE_HEADROOM ?? "1.15",
);

export interface FeeEstimate {
  /** Inclusion fee per operation, in stroops, ready for `TransactionBuilder`. */
  inclusionFee: string;
  /** Percentile the estimate was taken from. */
  percentile: CongestionPercentile;
  /** `true` when live network stats were used, `false` on fallback to the floor. */
  fromNetwork: boolean;
}

type FeeStatsSource = { getFeeStats: () => Promise<unknown> };

function clampFee(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return MIN_INCLUSION_FEE;
  return Math.min(Math.max(Math.ceil(value), MIN_INCLUSION_FEE), MAX_INCLUSION_FEE);
}

/**
 * Derive an inclusion fee from recent network conditions.
 *
 * Reads the Soroban inclusion-fee distribution from `getFeeStats`, takes the
 * configured percentile, applies a headroom multiplier and clamps the result
 * to `[MIN_INCLUSION_FEE, MAX_INCLUSION_FEE]`. Falls back to the floor when
 * stats are unavailable so callers never fail closed.
 */
export async function estimateInclusionFee(
  server: FeeStatsSource,
  percentile: CongestionPercentile = DEFAULT_FEE_PERCENTILE,
): Promise<FeeEstimate> {
  try {
    const stats = (await server.getFeeStats()) as
      | { sorobanInclusionFee?: Record<string, string>; inclusionFee?: Record<string, string> }
      | undefined;
    const dist = stats?.sorobanInclusionFee ?? stats?.inclusionFee;
    const raw = dist?.[percentile] ?? dist?.max ?? dist?.mode;
    const parsed = raw != null ? Number(raw) : NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { inclusionFee: String(MIN_INCLUSION_FEE), percentile, fromNetwork: false };
    }

    return {
      inclusionFee: String(clampFee(parsed * FEE_HEADROOM_MULTIPLIER)),
      percentile,
      fromNetwork: true,
    };
  } catch {
    return { inclusionFee: String(MIN_INCLUSION_FEE), percentile, fromNetwork: false };
  }
}

/**
 * Wrap an already-signed inner transaction in a fee-bump so it can be
 * re-submitted at a higher fee without the user rebuilding or re-signing the
 * inner operation. `feeSource` pays the bumped fee.
 */
export function buildFeeBumpTransaction(
  signedInnerXdr: string,
  feeSource: string,
  networkPassphrase: string,
  bumpInclusionFee: string,
): string {
  const inner = StellarSdk.TransactionBuilder.fromXDR(
    signedInnerXdr,
    networkPassphrase,
  ) as StellarSdk.Transaction;

  const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    feeSource,
    bumpInclusionFee,
    inner,
    networkPassphrase,
  );

  return feeBump.toXDR();
}

/**
 * The fee (in stroops) a built transaction currently commits to, so the UI can
 * show it before the user signs. Returns `null` if the XDR cannot be parsed.
 */
export function readTransactionFee(
  xdr: string,
  networkPassphrase: string,
): string | null {
  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase) as
      | StellarSdk.Transaction
      | StellarSdk.FeeBumpTransaction;
    return tx.fee;
  } catch {
    return null;
  }
}

/**
 * Format a stroop fee as an XLM string for display, via the shared exact
 * BigInt formatter (no floating point).
 */
export function formatFeeXlm(stroops: string | null): string {
  if (stroops == null) return "—";
  try {
    return `${formatStroops(BigInt(stroops))} XLM`;
  } catch {
    return "—";
  }
}
