import { describe, it, expect } from "vitest";
import {
  canPerformCampaignAction,
  availableCampaignActions,
} from "../lib/campaignActions";

describe("campaignActions role/status gating", () => {
  it("lets a farmer start production only on a funded campaign", () => {
    expect(canPerformCampaignAction("start_production", "farmer", "FUNDED")).toBe(true);
    expect(canPerformCampaignAction("start_production", "farmer", "FUNDING")).toBe(false);
    expect(canPerformCampaignAction("start_production", "investor", "FUNDED")).toBe(false);
  });

  it("lets an investor refund only on a failed campaign", () => {
    expect(canPerformCampaignAction("refund", "investor", "FAILED")).toBe(true);
    expect(canPerformCampaignAction("refund", "investor", "SETTLED")).toBe(false);
    expect(canPerformCampaignAction("refund", "farmer", "FAILED")).toBe(false);
  });

  it("only an admin resolves a dispute; any stakeholder may open one", () => {
    expect(canPerformCampaignAction("open_dispute", "investor", "IN_PRODUCTION")).toBe(true);
    expect(canPerformCampaignAction("resolve_dispute", "investor", "DISPUTED")).toBe(false);
    expect(canPerformCampaignAction("resolve_dispute", "admin", "DISPUTED")).toBe(true);
  });

  it("hides all actions for a role with nothing to do in the current state", () => {
    expect(availableCampaignActions("buyer", "SETTLED")).toEqual([]);
  });

  it("surfaces the farmer progression path across the lifecycle", () => {
    expect(availableCampaignActions("farmer", "FUNDED")).toContain("start_production");
    expect(availableCampaignActions("farmer", "IN_PRODUCTION")).toContain("mark_harvest");
    expect(availableCampaignActions("farmer", "HARVESTED")).toContain("settle");
  });

  it("gives an investor a refund path on failure and a claim path on settlement", () => {
    expect(availableCampaignActions("investor", "FAILED")).toEqual(["refund"]);
    expect(availableCampaignActions("investor", "SETTLED")).toEqual(["claim_returns"]);
  });
});
