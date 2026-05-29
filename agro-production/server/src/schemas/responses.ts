import { z } from "zod";
import {
  campaignStatusEnum,
  orderStatusEnum,
  stellarAddress,
  uuidParam,
} from "./common.js";

/** Accepts ISO strings or Date instances from Prisma. */
const dateField = z.union([
  z.string().datetime(),
  z.date().transform((d) => d.toISOString()),
]);

const timestamps = {
  createdAt: dateField,
  updatedAt: dateField,
};

export const CampaignSchema = z.object({
  id: uuidParam,
  onChainId: z.string(),
  farmerAddress: stellarAddress,
  tokenAddress: stellarAddress,
  targetAmount: z.string(),
  totalRaised: z.string(),
  totalRevenue: z.string(),
  trancheReleased: z.string().optional(),
  deadline: dateField,
  status: campaignStatusEnum,
  ...timestamps,
});

export const CampaignSummarySchema = CampaignSchema.extend({
  _count: z
    .object({
      investments: z.number().int(),
      orders: z.number().int(),
    })
    .optional(),
});

export const CampaignListResponseSchema = z.object({
  data: z.array(CampaignSummarySchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  }),
});

export const CampaignDetailSchema = CampaignSchema.extend({
  investments: z.array(z.lazy(() => InvestmentSchema)).optional(),
  orders: z.array(z.lazy(() => OrderSchema)).optional(),
});

export const InvestmentSchema = z.object({
  id: uuidParam,
  campaignId: uuidParam,
  investorAddress: stellarAddress,
  amount: z.string(),
  ledger: z.number().int(),
  txHash: z.string().nullable().optional(),
  createdAt: dateField,
  campaign: CampaignSchema.pick({
    id: true,
    onChainId: true,
    farmerAddress: true,
    tokenAddress: true,
    targetAmount: true,
    totalRaised: true,
    totalRevenue: true,
    status: true,
    deadline: true,
  }).optional(),
});

export const OrderSchema = z.object({
  id: uuidParam,
  onChainId: z.string(),
  campaignId: uuidParam,
  buyerAddress: stellarAddress,
  amount: z.string(),
  status: orderStatusEnum,
  ledger: z.number().int(),
  txHash: z.string().nullable().optional(),
  createdAt: dateField,
  updatedAt: dateField,
  campaign: z
    .object({
      farmerAddress: stellarAddress,
      tokenAddress: stellarAddress,
      onChainId: z.string(),
    })
    .optional(),
});

export const ValidationErrorSchema = z.object({
  type: z.string().url(),
  title: z.literal("Validation Failed"),
  status: z.literal(400),
  instance: z.string(),
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      code: z.string(),
    }),
  ),
});

export const ProblemDetailSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});
