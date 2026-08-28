import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db/client.js";
import { runProductionReconciliation, reconcileSingleCampaign } from "../services/reconciliationService.js";
import logger from "../config/logger.js";

const router = Router();

// Admin check helper — mirrors the pattern in disputes.ts
async function requireAdminWallet(req: Request, res: Response): Promise<string | null> {
  const walletAddress = req.header("x-wallet-address") ?? "";
  if (!walletAddress) {
    res.status(401).json({ message: "Missing x-wallet-address header" });
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return walletAddress;
}

// GET /api/v1/admin/reconciliation/alerts — list reconciliation alerts
router.get("/admin/reconciliation/alerts", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
    const resolved = req.query.resolved;
    const entityType = req.query.entityType as string | undefined;
    const driftType = req.query.driftType as string | undefined;

    const where: Record<string, unknown> = {};
    if (resolved === "true") where.resolvedAt = { not: null };
    if (resolved === "false") where.resolvedAt = null;
    if (entityType) where.entityType = entityType;
    if (driftType) where.driftType = driftType;

    const [alerts, total] = await Promise.all([
      prisma.reconciliationAlert.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reconciliationAlert.count({ where }),
    ]);

    res.json({
      data: alerts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error("[Admin/Reconciliation] Failed to list alerts", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/v1/admin/reconciliation/alerts/:id — get a single alert
router.get("/admin/reconciliation/alerts/:id", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const alert = await prisma.reconciliationAlert.findUnique({
      where: { id: req.params.id },
    });
    if (!alert) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }
    res.json(alert);
  } catch (err) {
    logger.error("[Admin/Reconciliation] Failed to get alert", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/v1/admin/reconciliation/alerts/:id/resolve — mark alert as resolved
router.post("/admin/reconciliation/alerts/:id/resolve", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const alert = await prisma.reconciliationAlert.findUnique({
      where: { id: req.params.id },
    });
    if (!alert) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }
    if (alert.resolvedAt) {
      res.status(409).json({ message: "Alert already resolved" });
      return;
    }

    const updated = await prisma.reconciliationAlert.update({
      where: { id: req.params.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: adminWallet,
        notes: (req.body as { notes?: string }).notes ?? null,
      },
    });

    res.json(updated);
  } catch (err) {
    logger.error("[Admin/Reconciliation] Failed to resolve alert", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/v1/admin/reconciliation/run — trigger manual reconciliation
router.post("/admin/reconciliation/run", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const report = await runProductionReconciliation();
    res.json(report);
  } catch (err) {
    logger.error("[Admin/Reconciliation] Manual run failed", err);
    res.status(500).json({ message: "Reconciliation run failed" });
  }
});

// POST /api/v1/admin/reconciliation/reconcile-campaign/:campaignId — force reconcile a campaign
router.post("/admin/reconciliation/reconcile-campaign/:campaignId", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const findings = await reconcileSingleCampaign(req.params.campaignId);
    res.json({ campaignId: req.params.campaignId, findings, driftDetected: findings.length > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found")) {
      res.status(404).json({ message });
      return;
    }
    logger.error("[Admin/Reconciliation] Force reconcile failed", err);
    res.status(500).json({ message: "Force reconcile failed" });
  }
});

// GET /api/v1/admin/reconciliation/summary — reconciliation summary stats
router.get("/admin/reconciliation/summary", async (req: Request, res: Response) => {
  const adminWallet = await requireAdminWallet(req, res);
  if (!adminWallet) return;

  try {
    const [totalAlerts, unresolvedAlerts, recentAlerts] = await Promise.all([
      prisma.reconciliationAlert.count(),
      prisma.reconciliationAlert.count({ where: { resolvedAt: null } }),
      prisma.reconciliationAlert.findMany({
        orderBy: { detectedAt: "desc" },
        take: 10,
      }),
    ]);

    const driftsByType = await prisma.reconciliationAlert.groupBy({
      by: ["driftType"],
      where: { resolvedAt: null },
      _count: { id: true },
    });

    res.json({
      totalAlerts,
      unresolvedAlerts,
      driftsByType: driftsByType.map((d) => ({
        driftType: d.driftType,
        count: d._count.id,
      })),
      recentAlerts,
    });
  } catch (err) {
    logger.error("[Admin/Reconciliation] Failed to get summary", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
