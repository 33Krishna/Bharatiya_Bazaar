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
const idCardService = __importStar(require("../services/idCardService"));
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const router = express_1.default.Router();
// Apply auth middleware to all ID card routes
router.use(authMiddleware_1.default);
router.post("/purchase", async (req, res) => {
    try {
        const { count, sponsorIdCardId, sponsorSide } = req.body;
        const memberId = req.member?.id;
        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (!count || count < 1) {
            return res.status(400).json({
                success: false,
                message: "count (minimum 1) is required"
            });
        }
        // Validate sponsor side if provided
        if (sponsorIdCardId && !["LEFT", "RIGHT"].includes(sponsorSide)) {
            return res.status(400).json({
                success: false,
                message: "sponsorSide must be LEFT or RIGHT when sponsorIdCardId is provided"
            });
        }
        const cards = await idCardService.purchaseIds(memberId, count, sponsorIdCardId || null, sponsorSide || null);
        res.status(201).json({
            success: true,
            message: `Successfully purchased ${cards.length} ID(s)`,
            data: cards
        });
    }
    catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message
        });
    }
});
router.get("/my-cards", async (req, res) => {
    try {
        const memberId = req.member?.id;
        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const cards = await MemberIdCard_1.MemberIdCard.find({ memberId })
            .populate("mySystemNode")
            .populate("autoPoolNode")
            .sort({ createdAt: 1 })
            .exec();
        res.json({
            success: true,
            data: cards
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
router.get("/commissions", async (req, res) => {
    try {
        const memberId = req.member?.id;
        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const cards = await MemberIdCard_1.MemberIdCard.find({ memberId }).select("_id cardNumber type").exec();
        const cardIds = cards.map(c => c._id);
        const commissions = await CommissionEntry_1.CommissionEntry.find({ idCardId: { $in: cardIds } })
            .sort({ createdAt: -1 })
            .exec();
        const cardMap = {};
        cards.forEach(c => {
            cardMap[c.id.toString()] = { cardNumber: c.cardNumber, type: c.type };
        });
        const enriched = commissions.map(c => {
            const cardInfo = cardMap[c.idCardId.toString()];
            return {
                ...c.toObject(),
                idCard: cardInfo ? { cardNumber: cardInfo.cardNumber, type: cardInfo.type } : null
            };
        });
        res.json({
            success: true,
            data: enriched
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
router.get("/tree/:memberId", async (req, res) => {
    try {
        const { memberId } = req.params;
        const idCards = await MemberIdCard_1.MemberIdCard.find({ memberId })
            .populate("mySystemNode")
            .populate("autoPoolNode")
            .exec();
        res.json({
            success: true,
            data: idCards
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
router.post("/purchase-additional", async (req, res) => {
    try {
        const requested = parseInt(req.body && req.body.count, 10) || 1;
        const count = Math.min(Math.max(requested, 1), 10);
        const memberId = req.member?.id;
        if (!memberId) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Please log in to purchase IDs" }
            });
        }
        const mainCard = await MemberIdCard_1.MemberIdCard.findOne({ memberId, type: "MAIN" }).exec();
        if (!mainCard) {
            return res.status(400).json({
                success: false,
                error: { code: "NO_MAIN_ID", message: "Please activate your membership (MAIN ID) first." }
            });
        }
        await idCardService.purchaseIds(memberId, count, null, null);
        const newCards = await MemberIdCard_1.MemberIdCard.find({ memberId })
            .sort({ createdAt: -1 })
            .limit(count)
            .populate({
            path: "mySystemNode",
            populate: {
                path: "parentNodeId",
                populate: {
                    path: "idCardId",
                    select: "cardNumber"
                }
            }
        })
            .populate("autoPoolNode")
            .exec();
        res.json({
            success: true,
            data: {
                purchased: newCards.length,
                cards: newCards.map((c) => ({
                    cardNumber: c.cardNumber,
                    type: c.type,
                    placedUnder: c.mySystemNode && c.mySystemNode.parentNodeId ? c.mySystemNode.parentNodeId.idCardId?.cardNumber : "ROOT",
                    side: c.mySystemNode ? c.mySystemNode.side : null,
                    poolPosition: c.autoPoolNode ? c.autoPoolNode.globalPosition : null
                }))
            }
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: { code: "PURCHASE_FAILED", message: err.message }
        });
    }
});
exports.default = router;
