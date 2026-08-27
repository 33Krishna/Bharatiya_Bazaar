import express from "express";
import * as withdrawalController from "../controllers/withdrawalController";
import authMiddleware from "../middleware/authMiddleware";
import requireAdmin from "../middleware/adminAuthMiddleware";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";
import optionalAuthMiddleware from "../middleware/optionalAuthMiddleware";

const router = express.Router();

// Member Endpoints
router.post("/request", authMiddleware as any, validate(schemas.withdrawalRequestSchema), withdrawalController.request);
router.get("/history", authMiddleware as any, withdrawalController.getHistory);
router.get("/tds-preview", optionalAuthMiddleware as any, withdrawalController.getTdsPreview);

// Admin Approval & Rejection Endpoints
router.post("/:id/complete", requireAdmin(["SUPER_ADMIN", "ADMIN"]), withdrawalController.complete);
router.post("/:id/approve", requireAdmin(["SUPER_ADMIN", "ADMIN"]), withdrawalController.complete);
router.post("/:id/reject", requireAdmin(["SUPER_ADMIN", "ADMIN"]), withdrawalController.reject);

export default router;
