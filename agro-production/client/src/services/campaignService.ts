import type { Campaign, CampaignDetail, CampaignListResponse } from "@/types";
import api from "../lib/apiClient";

export async function fetchCampaigns(params?: {
  status?: string;
  farmerAddress?: string;
  page?: number;
  limit?: number;
}): Promise<CampaignListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.farmerAddress) query.set("farmerAddress", params.farmerAddress);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  return api.get<CampaignListResponse>(`/campaigns?${query}`);
}

export async function fetchCampaign(id: string): Promise<CampaignDetail> {
  return api.get<CampaignDetail>(`/campaigns/${id}`);
}

export function fundingProgress(campaign: Pick<Campaign, "totalRaised" | "targetAmount">): number {
  const raised = BigInt(campaign.totalRaised || "0");
  const target = BigInt(campaign.targetAmount || "1");
  if (target === 0n) return 0;
  const pct = Number((raised * 100n) / target);
  return Math.min(pct, 100);
}

export function formatAmount(raw: string): string {
  const n = BigInt(raw || "0");
  const xlm = Number(n) / 1e7;
  return xlm.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
