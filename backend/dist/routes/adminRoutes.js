"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController = __importStar(require("../controllers/adminController"));
const adminAuthMiddleware_1 = __importDefault(require("../middleware/adminAuthMiddleware"));
const validateMiddleware_1 = __importDefault(require("../middleware/validateMiddleware"));
const schemas = __importStar(require("../validations/schemas"));
const authController = __importStar(require("../controllers/authController"));
const router = express_1.default.Router();
// Public admin login endpoint
router.post("/login", (0, validateMiddleware_1.default)(schemas.adminLoginSchema), authController.adminLogin);
// Dashboard Summary (ADMIN & SUPER_ADMIN)
router.get("/dashboard-stats", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getDashboardStats);
// Settings Endpoints
router.get("/settings", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.listSettings);
router.get("/settings/:key", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getSingleSetting);
router.put("/settings/:key", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.updateSettingValue);
router.put("/categories/:category/margin", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.updateCategoryMarginReq);
// Operational & Reports Endpoints (ADMIN & SUPER_ADMIN)
router.get("/reports/reconciliation", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getReconciliationReport);
router.get("/reports/withdrawals", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getPendingWithdrawalsReport);
router.get("/reports/tds-summary", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getTdsSummaryReport);
router.get("/reports/settlements", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getSettlementsReport);
router.post("/withdrawals/:id/approve", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.approveWithdrawalReq);
router.post("/withdrawals/:id/reject", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.rejectWithdrawalReq);
router.post("/settlements/run", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.runSettlement);
router.post("/vendors/:id/penalize", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.penalizeVendorReq);
router.post("/vendors/:id/freeze", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.freezeVendorReq);
// Member KYC Operations
router.get("/members/kyc-pending", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.getPendingKyc);
router.post("/members/:id/kyc/approve", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.approveKyc);
router.post("/members/:id/kyc/reject", (0, adminAuthMiddleware_1.default)(["ADMIN", "SUPER_ADMIN"]), adminController.rejectKyc);
// SUPER_ADMIN Exclusives: Audit Logs & Admin User Management
router.get("/audit-logs", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN"]), adminController.getLogs);
router.get("/users", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN"]), adminController.listAdminUsers);
router.post("/users", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN"]), adminController.createAdminUser);
router.put("/users/:id/role", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN"]), adminController.updateAdminUserRole);
exports.default = router;
