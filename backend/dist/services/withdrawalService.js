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
exports.MIN_WITHDRAWAL_PAISE = exports.ADMIN_CHARGE_PERCENT = void 0;
exports.previewWithdrawal = previewWithdrawal;
exports.requestWithdrawal = requestWithdrawal;
exports.completeWithdrawal = completeWithdrawal;
exports.rejectWithdrawal = rejectWithdrawal;
exports.processWithdrawal = processWithdrawal;
const Withdrawal_1 = require("../models/Withdrawal");
const MemberIdCard_1 = require("../models/MemberIdCard");
const Member_1 = require("../models/Member");
const Wallet_1 = require("../models/Wallet");
const TdsLedger_1 = require("../models/TdsLedger");
const walletService = __importStar(require("./walletService"));
const tdsService = __importStar(require("./tdsService"));
const mongoose_1 = __importDefault(require("mongoose"));
exports.ADMIN_CHARGE_PERCENT = {
    BANK: 0.10,
    MEMBER_WALLET: 0.05,
    VOUCHER_CONVERSION: 0.05,
    UPI: 0.10,
    WALLET: 0.05
};
exports.MIN_WITHDRAWAL_PAISE = 10000; // Rs. 100 = 10,000 paise
/**
 * Preview calculations for withdrawal without applying database mutations.
 */
