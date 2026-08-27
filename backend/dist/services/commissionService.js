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
exports.checkAutoPoolLevelCompletion = checkAutoPoolLevelCompletion;
exports.checkMySystemLevelCompletion = checkMySystemLevelCompletion;
exports.calculateAndCreateCommissions = calculateAndCreateCommissions;
const AutoPoolNode_1 = require("../models/AutoPoolNode");
const MySystemNode_1 = require("../models/MySystemNode");
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
const payOnceService = __importStar(require("./payOnceService"));
const walletService = __importStar(require("./walletService"));
const adminService = __importStar(require("./adminService"));
const L_AMOUNTS = {
    1: 30000, // Rs. 300
    2: 30000, // Rs. 300
    3: 20000 // Rs. 200
};
// AutoPool logic
async function checkAutoPoolLevelCompletion(newGlobalPosition, options = {}) {
    for (let L = 1; L <= 7; L++) {
        const numerator = newGlobalPosition + 1 - Math.pow(2, L);
        const denominator = Math.pow(2, L);
        if (numerator % denominator === 0) {
            const ancestorPos = numerator / denominator;
            if (ancestorPos >= 1) {
                const ancestorNode = await AutoPoolNode_1.AutoPoolNode.findOne({ globalPosition: ancestorPos })
                    .session(options.session || null)
                    .exec();
                if (ancestorNode) {
                    if (L >= 1 && L <= 3) {
                        await calculateAndCreateCommissions(ancestorNode.idCardId, L, "AUTOPOOL", L_AMOUNTS[L], options);
                    }
                    else {
                        // Level 4-7 rebirth triggers are processed separately in rebirthService and queued
                    }
                }
            }
        }
    }
}
// Helper for MY SYSTEM depth nodes counting
async function countMySystemNodesAtDepth(rootId, targetDepth, options = {}) {
    let currentLevelIds = [rootId];
    for (let d = 1; d <= targetDepth; d++) {
        const children = await MySystemNode_1.MySystemNode.find({ parentNodeId: { $in: currentLevelIds } })
            .session(options.session || null)
            .exec();
        if (children.length === 0)
            return 0;
        currentLevelIds = children.map(c => c._id);
    }
    return currentLevelIds.length;
}
// MY SYSTEM logic
async function checkMySystemLevelCompletion(newNodeId, options = {}) {
    const requirements = { 1: 2, 2: 4, 3: 8 };
    let currentNode = await MySystemNode_1.MySystemNode.findById(newNodeId).session(options.session || null).exec();
    for (let L = 1; L <= 3; L++) {
        if (!currentNode || !currentNode.parentNodeId)
            break;
        const ancestorNode = await MySystemNode_1.MySystemNode.findById(currentNode.parentNodeId)
            .session(options.session || null)
            .exec();
        if (ancestorNode) {
            const count = await countMySystemNodesAtDepth(ancestorNode._id, L, options);
            if (count === requirements[L]) {
                const existingCommission = await CommissionEntry_1.CommissionEntry.findOne({
                    idCardId: ancestorNode.idCardId,
                    stream: "MY_SYSTEM",
                    level: L
                }).session(options.session || null).exec();
                if (!existingCommission) {
                    await calculateAndCreateCommissions(ancestorNode.idCardId, L, "MY_SYSTEM", L_AMOUNTS[L], options);
                }
            }
        }
        currentNode = ancestorNode;
    }
}
// Main orchestrator for creating commissions with Pay-Once rule
async function calculateAndCreateCommissions(idCardId, level, stream, amountPaise, options = {}) {
    // 1. Check Pay-Once Ledger
    const alreadyPaid = await payOnceService.hasAlreadyPaid(idCardId, level, options);
    const idCard = await MemberIdCard_1.MemberIdCard.findById(idCardId).session(options.session || null).exec();
    if (!idCard)
        return;
    if (alreadyPaid) {
        // Prevent duplicate blocked rows when checks run more than once
        const existingBlocked = await CommissionEntry_1.CommissionEntry.findOne({
            idCardId,
            stream,
            level,
            status: "PAY_ONCE_BLOCKED"
        }).session(options.session || null).exec();
        if (existingBlocked)
            return;
        await CommissionEntry_1.CommissionEntry.create([
            {
                idCardId,
                stream,
                level,
                amountPaise: 0,
                status: "PAY_ONCE_BLOCKED"
            },
        ], { session: options.session });
    }
    else {
        // Record payment in PayOnceLedger
        await payOnceService.recordPayment(idCardId, level, stream, options);
        // Read live system toggles
        const mySystem7DayHold = await adminService.getSettingBoolean("MY_SYSTEM_7DAY_HOLD", true, options);
        const autoPoolLockedBeforeAcb = await adminService.getSettingBoolean("AUTOPOOL_LOCKED_BEFORE_ACB", true, options);
        const rebirthRequiresMainAcb = await adminService.getSettingBoolean("REBIRTH_WITHDRAWAL_REQUIRES_MAIN_ACB", true, options);
        const isRebirth = idCard.type === "REBIRTH";
        const ownerMainCard = await MemberIdCard_1.MemberIdCard.findOne({
            memberId: idCard.memberId,
            type: "MAIN"
        }).session(options.session || null).exec();
        let hasAcb = true;
        if (isRebirth) {
            hasAcb = rebirthRequiresMainAcb ? Boolean(ownerMainCard?.acbStatus) : true;
        }
        else {
            hasAcb = Boolean(ownerMainCard?.acbStatus || idCard.acbStatus);
        }
        let initialStatus = "CONFIRMED";
        if (stream === "MY_SYSTEM") {
            if (mySystem7DayHold) {
                initialStatus = "PENDING_7_DAY";
            }
            else {
                initialStatus = hasAcb ? "WITHDRAWABLE" : "LOCKED_ACB";
            }
        }
        else if (stream === "AUTOPOOL") {
            if (!autoPoolLockedBeforeAcb) {
                initialStatus = "WITHDRAWABLE";
            }
            else if (!hasAcb) {
                initialStatus = "LOCKED_ACB";
            }
            else {
                initialStatus = "WITHDRAWABLE";
            }
        }
        // Create commission entry
        const commissionArr = await CommissionEntry_1.CommissionEntry.create([
            {
                idCardId,
                stream,
                level,
                amountPaise,
                status: initialStatus
            },
        ], { session: options.session });
        const commission = commissionArr[0];
        // If immediately withdrawable, credit the wallet
        if (initialStatus === "WITHDRAWABLE") {
            await walletService.credit(idCard.memberId, amountPaise, stream, commission.id, `Commission for ${stream} Level ${level}`, options);
        }
    }
}
