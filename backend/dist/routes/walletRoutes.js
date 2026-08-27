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
const walletController = __importStar(require("../controllers/walletController"));
const withdrawalController = __importStar(require("../controllers/withdrawalController"));
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const adminAuthMiddleware_1 = __importDefault(require("../middleware/adminAuthMiddleware"));
const validateMiddleware_1 = __importDefault(require("../middleware/validateMiddleware"));
const schemas = __importStar(require("../validations/schemas"));
const router = express_1.default.Router();
// Member Wallet Endpoints
router.get("/balance", authMiddleware_1.default, walletController.getBalance);
router.get("/summary", authMiddleware_1.default, walletController.getBalance);
router.get("/ledger", authMiddleware_1.default, walletController.getLedger);
router.get("/commissions", authMiddleware_1.default, walletController.getCommissions);
router.post("/withdraw", authMiddleware_1.default, (0, validateMiddleware_1.default)(schemas.withdrawalRequestSchema), withdrawalController.request);
router.get("/withdrawals", authMiddleware_1.default, withdrawalController.getHistory);
router.get("/withdraw/preview", authMiddleware_1.default, withdrawalController.getTdsPreview);
// Admin Approval & Rejection on Wallet Route
router.post("/withdraw/complete", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN", "ADMIN"]), withdrawalController.complete);
router.post("/withdraw/reject", (0, adminAuthMiddleware_1.default)(["SUPER_ADMIN", "ADMIN"]), withdrawalController.reject);
exports.default = router;
