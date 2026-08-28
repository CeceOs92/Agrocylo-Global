"use client";

import { useMemo } from "react";
import { formatFeeXlm, readTransactionFee } from "@/lib/feeStrategy";

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

interface FeeEstimateProps {
  /** The built, unsigned transaction XDR the user is about to sign. */
  xdr: string | null | undefined;
  /** Passphrase the XDR was built for (defaults to the configured network). */
  networkPassphrase?: string;
  className?: string;
}

/**
 * Shows the network fee committed to a built transaction so the user sees it
 * before signing. Re-derives whenever `xdr` changes, so a rebuild triggered by
 * shifting network conditions updates the displayed estimate.
 */
export function FeeEstimate({
  xdr,
  networkPassphrase = NETWORK_PASSPHRASE,
  className,
}: FeeEstimateProps) {
  const fee = useMemo(
    () => (xdr ? readTransactionFee(xdr, networkPassphrase) : null),
    [xdr, networkPassphrase],
  );

  if (!xdr) return null;

  return (
    <p className={className ?? "text-sm text-gray-600"} data-testid="fee-estimate">
      Estimated network fee:{" "}
      <span className="font-medium" data-testid="fee-estimate-value">
        {formatFeeXlm(fee)}
      </span>
    </p>
  );
}
