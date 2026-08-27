import express from "express";
import * as walletController from "../controllers/walletController";
import * as withdrawalController from "../controllers/withdrawalController";
import authMiddleware from "../middleware/authMiddleware";
import requireAdmin from "../middleware/adminAuthMiddleware";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";

const router = express.Router();

// Member Wallet Endpoints
router.get("/balance", authMiddleware as any, walletController.getBalance);
router.get("/summary", authMiddleware as any, walletController.getBalance);
router.get("/ledger", authMiddleware as any, walletController.getLedger);
router.get("/commissions", authMiddleware as any, walletController.getCommissions);
router.post("/withdraw", authMiddleware as any, validate(schemas.withdrawalRequestSchema), withdrawalController.request);
router.get("/withdrawals", authMiddleware as any, withdrawalController.getHistory);
router.get("/withdraw/preview", authMiddleware as any, withdrawalController.getTdsPreview);

// Admin Approval & Rejection on Wallet Route
router.post("/withdraw/complete", requireAdmin(["SUPER_ADMIN", "ADMIN"]), withdrawalController.complete);
router.post("/withdraw/reject", requireAdmin(["SUPER_ADMIN", "ADMIN"]), withdrawalController.reject);

export default router;
