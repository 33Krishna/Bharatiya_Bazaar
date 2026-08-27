import express from "express";
import * as adminController from "../controllers/adminController";
import requireAdmin from "../middleware/adminAuthMiddleware";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";
import * as authController from "../controllers/authController";

const router = express.Router();

// Public admin login endpoint
router.post("/login", validate(schemas.adminLoginSchema), authController.adminLogin);

// Dashboard Summary (ADMIN & SUPER_ADMIN)
router.get("/dashboard-stats", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getDashboardStats);

// Settings Endpoints
router.get("/settings", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.listSettings);
router.get("/settings/:key", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getSingleSetting);
router.put("/settings/:key", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.updateSettingValue);
router.put("/categories/:category/margin", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.updateCategoryMarginReq);

// Operational & Reports Endpoints (ADMIN & SUPER_ADMIN)
router.get("/reports/reconciliation", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getReconciliationReport);
router.get("/reports/withdrawals", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getPendingWithdrawalsReport);
router.get("/reports/tds-summary", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getTdsSummaryReport);
router.get("/reports/settlements", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getSettlementsReport);

router.post("/withdrawals/:id/approve", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.approveWithdrawalReq);
router.post("/withdrawals/:id/reject", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.rejectWithdrawalReq);

router.post("/settlements/run", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.runSettlement);
router.post("/vendors/:id/penalize", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.penalizeVendorReq);
router.post("/vendors/:id/freeze", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.freezeVendorReq);

// Member KYC Operations
router.get("/members/kyc-pending", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.getPendingKyc);
router.post("/members/:id/kyc/approve", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.approveKyc);
router.post("/members/:id/kyc/reject", requireAdmin(["ADMIN", "SUPER_ADMIN"]), adminController.rejectKyc);

// SUPER_ADMIN Exclusives: Audit Logs & Admin User Management
router.get("/audit-logs", requireAdmin(["SUPER_ADMIN"]), adminController.getLogs);
router.get("/users", requireAdmin(["SUPER_ADMIN"]), adminController.listAdminUsers);
router.post("/users", requireAdmin(["SUPER_ADMIN"]), adminController.createAdminUser);
router.put("/users/:id/role", requireAdmin(["SUPER_ADMIN"]), adminController.updateAdminUserRole);

export default router;
