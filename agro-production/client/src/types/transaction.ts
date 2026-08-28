/** Transaction state machine types for the checkout flow.
 *
 * Steps in order: record (off-chain) → sign (wallet) → submit (on-chain) → confirm
 * Each step can be idle, active, done, or error.
 * The machine enforces forward-only transitions; you cannot skip a step.
 */

export type TxStep = "record" | "sign" | "submit" | "confirm";
export type StepStatus = "idle" | "active" | "done" | "error";

export type TxStepState = Record<TxStep, StepStatus>;

export type TxPhase =
  | "idle"
  | "recording"   // creating off-chain order
  | "signing"     // waiting for wallet signature
  | "submitting"  // broadcasting to Stellar
  | "confirming"  // waiting for ledger inclusion
  | "success"
  | "pending"     // submitted, not yet confirmed — NOT failed, do not resubmit
  | "failed";

export interface TxMachineState {
  phase: TxPhase;
  steps: TxStepState;
  txHash?: string;
  error?: string;
}

const IDLE_STEPS: TxStepState = {
  record: "idle",
  sign: "idle",
  submit: "idle",
  confirm: "idle",
};

export function idleMachine(): TxMachineState {
  return { phase: "idle", steps: { ...IDLE_STEPS } };
}

/** Advance the machine to the next phase, enforcing valid transitions. */
export function advanceMachine(
  current: TxMachineState,
  to: TxPhase,
  extra?: { txHash?: string; error?: string },
): TxMachineState {
  const VALID: Record<TxPhase, TxPhase[]> = {
    idle:       ["recording"],
    recording:  ["signing", "failed"],
    signing:    ["submitting", "failed"],
    submitting: ["confirming", "success", "pending", "failed"],
    confirming: ["success", "pending", "failed"],
    // A pending transaction may still confirm, fail, or be abandoned later.
    pending:    ["success", "failed", "idle"],
    success:    [],
    failed:     ["idle"],
  };

  if (!VALID[current.phase].includes(to)) {
    console.warn(`[TxMachine] invalid transition ${current.phase} → ${to}`);
    return current;
  }

  const steps: TxStepState = { ...current.steps };

  switch (to) {
    case "recording":
      steps.record = "active";
      break;
    case "signing":
      steps.record = "done";
      steps.sign = "active";
      break;
    case "submitting":
      steps.sign = "done";
      steps.submit = "active";
      break;
    case "confirming":
      steps.submit = "done";
      steps.confirm = "active";
      break;
    case "success":
      // mark the last active step as done
      if (steps.confirm === "active") steps.confirm = "done";
      else if (steps.submit === "active") steps.submit = "done";
      break;
    case "pending":
      // Broadcast succeeded; confirmation is still outstanding (not an error).
      steps.submit = "done";
      steps.confirm = "active";
      break;
    case "failed":
      // mark the current active step as error
      for (const k of (["confirm", "submit", "sign", "record"] as TxStep[])) {
        if (steps[k] === "active") { steps[k] = "error"; break; }
      }
      break;
    case "idle":
      return idleMachine();
  }

  return { phase: to, steps, txHash: extra?.txHash, error: extra?.error };
}
