import type { Campaign, Investment } from "@/types";
import api from "../lib/apiClient";

export interface InvestmentWithCampaign extends Investment {
  campaign: Pick<
    Campaign,
    "id" | "onChainId" | "farmerAddress" | "tokenAddress" | "targetAmount" | "totalRaised" | "totalRevenue" | "status" | "deadline"
  >;
}

export async function fetchUserInvestments(
  investorAddress: string,
): Promise<InvestmentWithCampaign[]> {
  return api.get<InvestmentWithCampaign[]>(`/investments?investorAddress=${encodeURIComponent(investorAddress)}`);
}

export async function fetchCampaignInvestments(
  campaignId: string,
): Promise<Investment[]> {
  return api.get<Investment[]>(`/campaigns/${encodeURIComponent(campaignId)}/investments`);
}

export class InvestmentIndexingTimeoutError extends Error {
  constructor(public readonly txHash: string) {
    super("The transaction is confirmed but is still waiting to be indexed.");
    this.name = "InvestmentIndexingTimeoutError";
  }
}

const INDEXING_POLL_INTERVAL_MS = 2_000;
const INDEXING_TIMEOUT_MS = 45_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the server's Soroban indexer to project a confirmed investment.
 *
 * This intentionally performs no write. A matching on-chain transaction hash
 * is the proof of investment; the REST API remains a read model that may lag
 * the ledger by a few polling intervals.
 */
export async function waitForIndexedInvestment({
  campaignId,
  investorAddress,
  amount,
  txHash,
  timeoutMs = INDEXING_TIMEOUT_MS,
  pollIntervalMs = INDEXING_POLL_INTERVAL_MS,
}: {
  campaignId: string;
  investorAddress: string;
  amount: string;
  txHash: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<Investment> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const investments = await fetchCampaignInvestments(campaignId);
    const indexed = investments.find(
      (investment) =>
        investment.investorAddress === investorAddress &&
        investment.amount === amount &&
        investment.txHash === txHash,
    );
    if (indexed) return indexed;
    await wait(pollIntervalMs);
  }

  throw new InvestmentIndexingTimeoutError(txHash);
}

/** Claimable return = proportional share of totalRevenue minus original contribution */
export function claimableReturn(investment: InvestmentWithCampaign): bigint {
  const { campaign } = investment;
  if (campaign.status !== "SETTLED") return 0n;
  const totalRevenue = BigInt(campaign.totalRevenue || "0");
  const totalRaised = BigInt(campaign.totalRaised || "1");
  const contributed = BigInt(investment.amount || "0");
  if (totalRaised === 0n) return 0n;
  return (totalRevenue * contributed) / totalRaised;
}

export interface ClaimReturnsResult {
  success: boolean;
  txHash?: string;
  claimedAmount?: string;
  error?: string;
}

/**
 * Claim settlement returns for a campaign.
 * Builds the claim_returns transaction, signs via wallet, and submits.
 */
export async function claimReturns(
  investorAddress: string,
  campaignId: string,
  onChainCampaignId: string,
): Promise<ClaimReturnsResult> {
  try {
    const { buildClaimReturns } = await import("@/lib/contractService");
    const { signAndSubmitTransaction } = await import("@/lib/signTransaction");

    const built = await buildClaimReturns(investorAddress, onChainCampaignId);
    if (!built.success || !built.data) {
      return { success: false, error: built.error ?? "Could not build the claim transaction" };
    }

    const submitted = await signAndSubmitTransaction(built.data);
    if (!submitted.success || !submitted.txHash) {
      return { success: false, error: submitted.error ?? "Claim transaction was not confirmed on-chain" };
    }

    return { success: true, txHash: submitted.txHash };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to claim returns",
    };
  }
}
