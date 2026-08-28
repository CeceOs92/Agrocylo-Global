import { describe, it, expect } from "vitest";
import { advanceMachine, idleMachine } from "../types/transaction";

describe("transaction state machine — pending outcome", () => {
  function submitting() {
    return advanceMachine(
      advanceMachine(advanceMachine(idleMachine(), "recording"), "signing"),
      "submitting",
    );
  }

  it("allows submitting → pending and marks submit done, confirm still active", () => {
    const m = advanceMachine(submitting(), "pending", { txHash: "HASH" });
    expect(m.phase).toBe("pending");
    expect(m.steps.submit).toBe("done");
    expect(m.steps.confirm).toBe("active");
    expect(m.txHash).toBe("HASH");
  });

  it("never marks a pending transaction's steps as error", () => {
    const m = advanceMachine(submitting(), "pending");
    expect(Object.values(m.steps)).not.toContain("error");
  });

  it("lets a pending transaction later resolve to success or failed", () => {
    const pending = advanceMachine(submitting(), "pending");
    expect(advanceMachine(pending, "success").phase).toBe("success");
    expect(advanceMachine(pending, "failed").phase).toBe("failed");
    expect(advanceMachine(pending, "idle").phase).toBe("idle");
  });
});
