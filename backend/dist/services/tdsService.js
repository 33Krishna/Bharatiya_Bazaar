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
exports.getCurrentFYDateRange = exports.AGGREGATE_194C_PAISE = exports.SINGLE_194C_PAISE = exports.THRESHOLD_194R_PAISE = exports.THRESHOLD_194H_PAISE = void 0;
exports.getCurrentFinancialYearRange = getCurrentFinancialYearRange;
exports.calculate194HTds = calculate194HTds;
exports.calculate194R = calculate194R;
exports.create194RLiability = create194RLiability;
exports.calculate194C = calculate194C;
exports.calculate194HVendorReferralTds = calculate194HVendorReferralTds;
exports.getPending194RLiability = getPending194RLiability;
exports.recover194RLiability = recover194RLiability;
exports.trackTDSLedger = trackTDSLedger;
exports.depositTDS = depositTDS;
exports.reverseTDS = reverseTDS;
const Member_1 = require("../models/Member");
const Withdrawal_1 = require("../models/Withdrawal");
const TdsLedger_1 = require("../models/TdsLedger");
const VendorSettlement_1 = require("../models/VendorSettlement");
const VendorReferralBonus_1 = require("../models/VendorReferralBonus");
const Voucher_1 = require("../models/Voucher");
const adminService = __importStar(require("./adminService"));
// Section Thresholds (in Paise)
exports.THRESHOLD_194H_PAISE = 2000000; // ₹20,000
exports.THRESHOLD_194R_PAISE = 2000000; // ₹20,000
exports.SINGLE_194C_PAISE = 3000000; // ₹30,000
exports.AGGREGATE_194C_PAISE = 10000000; // ₹1,00,000
/**
 * Returns exact start and end timestamps for the Indian Financial Year (April 1 to March 31).
 */
function getCurrentFinancialYearRange(date = new Date()) {
    const d = new Date(date);
    let year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 3 = Apr
    if (month < 3) {
        year = year - 1;
    }
    const startDate = new Date(year, 3, 1, 0, 0, 0, 0); // Apr 1 00:00:00
    const endDate = new Date(year + 1, 2, 31, 23, 59, 59, 999); // Mar 31 23:59:59.999
    return { startDate, endDate };
}
exports.getCurrentFYDateRange = getCurrentFinancialYearRange;
/**
 * Section 194H: Member Cash Commissions
 * ₹20k FY threshold (or dynamic), marginal method, 3% with PAN / KYC Tier 2 / Verified, 20% without.
 */
async function calculate194HTds(memberId, requestGrossPaise, options = {}) {
    const member = await Member_1.Member.findById(memberId).session(options.session || null).exec();
    if (!member) {
        throw new Error(`Member with id ${memberId} not found`);
    }
    const thresholdPaise = await adminService.getSetting("TDS_194H_THRESHOLD_PAISE", exports.THRESHOLD_194H_PAISE, "integer", options);
    const isPanVerified = member.panVerified || member.kycStatus === "VERIFIED" || member.kycTier === "TIER2";
    let rate = 0.03;
    if (isPanVerified) {
        const dynamicRate = await adminService.getSetting("TDS_194H_RATE_VERIFIED", 0.03, "number", options);
        rate = dynamicRate > 1 ? dynamicRate / 100 : dynamicRate;
    }
    else {
        const unverifiedRate = await adminService.getSetting("TDS_194H_RATE_UNVERIFIED", 0.20, "number", options);
        rate = unverifiedRate > 1 ? unverifiedRate / 100 : unverifiedRate;
    }
    const { startDate, endDate } = getCurrentFinancialYearRange();
    // Find all COMPLETED withdrawals in the current FY
    const pastWithdrawals = await Withdrawal_1.Withdrawal.find({
        memberId,
        status: "COMPLETED",
        completedAt: {
            $gte: startDate,
            $lte: endDate
        }
    }).session(options.session || null).exec();
    const priorGrossPaise = pastWithdrawals.reduce((sum, w) => sum + (w.grossPaise - (w.recovered194RPaise || 0)), 0);
    const totalGrossPaise = priorGrossPaise + requestGrossPaise;
    let taxablePaise = 0;
    if (totalGrossPaise > thresholdPaise) {
        if (priorGrossPaise >= thresholdPaise) {
            taxablePaise = requestGrossPaise;
        }
        else {
            taxablePaise = totalGrossPaise - thresholdPaise;
        }
    }
    const tdsPaise = Math.floor((taxablePaise * (rate * 100)) / 100);
    return {
        tdsPaise,
        taxablePaise,
        rate,
        priorGrossPaise,
        totalGrossPaise,
        thresholdPaise,
        isPanVerified
    };
}
/**
 * Section 194R: Product Vouchers
 * ₹20k FY threshold, full aggregate method (10% of FULL aggregate once crossed).
 */
