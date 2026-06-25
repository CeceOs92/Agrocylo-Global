import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import {
  jsonValidated,
  validateBody,
  validateParams,
  validateQuery,
  validateResponse,
} from "../middleware/validate.js";
import { problemDetail } from "../middleware/errors.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { requireWallet, type WalletRequest } from "../middleware/walletAuth.js";

const router = Router();

// Schema definitions
const ProductIdParamSchema = z.object({
  id: z.string().uuid(),
});

const ListProductsQuerySchema = z.object({
  category: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  priceMin: z.coerce.bigint().optional(),
  priceMax: z.coerce.bigint().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().url().optional(),
  priceTokens: z.coerce.bigint().positive(),
  campaignId: z.string().uuid().optional(),
  inventoryCount: z.coerce.number().int().nonnegative(),
  category: z.string().min(1),
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  priceTokens: z.coerce.bigint().positive().optional(),
  inventoryCount: z.coerce.number().int().nonnegative().optional(),
  category: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// Response schemas
const ProductResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  priceTokens: z.bigint(),
  campaignId: z.string().uuid().nullable(),
  inventoryCount: z.number().int(),
  category: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductDetailResponseSchema = ProductResponseSchema.extend({
  campaign: z.object({
    id: z.string().uuid(),
    onChainId: z.string(),
    farmerAddress: z.string(),
    status: z.string(),
  }).nullable(),
});

const ProductListResponseSchema = z.object({
  data: z.array(ProductResponseSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
});

type CreateProductInput = z.infer<typeof CreateProductSchema>;
type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

// GET /products — paginated list with filters
router.get(
  "/products",
  validateQuery(ListProductsQuerySchema),
  validateResponse(ProductListResponseSchema),
  async (req: Request, res: Response) => {
    const { category, campaignId, isActive, priceMin, priceMax, page, limit } =
      req.query as unknown as ListProductsQuery;

    const where: any = {};
    if (category) where.category = category;
    if (campaignId) where.campaignId = campaignId;
    if (isActive !== undefined) where.isActive = isActive;
    if (priceMin !== undefined) where.priceTokens = { gte: priceMin };
    if (priceMax !== undefined) {
      where.priceTokens = { ...where.priceTokens, lte: priceMax };
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    jsonValidated(res, ProductListResponseSchema, 200, {
      data: items,
      meta: { total, page, limit },
    });
  },
);

// GET /products/:id — product detail with campaign summary
router.get(
  "/products/:id",
  validateParams(ProductIdParamSchema),
  validateResponse(ProductDetailResponseSchema),
  async (req: Request, res: Response) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: {
          select: {
            id: true,
            onChainId: true,
            farmerAddress: true,
            status: true,
          },
        },
      },
    });

    if (!product) {
      problemDetail(res, req, 404, "Product Not Found", `No product with id ${req.params.id}`);
      return;
    }

    jsonValidated(res, ProductDetailResponseSchema, 200, {
      ...product,
      campaign: product.campaign || null,
    });
  },
);

// POST /products — create product (farmer-authorized)
router.post(
  "/products",
  writeLimiter,
  requireWallet,
  validateBody(CreateProductSchema),
  validateResponse(ProductResponseSchema),
  async (req: WalletRequest, res: Response) => {
    const { name, description, imageUrl, priceTokens, campaignId, inventoryCount, category } =
      req.body as CreateProductInput;

    // Check if user is a farmer
    const user = await prisma.user.findUnique({
      where: { walletAddress: req.walletAddress! },
    });

    if (!user || user.role !== "FARMER") {
      problemDetail(res, req, 403, "Forbidden", "Only farmers can create products");
      return;
    }

    // If campaignId is provided, verify farmer owns it
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        problemDetail(res, req, 404, "Campaign Not Found", `No campaign with id ${campaignId}`);
        return;
      }

      if (campaign.farmerAddress !== req.walletAddress) {
        problemDetail(
          res,
          req,
          403,
          "Forbidden",
          "You do not own this campaign",
        );
        return;
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        imageUrl: imageUrl || null,
        priceTokens,
        campaignId: campaignId || null,
        inventoryCount,
        category,
      },
    });

    jsonValidated(res, ProductResponseSchema, 201, product);
  },
);

// PATCH /products/:id — update product (farmer-authorized)
router.patch(
  "/products/:id",
  writeLimiter,
  requireWallet,
  validateParams(ProductIdParamSchema),
  validateBody(UpdateProductSchema),
  validateResponse(ProductResponseSchema),
  async (req: WalletRequest, res: Response) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { farmerAddress: true } } },
    });

    if (!product) {
      problemDetail(res, req, 404, "Product Not Found", `No product with id ${req.params.id}`);
      return;
    }

    // Check if user owns the product's campaign (if one exists) or is an admin
    const user = await prisma.user.findUnique({
      where: { walletAddress: req.walletAddress! },
    });

    if (product.campaign && product.campaign.farmerAddress !== req.walletAddress) {
      problemDetail(res, req, 403, "Forbidden", "You do not own this product");
      return;
    }

    if (!product.campaign && user?.role !== "FARMER") {
      problemDetail(res, req, 403, "Forbidden", "Only the farmer who created this product can update it");
      return;
    }

    const updates = { ...req.body as UpdateProductInput };
    // Handle empty string for imageUrl as null
    if (updates.imageUrl === "") {
      updates.imageUrl = undefined;
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: updates,
    });

    jsonValidated(res, ProductResponseSchema, 200, updated);
  },
);

export default router;
