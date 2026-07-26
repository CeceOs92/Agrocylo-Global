import { Router } from "express";
import multer from "multer";
import { DisputeController } from "../controllers/disputeController.js";
import { EvidenceController } from "../controllers/evidenceController.js";
import { requireWallet } from "../middleware/walletAuth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route GET /disputes
 * @desc Retrieve disputes scoped to the authenticated wallet
 */
router.get("/", requireWallet, DisputeController.getAllDisputes);

/**
 * @route GET /disputes/:order_id
 * @desc Retrieve a single dispute by its on-chain order ID
 */
router.get("/:order_id", requireWallet, DisputeController.getDisputeByOrderId);

/**
 * @route POST /disputes/:order_id/evidence
 * @desc Upload evidence for a dispute (participants only, OPEN disputes only)
 */
router.post("/:order_id/evidence", requireWallet, upload.single("file"), EvidenceController.uploadEvidence);

export default router;