async function calculate194R(memberId, newVoucherFaceValuePaise, currentVoucherId = null, options = {}) {
    const { startDate, endDate } = getCurrentFinancialYearRange();
    const thresholdPaise = await adminService.getSetting("TDS_194R_THRESHOLD_PAISE", exports.THRESHOLD_194R_PAISE, "integer", options);
    const rawRate = await adminService.getSetting("TDS_194R_RATE", 0.10, "number", options);
    const rate = rawRate > 1 ? rawRate / 100 : rawRate;
    // 1. Get all vouchers redeemed in current FY
    const redeemedVouchers = await Voucher_1.Voucher.find({
        memberId,
        status: "REDEEMED",
        redeemedAt: {
            $gte: startDate,
            $lte: endDate
        }
    }).session(options.session || null).exec();
    const priorRedeemedPaise = redeemedVouchers
        .filter(v => v.id !== currentVoucherId)
        .reduce((sum, v) => sum + v.faceValuePaise, 0);
    const totalVoucherPaise = priorRedeemedPaise + newVoucherFaceValuePaise;
    // 2. Get existing 194R liability recorded in current FY
    const past194RLedger = await TdsLedger_1.TdsLedger.find({
        memberId,
        section: "SECTION_194R",
        createdAt: {
            $gte: startDate,
            $lte: endDate
        },
        status: { $in: ["PENDING", "HELD", "DEPOSITED", "RECOVERED"] }
    }).session(options.session || null).exec();
    const existing194RLiabilityPaise = past194RLedger.reduce((sum, l) => sum + l.amountPaise, 0);
    let liabilityPaise = 0;
    if (totalVoucherPaise > thresholdPaise) {
        // 10% (or dynamic rate) on FULL aggregate
        const totalTargetTaxPaise = Math.floor(totalVoucherPaise * rate);
        liabilityPaise = Math.max(0, totalTargetTaxPaise - existing194RLiabilityPaise);
    }
    return {
        liabilityPaise,
        totalVoucherPaise,
        priorRedeemedPaise,
        thresholdExceeded: totalVoucherPaise > thresholdPaise,
        existingLiabilityPaise: existing194RLiabilityPaise
    };
}
/**
 * Hook to record 194R liability on voucher redemption.
 */
async function create194RLiability(memberId, voucherFaceValuePaise, referenceId = null, options = {}) {
    const calc = await calculate194R(memberId, voucherFaceValuePaise, referenceId, options);
    if (calc.liabilityPaise > 0) {
        await TdsLedger_1.TdsLedger.create([
            {
                memberId,
                section: "SECTION_194R",
                amountPaise: calc.liabilityPaise,
                status: "PENDING",
                referenceId,
                financialYear: getCurrentFinancialYearRange().startDate.getFullYear().toString(),
            },
        ], { session: options.session });
    }
    return calc;
}
/**
 * Section 194C: Vendor Payout TDS Calculation
 */
async function calculate194C(vendorId, payoutBeforeTdsPaise, entityType = "INDIVIDUAL", hasPan = true, options = {}) {
    const singleThreshold = await adminService.getSetting("TDS_194C_SINGLE_THRESHOLD_PAISE", exports.SINGLE_194C_PAISE, "integer", options);
    const aggregateThreshold = await adminService.getSetting("TDS_194C_AGGREGATE_THRESHOLD_PAISE", exports.AGGREGATE_194C_PAISE, "integer", options);
    let rate = 0.20;
    if (hasPan) {
        if (entityType.toUpperCase() === "COMPANY") {
            const compRate = await adminService.getSetting("TDS_194C_RATE_COMPANY", 0.02, "number", options);
            rate = compRate > 1 ? compRate / 100 : compRate;
        }
        else {
            const indRate = await adminService.getSetting("TDS_194C_RATE_INDIVIDUAL", 0.01, "number", options);
            rate = indRate > 1 ? indRate / 100 : indRate;
        }
    }
    else {
        const unvRate = await adminService.getSetting("TDS_194C_RATE_UNVERIFIED", 0.20, "number", options);
        rate = unvRate > 1 ? unvRate / 100 : unvRate;
    }
    const { startDate, endDate } = getCurrentFinancialYearRange();
    const pastSettlements = await VendorSettlement_1.VendorSettlement.find({
        vendorId,
        status: { $in: ["COMPLETED", "SETTLED", "PAYOUT_DUE"] },
        settledAt: {
            $gte: startDate,
            $lte: endDate
        }
    }).session(options.session || null).exec();
    const priorAggregatePaise = pastSettlements.reduce((sum, s) => sum + (s.payoutBeforeTdsPaise > 0 ? s.payoutBeforeTdsPaise : (s.grossSalesPaise || 0)), 0);
    const totalAggregatePaise = priorAggregatePaise + payoutBeforeTdsPaise;
    const isSingleThresholdCrossed = payoutBeforeTdsPaise > singleThreshold;
    const isAggregateThresholdCrossed = totalAggregatePaise > aggregateThreshold;
    let taxablePaise = 0;
    if (isSingleThresholdCrossed || isAggregateThresholdCrossed) {
        if (priorAggregatePaise >= aggregateThreshold || isSingleThresholdCrossed) {
            taxablePaise = payoutBeforeTdsPaise;
        }
        else {
            taxablePaise = totalAggregatePaise - aggregateThreshold;
        }
    }
    const tdsPaise = Math.floor((taxablePaise * (rate * 100)) / 100);
    return {
        tdsPaise,
        taxablePaise,
        rate,
        thresholdExceeded: isSingleThresholdCrossed || isAggregateThresholdCrossed
    };
}
/**
 * Section 194H: Vendor Referral Bonus
 * ₹20k FY threshold, 3% with PAN / 20% without.
 */
