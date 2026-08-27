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
const memberController = __importStar(require("../controllers/memberController"));
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const validateMiddleware_1 = __importDefault(require("../middleware/validateMiddleware"));
const schemas = __importStar(require("../validations/schemas"));
const router = express_1.default.Router();
// Apply authMiddleware to all member routes
router.use(authMiddleware_1.default);
router.get("/profile", memberController.getProfile);
router.get("/autopool-tree", memberController.getAutoPoolTree);
router.get("/autopool-explorer", memberController.getAutoPoolExplorer);
router.get("/my-system-tree", memberController.getMySystemTree);
router.put("/kyc", (0, validateMiddleware_1.default)(schemas.kycSchema), memberController.updateKyc);
router.get("/check-availability", memberController.checkAvailability);
router.get("/my-placement", memberController.getMyPlacement);
router.get("/my-referrals", memberController.getMyReferralCount);
router.get("/my-referral-count", memberController.getMyReferralCount);
router.get("/notifications", memberController.getNotifications);
exports.default = router;
