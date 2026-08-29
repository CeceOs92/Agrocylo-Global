/**
 * Which contract actions a given caller may take on a campaign, given its
 * on-chain status and the caller's role. Pages use this to show/enable only the
 * actions the caller can actually perform, so the ~50-entry-point contract
 * surface stays navigable and role-gated rather than a wall of buttons.
 *
 * This mirrors the `require_auth` / status guards in
 * `contract/production_escrow/src/lib.rs`; it is a UX filter, not a security
 * boundary (the contract still enforces every rule).
 */

import type { CampaignStatus } from "@/types";

export type EscrowRole = "farmer" | "investor" | "buyer" | "admin" | "arbitrator";

export type CampaignAction =
  | "invest"
  | "start_production"
  | "mark_harvest"
  | "advance_milestone"
  | "settle"
  | "claim_returns"
  | "mark_campaign_failed"
  | "refund"
  | "batch_refund_investors"
  | "transfer_investment"
  | "open_dispute"
  | "resolve_dispute"
  | "vote_to_resolve";

interface Rule {
  roles: EscrowRole[];
  statuses: CampaignStatus[];
}

const RULES: Record<CampaignAction, Rule> = {
  invest: { roles: ["investor"], statuses: ["FUNDING"] },
  start_production: { roles: ["farmer"], statuses: ["FUNDED"] },
  mark_harvest: { roles: ["farmer"], statuses: ["IN_PRODUCTION"] },
  advance_milestone: {
    roles: ["buyer", "admin"],
    statuses: ["FUNDED", "IN_PRODUCTION", "HARVESTED"],
  },
  settle: { roles: ["farmer", "admin"], statuses: ["HARVESTED"] },
  claim_returns: { roles: ["investor"], statuses: ["SETTLED"] },
  mark_campaign_failed: {
    roles: ["farmer", "admin"],
    statuses: ["FUNDED", "IN_PRODUCTION", "HARVESTED"],
  },
  refund: { roles: ["investor"], statuses: ["FAILED"] },
  batch_refund_investors: { roles: ["admin"], statuses: ["FAILED"] },
  transfer_investment: {
    roles: ["investor"],
    statuses: ["FUNDING", "FUNDED", "IN_PRODUCTION", "HARVESTED", "DISPUTED"],
  },
  open_dispute: {
    roles: ["farmer", "investor", "admin"],
    statuses: ["FUNDED", "IN_PRODUCTION", "HARVESTED"],
  },
  resolve_dispute: { roles: ["admin"], statuses: ["DISPUTED"] },
  vote_to_resolve: { roles: ["arbitrator"], statuses: ["DISPUTED"] },
};

export function canPerformCampaignAction(
  action: CampaignAction,
  role: EscrowRole,
  status: CampaignStatus,
): boolean {
  const rule = RULES[action];
  return rule.roles.includes(role) && rule.statuses.includes(status);
}

/** All actions the caller can take right now, for rendering an action menu. */
export function availableCampaignActions(
  role: EscrowRole,
  status: CampaignStatus,
): CampaignAction[] {
  return (Object.keys(RULES) as CampaignAction[]).filter((action) =>
    canPerformCampaignAction(action, role, status),
  );
}
