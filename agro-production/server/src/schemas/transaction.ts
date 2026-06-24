import { z } from 'zod';
import { stellarAddress, uuidParam } from './common.js';

export const TransactionRequestIdParamSchema = z.object({
  requestId: uuidParam,
});

export const TransactionIntentCreateSchema = z.object({
  requestId: uuidParam,
  txHash: z.string().min(1).max(128),
  walletAddress: stellarAddress,
  eventType: z.string().min(1).max(64).optional(),
  campaignId: uuidParam.optional(),
});

export type TransactionIntentCreate = z.infer<typeof TransactionIntentCreateSchema>;

export const TransactionStatusEnum = z.enum([
  'awaiting_signature',
  'submitted',
  'confirmed',
  'indexed',
  'failed',
]);

export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

export const TransactionStatusResponseSchema = z.object({
  requestId: uuidParam,
  txHash: z.string(),
  walletAddress: stellarAddress,
  status: TransactionStatusEnum,
  eventType: z.string().nullable().optional(),
  campaignId: uuidParam.nullable().optional(),
  ledger: z.number().int().nullable().optional(),
  message: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TransactionStatusResponse = z.infer<typeof TransactionStatusResponseSchema>;
