import { Router, type Request, type Response } from "express";
import { prisma } from "../db/client.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  CampaignIdParamSchema,
  CreateCampaignSchema,
  InvestSchema,
  ListCampaignsQuerySchema,
  type CreateCampaignInput,
  type InvestInput,
  type ListCampaignsQuery,
} from "../schemas/campaign.js";
import { broadcast } from "../services/wsServer.js";
import { problemDetail } from "../middleware/errors.js";

const router = Router();

// GET /campaigns — list with optional status filter and pagination
router.get(
  "/campaigns",
  validateQuery(ListCampaignsQuerySchema),
  async (req: Request, res: Response) => {
    const { status, farmerAddress, page, limit } = req.query as unknown as ListCampaignsQuery;

    const where = {
      ...(status ? { status } : {}),
      ...(farmerAddress ? { farmerAddress } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { investments: true, orders: true } } },
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ data: items, meta: { total, page, limit } });
  },
);

// GET /campaigns/:id — campaign detail with investments
router.get(
  "/campaigns/:id",
  validateParams(CampaignIdParamSchema),
  async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        investments: { orderBy: { createdAt: "desc" } },
        orders: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!campaign) {
      problemDetail(res, req, 404, "Campaign Not Found", `No campaign with id ${req.params.id}`);
      return;
    }

    res.json(campaign);
  },
);

// POST /campaigns — register a newly-created campaign (for off-chain metadata)
router.post(
  "/campaigns",
  writeLimiter,
  validateBody(CreateCampaignSchema),
  async (req: Request, res: Response) => {
    const { farmerAddress, tokenAddress, targetAmount, deadline } =
      req.body as CreateCampaignInput;

    await prisma.user.upsert({
      where: { walletAddress: farmerAddress },
      create: { walletAddress: farmerAddress, role: "FARMER" },
      update: {},
    });

    const campaign = await prisma.campaign.create({
      data: {
        onChainId: "pending",
        farmerAddress,
        tokenAddress,
        targetAmount,
        deadline: new Date(deadline),
      },
    });

    broadcast("campaign.created", campaign);

    res.status(201).json(campaign);
  },
);

// GET /campaigns/:id/investments — investments for a campaign
router.get(
  "/campaigns/:id/investments",
  validateParams(CampaignIdParamSchema),
  async (req: Request, res: Response) => {
    const investments = await prisma.investment.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(investments);
  },
);

// GET /investments?investorAddress=... — all investments for a user
router.get("/investments", async (req: Request, res: Response) => {
  const { investorAddress } = req.query;
  if (!investorAddress || typeof investorAddress !== "string") {
    problemDetail(
      res,
      req,
      400,
      "Missing Query Parameter",
      "investorAddress query param is required",
    );
    return;
  }

  const investments = await prisma.investment.findMany({
    where: { investorAddress },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        select: {
          id: true,
          onChainId: true,
          farmerAddress: true,
          tokenAddress: true,
          targetAmount: true,
          totalRaised: true,
          totalRevenue: true,
          status: true,
          deadline: true,
        },
      },
    },
  });

  res.json(investments);
});

// POST /campaigns/:id/invest — record an investment (indexer shortcut)
router.post(
  "/campaigns/:id/invest",
  writeLimiter,
  validateParams(CampaignIdParamSchema),
  validateBody(InvestSchema),
  async (req: Request, res: Response) => {
    const { investorAddress, amount } = req.body as InvestInput;

    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) {
      problemDetail(res, req, 404, "Campaign Not Found", `No campaign with id ${req.params.id}`);
      return;
    }
    if (campaign.status !== "FUNDING") {
      problemDetail(
        res,
        req,
        409,
        "Campaign Not Accepting Investments",
        `Campaign status is ${campaign.status}`,
      );
      return;
    }

    await prisma.user.upsert({
      where: { walletAddress: investorAddress },
      create: { walletAddress: investorAddress, role: "INVESTOR" },
      update: {},
    });

    const investment = await prisma.investment.create({
      data: {
        campaignId: campaign.id,
        investorAddress,
        amount,
        ledger: 0, // will be updated by indexer
      },
    });

    broadcast("campaign.invested", {
      campaignId: campaign.id,
      investorAddress,
      amount,
      totalRaised: campaign.totalRaised,
    });

    res.status(201).json(investment);
  },
);

export default router;
