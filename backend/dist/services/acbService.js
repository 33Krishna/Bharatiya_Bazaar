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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAcbStatus = checkAcbStatus;
exports.unlockAcb = unlockAcb;
exports.unlockLockedEarnings = unlockLockedEarnings;
const MySystemNode_1 = require("../models/MySystemNode");
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
const walletService = __importStar(require("./walletService"));
async function checkAcbStatus(idCardId, options = {}) {
    // Query nodes directly sponsored by this ID card (direct referrals)
    const sponsoredNodes = await MySystemNode_1.MySystemNode.find({ sponsorIdCardId: idCardId })
        .session(options.session || null)
        .exec();
    if (sponsoredNodes.length === 0) {
        return false;
    }
    const hasLeft = sponsoredNodes.some(n => n.side === "LEFT");
    const hasRight = sponsoredNodes.some(n => n.side === "RIGHT");
    return hasLeft && hasRight;
}
async function unlockAcb(idCardId, options = {}) {
    await MemberIdCard_1.MemberIdCard.findByIdAndUpdate(idCardId, {
        acbStatus: true,
        acbUnlockedAt: new Date(),
    }, { session: options.session }).exec();
}
async function unlockLockedEarnings(idCardId, options = {}) {
    // Find all locked commissions for this ID
    const lockedCommissions = await CommissionEntry_1.CommissionEntry.find({
        idCardId,
        status: "LOCKED_ACB"
    }).session(options.session || null).exec();
    if (lockedCommissions.length === 0)
        return;
    const idCard = await MemberIdCard_1.MemberIdCard.findById(idCardId).session(options.session || null).exec();
    if (!idCard)
        return;
    for (const commission of lockedCommissions) {
        // 1. Update commission to WITHDRAWABLE
        commission.status = "WITHDRAWABLE";
        if (options.session) {
            commission.$session(options.session);
        }
        await commission.save();
        // 2. Credit wallet
        await walletService.credit(idCard.memberId, commission.amountPaise, commission.stream, commission.id, `ACB Unlocked ${commission.stream} Level ${commission.level}`, { session: options.session });
    }
}