async function previewWithdrawal(memberId, method, amountPaise) {
    const normMethod = (method || "BANK").toUpperCase();
    const adminPercent = exports.ADMIN_CHARGE_PERCENT[normMethod] ?? 0.10;
    // Guest Mode: Zero prior FY aggregates, default 3% rate on > ₹20k
    if (!memberId) {
        const thresholdPaise = 2000000; // Rs. 20,000
        const tdsRate = 0.03;
        const taxableBasePaise = amountPaise;
        let tdsPaise = 0;
        if (taxableBasePaise > thresholdPaise) {
            tdsPaise = Math.floor(((taxableBasePaise - thresholdPaise) * 3) / 100);
        }
        const postTdsPaise = taxableBasePaise - tdsPaise;
        const adminChargePaise = Math.floor((postTdsPaise * (adminPercent * 100)) / 100);
        const netPaise = postTdsPaise - adminChargePaise;
        return {
            grossPaise: amountPaise,
            recovered194RPaise: 0,
            taxableBasePaise,
            tdsSection: "SECTION_194H",
            appliedTdsRatePct: tdsRate * 100,
            estimatedTdsPaise: tdsPaise,
            postTdsPaise,
            adminChargeRatePct: adminPercent * 100,
            estimatedAdminChargePaise: adminChargePaise,
            netPayablePaise: netPaise,
            kycStatus: "GUEST",
            kycTier: "TIER_0",
            currentFyGrossTotalPaise: 0,
            fyThresholdPaise: thresholdPaise,
            isGuest: true
        };
    }
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const member = await Member_1.Member.findById(memberId).session(session).exec();
        if (!member)
            throw new Error("Member not found");
        // Step 0: 194R Liability
        const pending194R = await tdsService.getPending194RLiability(memberId, { session });
        const recovered194RPaise = Math.min(amountPaise, pending194R);
        const taxableBasePaise = amountPaise - recovered194RPaise;
        // Step 1: 194H TDS
        const { tdsPaise, rate: tdsRate, priorGrossPaise, thresholdPaise } = await tdsService.calculate194HTds(memberId, taxableBasePaise, { session });
        // Step 2: Admin Charge on Post-TDS Amount
        const postTdsPaise = taxableBasePaise - tdsPaise;
        const adminChargePaise = Math.floor((postTdsPaise * (adminPercent * 100)) / 100);
        // Step 3: Net Payable
        const netPaise = postTdsPaise - adminChargePaise;
        await session.commitTransaction();
        return {
            grossPaise: amountPaise,
            recovered194RPaise,
            taxableBasePaise,
            tdsSection: "SECTION_194H",
            appliedTdsRatePct: tdsRate * 100,
            estimatedTdsPaise: tdsPaise,
            postTdsPaise,
            adminChargeRatePct: adminPercent * 100,
            estimatedAdminChargePaise: adminChargePaise,
            netPayablePaise: netPaise,
            kycStatus: member.kycStatus,
            kycTier: member.kycTier,
            currentFyGrossTotalPaise: priorGrossPaise,
            fyThresholdPaise: thresholdPaise,
            isGuest: false
        };
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
/**
 * Request a withdrawal with atomic lock and Step 0-3 calculation.
 */
async function requestWithdrawal(memberId, idCardId, method, amountPaise, paymentDetails = null, idempotencyKey = null) {
    if (amountPaise < exports.MIN_WITHDRAWAL_PAISE) {
        throw new Error("Minimum withdrawal amount is Rs. 100");
    }
    const normMethod = (method || "BANK").toUpperCase();
    if (exports.ADMIN_CHARGE_PERCENT[normMethod] === undefined) {
        throw new Error("Invalid withdrawal method. Supported: BANK, VOUCHER_CONVERSION, UPI");
    }
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // 0. Idempotency Check
        if (idempotencyKey) {
            const existing = await Withdrawal_1.Withdrawal.findOne({ idempotencyKey }).session(session).exec();
            if (existing) {
                await session.commitTransaction();
                return existing;
            }
        }
        // 1. Verify MAIN ID and ACB Status
        const idCard = await MemberIdCard_1.MemberIdCard.findOne({ _id: idCardId, memberId })
            .session(session)
            .exec();
        if (!idCard) {
            throw new Error("ID card not found or does not belong to member");
        }
        if (idCard.type !== "MAIN") {
            throw new Error("Withdrawals can only be initiated from MAIN ID card");
        }
        if (!idCard.acbStatus) {
            throw new Error("ACB status required for withdrawals. Achieve 1 LEFT + 1 RIGHT direct referral.");
        }
        // 2. Balance Check
        const wallet = await Wallet_1.Wallet.findOne({ memberId }).session(session).exec();
        if (!wallet || wallet.balancePaise < amountPaise) {
            throw new Error(`Insufficient funds for member ${memberId}`);
        }
        // 3. Step 0: 194R Liability Recovery Preview
        const pending194R = await tdsService.getPending194RLiability(memberId, { session });
        const recovered194RPaise = Math.min(amountPaise, pending194R);
        const taxableBasePaise = amountPaise - recovered194RPaise;
        // 4. Step 1: 194H TDS on Taxable Base
        const { tdsPaise } = await tdsService.calculate194HTds(memberId, taxableBasePaise, { session });
        // 5. Step 2: Admin Charge on Post-TDS Amount
        const postTdsPaise = taxableBasePaise - tdsPaise;
        const adminPercent = exports.ADMIN_CHARGE_PERCENT[normMethod];
        const adminChargePaise = Math.floor((postTdsPaise * (adminPercent * 100)) / 100);
        // 6. Step 3: Net Payable
        const netPaise = postTdsPaise - adminChargePaise;
        // Invariant Check
        if (amountPaise !== recovered194RPaise + tdsPaise + adminChargePaise + netPaise) {
            throw new Error("Ledger Math Assertion Failed: Gross does not equal Recovery + TDS + Admin + Net.");
        }
        // 7. Debit Escrow from Wallet
        await walletService.debit(memberId, amountPaise, "WITHDRAWAL_ESCROW", null, "Withdrawal Request Escrow", { session });
        // 8. Create Withdrawal Record
        const withdrawalArr = await Withdrawal_1.Withdrawal.create([
            {
                memberId,
                idCardId,
                method: normMethod,
                grossPaise: amountPaise,
                recovered194RPaise,
                tdsPaise,
                adminChargePaise,
                netPaise,
                idempotencyKey: idempotencyKey || undefined,
                status: "REQUESTED",
                paymentDetails: paymentDetails ? JSON.stringify(paymentDetails) : undefined
            }
        ], { session });
        const withdrawal = withdrawalArr[0];
        // 9. Hold TDS in TdsLedger as PENDING if applicable
        if (tdsPaise > 0) {
            await TdsLedger_1.TdsLedger.create([
                {
                    memberId,
                    section: "SECTION_194H",
                    amountPaise: tdsPaise,
                    status: "PENDING",
                    referenceId: withdrawal.id,
                    financialYear: tdsService.getCurrentFinancialYearRange().startDate.getFullYear().toString()
                }
            ], { session });
        }
        await session.commitTransaction();
        return withdrawal;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
/**
 * Complete / Approve Withdrawal: releases escrow and writes distinct split ledger entries.
 */
async function completeWithdrawal(withdrawalId) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const withdrawal = await Withdrawal_1.Withdrawal.findById(withdrawalId).session(session).exec();
        if (!withdrawal)
            throw new Error("Withdrawal not found");
        if (withdrawal.status !== "REQUESTED") {
            throw new Error(`Withdrawal already processed (Status: ${withdrawal.status})`);
        }
        // 1. Recover Step 0 194R Liability if any
        if (withdrawal.recovered194RPaise > 0) {
            await tdsService.recover194RLiability(withdrawal.memberId, withdrawal.recovered194RPaise, { session });
        }
        // 2. Reverse Escrow
        await walletService.credit(withdrawal.memberId, withdrawal.grossPaise, "ESCROW_RELEASED", withdrawal.id, "Reversing escrow for final payout splits", { session });
        // 3. Post Individual Split Debits
        await walletService.debit(withdrawal.memberId, withdrawal.netPaise, "WITHDRAWAL_PAYOUT", withdrawal.id, `Net Payout via ${withdrawal.method}`, { session });
        if (withdrawal.tdsPaise > 0) {
            await walletService.debit(withdrawal.memberId, withdrawal.tdsPaise, "TDS_DEDUCTED", withdrawal.id, "TDS Section 194H", { session });
            // Mark TDS as deposited
            await tdsService.depositTDS(withdrawal.id, { session });
        }
        if (withdrawal.adminChargePaise > 0) {
            await walletService.debit(withdrawal.memberId, withdrawal.adminChargePaise, "ADMIN_FEE", withdrawal.id, "Admin Charge", { session });
        }
        if (withdrawal.recovered194RPaise > 0) {
            await walletService.debit(withdrawal.memberId, withdrawal.recovered194RPaise, "TDS_194R_RECOVERY", withdrawal.id, "194R Voucher Tax Recovery", { session });
        }
        // 4. Mark Withdrawal as COMPLETED
        withdrawal.status = "COMPLETED";
        withdrawal.completedAt = new Date();
        await withdrawal.save({ session });
        await session.commitTransaction();
        return withdrawal;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
/**
 * Reject Withdrawal: refunds escrow in full and reverses held TDS.
 */
async function rejectWithdrawal(withdrawalId, rejectionReason = "Rejected by admin") {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const withdrawal = await Withdrawal_1.Withdrawal.findById(withdrawalId).session(session).exec();
        if (!withdrawal)
            throw new Error("Withdrawal not found");
        if (withdrawal.status !== "REQUESTED") {
            throw new Error(`Withdrawal already processed (Status: ${withdrawal.status})`);
        }
        // 1. Refund the wallet (release escrow)
        await walletService.credit(withdrawal.memberId, withdrawal.grossPaise, "WITHDRAWAL_REFUND", withdrawal.id, `Withdrawal Rejected: ${rejectionReason}`, { session });
        // 2. Reverse TDS Ledger entries
        await tdsService.reverseTDS(withdrawal.id, { session });
        // 3. Mark as REJECTED
        withdrawal.status = "REJECTED";
        withdrawal.completedAt = new Date();
        withdrawal.rejectionReason = rejectionReason;
        await withdrawal.save({ session });
        await session.commitTransaction();
        return withdrawal;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
async function processWithdrawal(withdrawalId, action, rejectionReason = null) {
    if (action === "APPROVE" || action === "COMPLETE") {
        return await completeWithdrawal(withdrawalId);
    }
    if (action === "REJECT") {
        return await rejectWithdrawal(withdrawalId, rejectionReason || "Rejected by admin");
    }
    throw new Error("Invalid action. Must be APPROVE or REJECT.");
}
