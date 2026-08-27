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
exports.run7DaySweep = run7DaySweep;
exports.runAcbSweep = runAcbSweep;
exports.runMondaySettlement = runMondaySettlement;
exports.runDailyInactivitySweep = runDailyInactivitySweep;
const node_cron_1 = __importDefault(require("node-cron"));
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
const acbService = __importStar(require("../services/acbService"));
const walletService = __importStar(require("../services/walletService"));
const settlementService = __importStar(require("../services/settlementService"));
const mongoose_1 = __importDefault(require("mongoose"));
async function run7DaySweep() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let processed = 0;
    const pendingCommissions = await CommissionEntry_1.CommissionEntry.find({
        status: "PENDING_7_DAY",
        createdAt: { $lte: sevenDaysAgo }
    }).populate("idCardId").exec();
    for (const commission of pendingCommissions) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Recheck status inside transaction
            const current = await CommissionEntry_1.CommissionEntry.findById(commission.id).session(session).exec();
            if (!current || current.status !== "PENDING_7_DAY") {
                await session.commitTransaction();
                session.endSession();
                continue;
            }
            const idCard = commission.idCardId;
            if (!idCard) {
                await session.commitTransaction();
                session.endSession();
                continue;
            }
            // Check if source card owner has ACB qualified on MAIN card
            let hasAcb = false;
            const ownerMainCard = await MemberIdCard_1.MemberIdCard.findOne({
                memberId: idCard.memberId,
                type: "MAIN"
            }).session(session).exec();
            if (ownerMainCard && ownerMainCard.acbStatus) {
                hasAcb = true;
            }
            if (hasAcb) {
                current.status = "WITHDRAWABLE";
                await current.save({ session });
                await walletService.credit(idCard.memberId, commission.amountPaise, commission.stream, commission.id, `7-day hold released for ${commission.stream} Level ${commission.level}`, { session });
            }
            else {
                current.status = "LOCKED_ACB";
                await current.save({ session });
            }
            processed++;
            await session.commitTransaction();
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    return processed;
}
async function runAcbSweep() {
    let processed = 0;
    const cards = await MemberIdCard_1.MemberIdCard.find({ acbStatus: false }).exec();
    for (const card of cards) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const qualifies = await acbService.checkAcbStatus(card.id, { session });
            if (qualifies) {
                await acbService.unlockAcb(card.id, { session });
                await acbService.unlockLockedEarnings(card.id, { session });
                processed++;
            }
            await session.commitTransaction();
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    return processed;
}
/**
 * Weekly Monday Settlement Sweep at 00:00 UTC/IST
 */
async function runMondaySettlement() {
    try {
        const result = await settlementService.processWeeklySettlement(new Date());
        console.log(`[JOB SUMMARY] Weekly Settlement: Processed ${result.totalEntries} vendor payouts, Total Net: Rs. ${(result.netPaise / 100).toFixed(2)}`);
        return result;
    }
    catch (error) {
        console.error("[JOB ERROR] Weekly Settlement Failed:", error);
        throw error;
    }
}
/**
 * Daily Inactivity Lifecycle Sweep at 02:00
 */
async function runDailyInactivitySweep() {
    try {
        const result = await settlementService.sweepVendorInactivity(new Date());
        console.log(`[JOB SUMMARY] Inactivity Sweep: Inactivated: ${result.inactivated}, Frozen: ${result.frozen}, Closed: ${result.closed}`);
        return result;
    }
    catch (error) {
        console.error("[JOB ERROR] Inactivity Sweep Failed:", error);
        throw error;
    }
}
// 1. Hourly 7-day and ACB Sweeps
node_cron_1.default.schedule("0 * * * *", async () => {
    try {
        const holdProcessed = await run7DaySweep();
        const acbProcessed = await runAcbSweep();
        console.log(`[JOB SUMMARY] Hourly Sweep: Processed ${holdProcessed} 7-day holds, Unlocked ${acbProcessed} ACB statuses.`);
    }
    catch (error) {
        console.error("[JOB ERROR] Hourly Sweep Failed:", error);
    }
});
// 2. Weekly Monday Settlement at 00:00 ("0 0 * * MON")
node_cron_1.default.schedule("0 0 * * MON", async () => {
    await runMondaySettlement().catch(() => { });
});
// 3. Daily Inactivity Lifecycle Sweep at 02:00 ("0 2 * * *")
node_cron_1.default.schedule("0 2 * * *", async () => {
    await runDailyInactivitySweep().catch(() => { });
});