async function calculate194HVendorReferralTds(memberId, bonusAmountPaise, options = {}) {
    const member = await Member_1.Member.findById(memberId).session(options.session || null).exec();
    const isPanVerified = member?.panVerified || member?.kycStatus === "VERIFIED" || member?.kycTier === "TIER2";
    const rate = isPanVerified ? 0.03 : 0.20;
    const { startDate, endDate } = getCurrentFinancialYearRange();
    const pastBonuses = await VendorReferralBonus_1.VendorReferralBonus.find({
        memberId,
        status: "PAID",
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    }).session(options.session || null).exec();
    const priorBonusPaise = pastBonuses.reduce((sum, b) => sum + b.bonusPaise, 0);
    const totalBonusPaise = priorBonusPaise + bonusAmountPaise;
    let taxablePaise = 0;
    if (totalBonusPaise > exports.THRESHOLD_194H_PAISE) {
        if (priorBonusPaise >= exports.THRESHOLD_194H_PAISE) {
            taxablePaise = bonusAmountPaise;
        }
        else {
            taxablePaise = totalBonusPaise - exports.THRESHOLD_194H_PAISE;
        }
    }
    const tdsPaise = Math.floor((taxablePaise * (rate * 100)) / 100);
    return {
        tdsPaise,
        taxablePaise,
        rate
    };
}
/**
 * Gets outstanding (unrecovered) 194R voucher liability for a member.
 */
async function getPending194RLiability(memberId, options = {}) {
    const pendingEntries = await TdsLedger_1.TdsLedger.find({
        memberId,
        section: "SECTION_194R",
        status: { $in: ["PENDING", "HELD"] }
    }).session(options.session || null).exec();
    return pendingEntries.reduce((sum, e) => sum + e.amountPaise, 0);
}
/**
 * Settles/recovers 194R liability up to maxDeductPaise.
 */
async function recover194RLiability(memberId, maxDeductPaise, options = {}) {
    if (maxDeductPaise <= 0)
        return 0;
    const pendingEntries = await TdsLedger_1.TdsLedger.find({
        memberId,
        section: "SECTION_194R",
        status: { $in: ["PENDING", "HELD"] }
    }).sort({ createdAt: 1 }).session(options.session || null).exec();
    let remainingToDeduct = maxDeductPaise;
    let totalRecovered = 0;
    for (const entry of pendingEntries) {
        if (remainingToDeduct <= 0)
            break;
        if (entry.amountPaise <= remainingToDeduct) {
            entry.status = "RECOVERED";
            if (options.session) {
                entry.$session(options.session);
            }
            await entry.save();
            remainingToDeduct -= entry.amountPaise;
            totalRecovered += entry.amountPaise;
        }
        else {
            // Partial recovery: reduce amount on this entry and create a new RECOVERED entry
            const deductVal = remainingToDeduct;
            entry.amountPaise = entry.amountPaise - deductVal;
            if (options.session) {
                entry.$session(options.session);
            }
            await entry.save();
            await TdsLedger_1.TdsLedger.create([
                {
                    memberId,
                    section: "SECTION_194R",
                    amountPaise: deductVal,
                    status: "RECOVERED",
                    referenceId: entry.referenceId,
                    financialYear: entry.financialYear
                },
            ], { session: options.session });
            totalRecovered += deductVal;
            remainingToDeduct = 0;
        }
    }
    return totalRecovered;
}
/**
 * Creates generic TdsLedger entry.
 */
async function trackTDSLedger({ memberId, vendorId, section, amountPaise, status = "HELD", referenceId = null }, options = {}) {
    const newEntryArr = await TdsLedger_1.TdsLedger.create([
        {
            memberId: memberId || undefined,
            vendorId: vendorId || undefined,
            section,
            amountPaise,
            status,
            referenceId: referenceId || undefined,
            financialYear: getCurrentFinancialYearRange().startDate.getFullYear().toString(),
        },
    ], { session: options.session });
    return newEntryArr[0];
}
/**
 * Marks TDS entries associated with a withdrawal as DEPOSITED.
 */
async function depositTDS(withdrawalId, options = {}) {
    return await TdsLedger_1.TdsLedger.updateMany({
        referenceId: withdrawalId,
        status: { $in: ["PENDING", "HELD"] }
    }, { status: "DEPOSITED" }).session(options.session || null).exec();
}
/**
 * Reverses TDS entries associated with a rejected withdrawal.
 */
async function reverseTDS(withdrawalId, options = {}) {
    return await TdsLedger_1.TdsLedger.updateMany({
        referenceId: withdrawalId,
        status: { $in: ["PENDING", "HELD"] }
    }, { status: "REVERSED" }).session(options.session || null).exec();
}
