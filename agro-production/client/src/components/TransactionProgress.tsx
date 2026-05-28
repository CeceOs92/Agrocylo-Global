"use client";

import type { TxStep, TxStepState, StepStatus } from "@/types/transaction";
import { ButtonSpinner } from "@/components/Skeletons";

const STEP_LABELS: Record<TxStep, string> = {
  record:  "Record order",
  sign:    "Sign transaction",
  submit:  "Submit to Stellar",
  confirm: "Confirmed",
};

const STEP_DESCS: Record<TxStep, string> = {
  record:  "Creating order record off-chain",
  sign:    "Waiting for your wallet signature",
  submit:  "Broadcasting transaction to the network",
  confirm: "Order confirmed on the Stellar ledger",
};

const STEPS: TxStep[] = ["record", "sign", "submit", "confirm"];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white text-sm font-bold shrink-0" aria-hidden="true">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold shrink-0" aria-hidden="true">
        ✗
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-600 bg-primary-50 shrink-0" aria-hidden="true">
        <ButtonSpinner className="text-primary-600" />
      </span>
    );
  }
  // idle
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-surface text-muted text-xs shrink-0" aria-hidden="true">
      ○
    </span>
  );
}

function connector(status: StepStatus) {
  return (
    <div
      className={`mx-4 w-0.5 h-6 transition-colors duration-300 ${
        status === "done" ? "bg-primary-600" : "bg-border"
      }`}
      aria-hidden="true"
    />
  );
}

interface Props {
  steps: TxStepState;
  txHash?: string;
}

export default function TransactionProgress({ steps, txHash }: Props) {
  return (
    <div
      className="border border-border rounded-xl p-5 bg-surface"
      role="status"
      aria-live="polite"
      aria-label="Transaction progress"
    >
      <p className="text-sm font-semibold text-foreground mb-4">Transaction Progress</p>

      <ol className="space-y-0" aria-label="Transaction steps">
        {STEPS.map((step, idx) => {
          const status = steps[step];
          return (
            <li key={step}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <StepIcon status={status} />
                  {idx < STEPS.length - 1 && connector(status)}
                </div>

                <div className="pb-6">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      status === "idle" ? "text-muted" : "text-foreground"
                    } ${status === "error" ? "text-red-600" : ""}`}
                  >
                    {STEP_LABELS[step]}
                  </p>
                  {status !== "idle" && (
                    <p className="text-xs text-muted mt-0.5">{STEP_DESCS[step]}</p>
                  )}
                  {step === "confirm" && status === "done" && txHash && (
                    <p className="text-xs font-mono text-muted mt-1 break-all">
                      Tx: {txHash.slice(0, 16)}…{txHash.slice(-8)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
