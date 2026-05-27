import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  CampaignIdParamSchema,
  CreateCampaignSchema,
  InvestSchema,
  ListCampaignsQuerySchema,
  ListInvestmentsQuerySchema,
} from "../schemas/campaign.js";
import {
  CampaignImageParamSchema,
  CampaignImageUploadResponseSchema,
} from "../schemas/campaignImage.js";
import { HealthResponseSchema } from "../schemas/health.js";
import {
  ConfirmOrderSchema,
  CreateOrderSchema,
  ListOrdersQuerySchema,
  OrderIdParamSchema,
} from "../schemas/order.js";
import {
  CampaignDetailSchema,
  CampaignListResponseSchema,
  CampaignSchema,
  InvestmentSchema,
  OrderSchema,
  ProblemDetailSchema,
  ValidationErrorSchema,
} from "../schemas/responses.js";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const problemResponse = {
  description: "RFC 7807 problem detail",
  content: { "application/problem+json": { schema: ProblemDetailSchema } },
};

const validationResponse = {
  description: "Request validation failed",
  content: { "application/problem+json": { schema: ValidationErrorSchema } },
};

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Service health check",
  responses: {
    200: {
      description: "Service is running",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/campaigns",
  tags: ["Campaigns"],
  summary: "List campaigns",
  request: { query: ListCampaignsQuerySchema },
  responses: {
    200: {
      description: "Paginated campaign list",
      content: { "application/json": { schema: CampaignListResponseSchema } },
    },
    400: validationResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/campaigns/{id}",
  tags: ["Campaigns"],
  summary: "Get campaign by ID",
  request: { params: CampaignIdParamSchema },
  responses: {
    200: {
      description: "Campaign detail",
      content: { "application/json": { schema: CampaignDetailSchema } },
    },
    400: validationResponse,
    404: problemResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/campaigns",
  tags: ["Campaigns"],
  summary: "Create campaign metadata",
  request: { body: { content: { "application/json": { schema: CreateCampaignSchema } } } },
  responses: {
    201: {
      description: "Campaign created",
      content: { "application/json": { schema: CampaignSchema } },
    },
    400: validationResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/campaigns/{id}/investments",
  tags: ["Investments"],
  summary: "List investments for a campaign",
  request: { params: CampaignIdParamSchema },
  responses: {
    200: {
      description: "Investment list",
      content: { "application/json": { schema: z.array(InvestmentSchema) } },
    },
    400: validationResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/investments",
  tags: ["Investments"],
  summary: "List investments for an investor",
  request: { query: ListInvestmentsQuerySchema },
  responses: {
    200: {
      description: "Investment list",
      content: { "application/json": { schema: z.array(InvestmentSchema) } },
    },
    400: validationResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/campaigns/{id}/invest",
  tags: ["Investments"],
  summary: "Record an investment",
  request: {
    params: CampaignIdParamSchema,
    body: { content: { "application/json": { schema: InvestSchema } } },
  },
  responses: {
    201: {
      description: "Investment recorded",
      content: { "application/json": { schema: InvestmentSchema } },
    },
    400: validationResponse,
    404: problemResponse,
    409: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orders",
  tags: ["Orders"],
  summary: "List orders by buyer or farmer",
  request: { query: ListOrdersQuerySchema },
  responses: {
    200: {
      description: "Order list",
      content: { "application/json": { schema: z.array(OrderSchema) } },
    },
    400: validationResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders",
  tags: ["Orders"],
  summary: "Create order",
  request: { body: { content: { "application/json": { schema: CreateOrderSchema } } } },
  responses: {
    201: {
      description: "Order created",
      content: { "application/json": { schema: OrderSchema } },
    },
    400: validationResponse,
    404: problemResponse,
    409: problemResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orders/{id}",
  tags: ["Orders"],
  summary: "Get order by ID",
  request: { params: OrderIdParamSchema },
  responses: {
    200: {
      description: "Order detail",
      content: { "application/json": { schema: OrderSchema } },
    },
    400: validationResponse,
    404: problemResponse,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orders/{id}/confirm",
  tags: ["Orders"],
  summary: "Confirm order delivery",
  request: {
    params: OrderIdParamSchema,
    body: { content: { "application/json": { schema: ConfirmOrderSchema } } },
  },
  responses: {
    200: {
      description: "Order confirmed",
      content: { "application/json": { schema: OrderSchema } },
    },
    400: validationResponse,
    403: problemResponse,
    404: problemResponse,
    409: problemResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/campaigns/{campaign_id}/image",
  tags: ["Campaign Images"],
  summary: "Upload campaign image",
  request: {
    params: CampaignImageParamSchema,
    headers: z.object({
      "x-wallet-address": z.string().openapi({ description: "Farmer Stellar wallet" }),
    }),
  },
  responses: {
    200: {
      description: "Image uploaded",
      content: { "application/json": { schema: CampaignImageUploadResponseSchema } },
    },
    400: validationResponse,
    401: problemResponse,
    415: problemResponse,
  },
});

registry.registerPath({
  method: "delete",
  path: "/campaigns/{campaign_id}/image",
  tags: ["Campaign Images"],
  summary: "Delete campaign image",
  request: {
    params: CampaignImageParamSchema,
    headers: z.object({
      "x-wallet-address": z.string().openapi({ description: "Farmer Stellar wallet" }),
    }),
  },
  responses: {
    204: { description: "Image deleted" },
    400: validationResponse,
    401: problemResponse,
  },
});
