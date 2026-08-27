import express from "express";
import * as memberController from "../controllers/memberController";
import authMiddleware from "../middleware/authMiddleware";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";

const router = express.Router();

// Apply authMiddleware to all member routes
router.use(authMiddleware as any);

router.get("/profile", memberController.getProfile);
router.get("/autopool-tree", memberController.getAutoPoolTree);
router.get("/autopool-explorer", memberController.getAutoPoolExplorer);
router.get("/my-system-tree", memberController.getMySystemTree);
router.put("/kyc", validate(schemas.kycSchema), memberController.updateKyc);
router.get("/check-availability", memberController.checkAvailability);
router.get("/my-placement", memberController.getMyPlacement);
router.get("/my-referrals", memberController.getMyReferralCount);
router.get("/my-referral-count", memberController.getMyReferralCount);
router.get("/notifications", memberController.getNotifications);

export default router;
