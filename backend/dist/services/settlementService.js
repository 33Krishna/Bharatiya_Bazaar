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
exports.WALLET_MIN_BALANCE_PAISE = exports.SECURITY_DEPOSIT_PAISE = exports.EARLY_SETTLEMENT_FEE_PAISE = void 0;
exports.getVolumeDiscountPct = getVolumeDiscountPct;
exports.calculateSettlementBreakdown = calculateSettlementBreakdown;
exports.processWeeklySettlement = processWeeklySettlement;
exports.processEarlySettlement = processEarlySettlement;
exports.sweepVendorInactivity = sweepVendorInactivity;
exports.checkDepositFreeze = checkDepositFreeze;
exports.penalizeVendor = penalizeVendor;
const Vendor_1 = require("../models/Vendor");
const VendorSale_1 = require("../models/VendorSale");
const VendorSettlement_1 = require("../models/VendorSettlement");
const SettlementRun_1 = require("../models/SettlementRun");
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
const VendorReferralBonus_1 = require("../models/VendorReferralBonus");
const AuditLog_1 = require("../models/AuditLog");
const tdsService = __importStar(require("./tdsService"));
const setuKoshService = __importStar(require("./setuKoshService"));
const adminService = __importStar(require("./adminService"));
const walletService = __importStar(require("./walletService"));
const mongoose_1 = __importDefault(require("mongoose"));
exports.EARLY_SETTLEMENT_FEE_PAISE = 25000; // Rs. 250 in paise
exports.SECURITY_DEPOSIT_PAISE = 500000; // Rs. 5,000 in paise
exports.WALLET_MIN_BALANCE_PAISE = 50000; // Rs. 500 in paise
/**
 * Calculates volume discount percentage on the admin charge based on monthly sales in the calendar month containing periodEnd.
 */
async function getVolumeDiscountPct(vendorId, periodEnd, options = {}) {
    const year = periodEnd.getFullYear();
    const month = periodEnd.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const salesAgg = await VendorSale_1.VendorSale.aggregate([
        {
            $match: {
                vendorId: new mongoose_1.default.Types.ObjectId(vendorId.toString()),
                status: { $nin: ["REFUNDED", "CANCELLED"] },
                createdAt: { $gte: monthStart, $lte: monthEnd }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: "$amountPaise" }
            }
        }
    ]).session(options.session || null).exec();
    const monthlySales = salesAgg.length > 0 ? salesAgg[0].totalSales : 0;
    const t5Min = await adminService.getSetting("VOLUME_DISCOUNT_TIER_5_MIN_SALES_PAISE", 50000000, "integer", options);
    const t5Rate = await adminService.getSetting("VOLUME_DISCOUNT_TIER_5_RATE_PCT", 50, "integer", options);
    const t4Min = await adminService.getSetting("VOLUME_DISCOUNT_TIER_4_MIN_SALES_PAISE", 20000000, "integer", options);
    const t4Rate = await adminService.getSetting("VOLUME_DISCOUNT_TIER_4_RATE_PCT", 30, "integer", options);
    const t3Min = await adminService.getSetting("VOLUME_DISCOUNT_TIER_3_MIN_SALES_PAISE", 10000000, "integer", options);
    const t3Rate = await adminService.getSetting("VOLUME_DISCOUNT_TIER_3_RATE_PCT", 20, "integer", options);
    const t2Min = await adminService.getSetting("VOLUME_DISCOUNT_TIER_2_MIN_SALES_PAISE", 5000000, "integer", options);
    const t2Rate = await adminService.getSetting("VOLUME_DISCOUNT_TIER_2_RATE_PCT", 10, "integer", options);
    if (monthlySales >= t5Min)
        return t5Rate;
    if (monthlySales >= t4Min)
        return t4Rate;
    if (monthlySales >= t3Min)
        return t3Rate;
    if (monthlySales >= t2Min)
        return t2Rate;
    return 0;
}
/**
 * Pure integer settlement calculation breakdown for a set of vendor sales.
 */
async function calculateSettlementBreakdown(sales, vendor, options = {}) {
    const { isEarly = false, periodEnd = new Date(), adminRatePctOverride = null } = options;
    const grossSalesPaise = sales.reduce((sum, sale) => sum + sale.amountPaise, 0);
    // Platform Margin: sum of snapshotted marginPaise per sale
    const marginPaise = sales.reduce((sum, sale) => {
        return sum + (sale.marginPaise > 0 ? sale.marginPaise : Math.floor((sale.amountPaise * vendor.marginRatePct) / 100));
    }, 0);
    const postMarginPaise = grossSalesPaise - marginPaise;
    // Admin Charge Rate: Configurable via PlatformSetting or default (10% Bank / 5% Wallet)
    let adminRatePct = adminRatePctOverride;
    if (adminRatePct === null) {
        const settingKey = vendor.payoutMethod === "WALLET" ? "VENDOR_ADMIN_CHARGE_WALLET_PCT" : "VENDOR_ADMIN_CHARGE_BANK_PCT";
        const customRate = await adminService.getSetting(settingKey, vendor.payoutMethod === "WALLET" ? 5 : 10, "number", options);
        adminRatePct = customRate !== null ? customRate : (vendor.payoutMethod === "WALLET" ? 5 : 10);
    }
    const baseAdminChargePaise = Math.floor((postMarginPaise * adminRatePct) / 100);
    // Volume Discount: Applies to admin charge ONLY
    const discountPct = await getVolumeDiscountPct(vendor.id, periodEnd, options);
    const volumeDiscountPaise = Math.floor((baseAdminChargePaise * discountPct) / 100);
    const netAdminChargePaise = baseAdminChargePaise - volumeDiscountPaise;
    // Early Fee: Deducted before TDS
    const earlyFeeSetting = await adminService.getSetting("EARLY_SETTLEMENT_FEE_PAISE", exports.EARLY_SETTLEMENT_FEE_PAISE, "integer", options);
    const earlyFeePaise = isEarly ? earlyFeeSetting : 0;
    const payoutBeforeTdsPaise = Math.max(0, postMarginPaise - netAdminChargePaise - earlyFeePaise);
    // 194C TDS Calculation
    let hasPan = Boolean(vendor.gstin);
    const vMember = await Member_1.Member.findById(vendor.memberId).session(options.session || null).exec();
    if (vMember) {
        hasPan = Boolean(hasPan || vMember.panVerified || vMember.kycStatus === "VERIFIED" || vMember.kycTier === "TIER2" || vMember.panNumber);
    }
    const entityType = vendor.category === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    const tdsResult = await tdsService.calculate194C(vendor.id, payoutBeforeTdsPaise, entityType, hasPan, options);
    const tdsPaise = tdsResult.tdsPaise;
    const netPayablePaise = Math.max(0, payoutBeforeTdsPaise - tdsPaise);
    return {
        grossSalesPaise,
        marginPaise,
        postMarginPaise,
        adminRatePct,
        baseAdminChargePaise,
        volumeDiscountPct: discountPct,
        volumeDiscountPaise,
        netAdminChargePaise,
        earlyFeePaise,
        payoutBeforeTdsPaise,
        tdsPaise,
        tdsRate: tdsResult.rate,
        netPayablePaise
    };
}
/**
 * Process the weekly Monday settlement.
 * Runs for the previous Monday 00:00:00 to Sunday 23:59:59.
 */
async function processWeeklySettlement(runDate = new Date(), options = {}) {
    const { adminRatePctOverride = null, actorId = null } = options;
    // 1. Determine period boundaries
    const periodEnd = new Date(runDate);
    periodEnd.setHours(0, 0, 0, 0); // Monday 00:00
    periodEnd.setMilliseconds(-1); // Prior Sunday 23:59:59.999
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 6);
    periodStart.setHours(0, 0, 0, 0); // Prior Monday 00:00:00
    // 2. Idempotency on runDate
    const normalizedRunDate = new Date(runDate);
    normalizedRunDate.setHours(0, 0, 0, 0);
    const existingRun = await SettlementRun_1.SettlementRun.findOne({ runDate: normalizedRunDate }).exec();
    if (existingRun && existingRun.status === "COMPLETED") {
        return {
            settlementRun: existingRun,
            alreadyRan: true
        };
    }
    // Create or update SettlementRun to RUNNING
    const settlementRun = await SettlementRun_1.SettlementRun.findOneAndUpdate({ runDate: normalizedRunDate }, {
        $set: {
            runType: "REGULAR",
            periodStart,
            periodEnd,
            status: "RUNNING",
            startedAt: new Date()
        }
    }, { new: true, upsert: true }).exec();
    let totalEntries = 0;
    let totalGrossPaise = 0;
    let totalNetPaise = 0;
    try {
        const vendors = await Vendor_1.Vendor.find({ status: { $in: ["ACTIVE", "VERIFIED"] } }).exec();
        for (const vendor of vendors) {
            const session = await mongoose_1.default.startSession();
            session.startTransaction();
            try {
                // Find unsettled sales for this vendor in period
                const sales = await VendorSale_1.VendorSale.find({
                    vendorId: vendor.id,
                    status: { $nin: ["REFUNDED", "CANCELLED", "SETTLED"] },
                    createdAt: { $gte: periodStart, $lte: periodEnd }
                }).session(session).exec();
                if (sales.length > 0) {
                    const breakdown = await calculateSettlementBreakdown(sales, vendor, {
                        isEarly: false,
                        periodEnd,
                        adminRatePctOverride,
                        session
                    });
                    const settlementStatus = vendor.payoutMethod === "WALLET" ? "COMPLETED" : "PAYOUT_DUE";
                    const settlementArr = await VendorSettlement_1.VendorSettlement.create([
                        {
                            vendorId: vendor.id,
                            settlementRunId: settlementRun.id,
                            grossSalesPaise: breakdown.grossSalesPaise,
                            marginPaise: breakdown.marginPaise,
                            postMarginPaise: breakdown.postMarginPaise,
                            adminChargePaise: breakdown.netAdminChargePaise,
                            volumeDiscountPaise: breakdown.volumeDiscountPaise,
                            earlyFeePaise: 0,
                            payoutBeforeTdsPaise: breakdown.payoutBeforeTdsPaise,
                            tdsPaise: breakdown.tdsPaise,
                            netPayablePaise: breakdown.netPayablePaise,
                            payoutMethod: vendor.payoutMethod,
                            status: settlementStatus,
                            periodStart,
                            periodEnd,
                            settledAt: new Date()
                        }
                    ], { session });
                    const settlement = settlementArr[0];
                    // Mark sales as SETTLED
                    await VendorSale_1.VendorSale.updateMany({ _id: { $in: sales.map(s => s._id) } }, { status: "SETTLED" }).session(session).exec();
                    // If WALLET method, credit member wallet
                    if (vendor.payoutMethod === "WALLET" && breakdown.netPayablePaise > 0) {
                        await walletService.credit(vendor.memberId, breakdown.netPayablePaise, "VENDOR_SETTLEMENT", settlement.id, `Weekly Vendor Settlement Payout for ${vendor.businessName}`, { session });
                    }
                    totalEntries++;
                    totalGrossPaise += breakdown.grossSalesPaise;
                    totalNetPaise += breakdown.netPayablePaise;
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
        // Release Weekly Member Commissions (Setu Kosh & Vendor Referral Bonus)
        const sessionRelease = await mongoose_1.default.startSession();
        sessionRelease.startTransaction();
        try {
            await setuKoshService.settlePending({ session: sessionRelease });
            await sessionRelease.commitTransaction();
        }
        catch (error) {
            await sessionRelease.abortTransaction();
            throw error;
        }
        finally {
            sessionRelease.endSession();
        }
        // Update SettlementRun as COMPLETED
        settlementRun.status = "COMPLETED";
        settlementRun.totalEntries = totalEntries;
        settlementRun.totalPaise = totalNetPaise;
        settlementRun.grossPaise = totalGrossPaise;
        settlementRun.netPaise = totalNetPaise;
        settlementRun.vendorCount = totalEntries;
        settlementRun.completedAt = new Date();
        await settlementRun.save();
        // Audit Log
        await AuditLog_1.AuditLog.create({
            actorId: actorId || undefined,
            actorType: actorId ? "ADMIN" : "SYSTEM",
            action: "WEEKLY_SETTLEMENT_COMPLETED",
            entityType: "SettlementRun",
            entityId: settlementRun.id,
            metadata: {
                periodStart,
                periodEnd,
                vendorCount: totalEntries,
                grossPaise: totalGrossPaise,
                netPaise: totalNetPaise
            }
        });
        return {
            settlementRun,
            totalEntries,
            grossPaise: totalGrossPaise,
            netPaise: totalNetPaise
        };
    }
    catch (error) {
        settlementRun.status = "FAILED";
        settlementRun.completedAt = new Date();
        await settlementRun.save();
        throw error;
    }
}
/**
 * On-demand Early Settlement for a specific vendor.
 */
async function processEarlySettlement(vendorId, options = {}) {
    const { adminRatePctOverride = null, actorId = null } = options;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const vendor = await Vendor_1.Vendor.findById(vendorId).session(session).exec();
        if (!vendor) {
            throw new Error(`Vendor ${vendorId} not found`);
        }
        // Find all unsettled sales
        const sales = await VendorSale_1.VendorSale.find({
            vendorId: vendor.id,
            status: { $nin: ["REFUNDED", "CANCELLED", "SETTLED"] }
        }).session(session).exec();
        if (sales.length === 0) {
            throw new Error("No unsettled sales available for early settlement");
        }
        const now = new Date();
        const periodStart = sales.reduce((min, s) => s.createdAt < min ? s.createdAt : min, sales[0].createdAt);
        const periodEnd = now;
        const breakdown = await calculateSettlementBreakdown(sales, vendor, {
            isEarly: true,
            periodEnd: now,
            adminRatePctOverride,
            session
        });
        // Create SettlementRun marked EARLY
        const settlementRunArr = await SettlementRun_1.SettlementRun.create([
            {
                runDate: now,
                runType: "EARLY",
                periodStart,
                periodEnd,
                status: "COMPLETED",
                totalEntries: 1,
                totalPaise: breakdown.netPayablePaise,
                grossPaise: breakdown.grossSalesPaise,
                netPaise: breakdown.netPayablePaise,
                vendorCount: 1,
                completedAt: now
            }
        ], { session });
        const settlementRun = settlementRunArr[0];
        const settlementStatus = vendor.payoutMethod === "WALLET" ? "COMPLETED" : "PAYOUT_DUE";
        const settlementArr = await VendorSettlement_1.VendorSettlement.create([
            {
                vendorId: vendor.id,
                settlementRunId: settlementRun.id,
                grossSalesPaise: breakdown.grossSalesPaise,
                marginPaise: breakdown.marginPaise,
                postMarginPaise: breakdown.postMarginPaise,
                adminChargePaise: breakdown.netAdminChargePaise,
                volumeDiscountPaise: breakdown.volumeDiscountPaise,
                earlyFeePaise: breakdown.earlyFeePaise,
                payoutBeforeTdsPaise: breakdown.payoutBeforeTdsPaise,
                tdsPaise: breakdown.tdsPaise,
                netPayablePaise: breakdown.netPayablePaise,
                payoutMethod: vendor.payoutMethod,
                status: settlementStatus,
                periodStart,
                periodEnd,
                settledAt: now
            }
        ], { session });
        const settlement = settlementArr[0];
        // Mark sales as SETTLED
        await VendorSale_1.VendorSale.updateMany({ _id: { $in: sales.map(s => s._id) } }, { status: "SETTLED" }).session(session).exec();
        // If WALLET, credit wallet
        if (vendor.payoutMethod === "WALLET" && breakdown.netPayablePaise > 0) {
            await walletService.credit(vendor.memberId, breakdown.netPayablePaise, "VENDOR_SETTLEMENT", settlement.id, `Early Vendor Settlement Payout for ${vendor.businessName} (Rs. 250 fee applied)`, { session });
        }
        // Audit Log
        await AuditLog_1.AuditLog.create([
            {
                actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId) : vendor.memberId,
                actorType: actorId ? "ADMIN" : "MEMBER",
                action: "EARLY_SETTLEMENT_EXECUTED",
                entityType: "VendorSettlement",
                entityId: settlement.id,
                metadata: {
                    vendorId: vendor.id,
                    grossSalesPaise: breakdown.grossSalesPaise,
                    earlyFeePaise: breakdown.earlyFeePaise,
                    netPayablePaise: breakdown.netPayablePaise
                }
            }
        ], { session });
        await session.commitTransaction();
        return settlement;
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
 * Inactivity Lifecycle Daily Sweep
 */
async function sweepVendorInactivity(currentDate = new Date()) {
    const vendors = await Vendor_1.Vendor.find({ status: { $in: ["ACTIVE", "INACTIVE", "FROZEN"] } }).exec();
    const companyWalletSetting = await adminService.getSetting("COMPANY_WALLET_MEMBER_ID", null).catch(() => null);
    const companyWalletTarget = companyWalletSetting || "COMPANY_WALLET";
    const results = {
        inactivated: 0,
        frozen: 0,
        closed: 0
    };
    const inactiveDaysLimit = await adminService.getSetting("VENDOR_INACTIVITY_INACTIVE_DAYS", 31, "integer");
    const frozenDaysLimit = await adminService.getSetting("VENDOR_INACTIVITY_FROZEN_DAYS", 91, "integer");
    const closedDaysLimit = await adminService.getSetting("VENDOR_INACTIVITY_CLOSED_DAYS", 181, "integer");
    for (const vendor of vendors) {
        const referenceDate = vendor.lastSaleAt || vendor.joinedAt;
        const diffMs = currentDate.getTime() - new Date(referenceDate).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= closedDaysLimit && vendor.status !== "CLOSED") {
            const session = await mongoose_1.default.startSession();
            session.startTransaction();
            try {
                vendor.status = "CLOSED";
                vendor.isDepositFrozen = true;
                await vendor.save({ session });
                // Ensure companyWalletTarget member exists
                await Member_1.Member.findOneAndUpdate({ _id: companyWalletTarget }, {
                    $setOnInsert: {
                        _id: companyWalletTarget,
                        name: "Company Reserve Wallet",
                        mobile: "0000000000",
                        status: "SYSTEM"
                    }
                }, { upsert: true, session }).exec();
                // Redirect pending vendor referral bonuses to COMPANY_WALLET
                await VendorReferralBonus_1.VendorReferralBonus.updateMany({ referredVendorId: vendor.id, status: "PENDING" }, { memberId: companyWalletTarget }).session(session).exec();
                await AuditLog_1.AuditLog.create([
                    {
                        actorType: "SYSTEM",
                        action: "VENDOR_LIFECYCLE_CLOSED",
                        entityType: "Vendor",
                        entityId: vendor.id,
                        metadata: { diffDays, previousStatus: vendor.status, redirectedTo: companyWalletTarget }
                    }
                ], { session });
                await session.commitTransaction();
            }
            catch (error) {
                await session.abortTransaction();
                throw error;
            }
            finally {
                session.endSession();
            }
            results.closed++;
        }
        else if (diffDays >= frozenDaysLimit && vendor.status !== "FROZEN" && vendor.status !== "CLOSED") {
            vendor.status = "FROZEN";
            vendor.isDepositFrozen = true;
            await vendor.save();
            await AuditLog_1.AuditLog.create({
                actorType: "SYSTEM",
                action: "VENDOR_LIFECYCLE_FROZEN",
                entityType: "Vendor",
                entityId: vendor.id,
                metadata: { diffDays, previousStatus: vendor.status }
            });
            results.frozen++;
        }
        else if (diffDays >= inactiveDaysLimit && vendor.status === "ACTIVE") {
            vendor.status = "INACTIVE";
            await vendor.save();
            await AuditLog_1.AuditLog.create({
                actorType: "SYSTEM",
                action: "VENDOR_LIFECYCLE_INACTIVE",
                entityType: "Vendor",
                entityId: vendor.id,
                metadata: { diffDays, previousStatus: vendor.status }
            });
            results.inactivated++;
        }
    }
    return results;
}
/**
 * Security Deposit Freeze Check:
 * Auto-freezes deposit if vendor wallet balance < Rs. 500.
 */
async function checkDepositFreeze(vendorId, options = {}) {
    const vendor = await Vendor_1.Vendor.findById(vendorId)
        .populate({
        path: "memberId",
        populate: { path: "mainWallet" }
    })
        .session(options.session || null)
        .exec();
    if (!vendor)
        return;
    const wallet = vendor.memberId?.mainWallet;
    const walletBalance = vendor.walletBalancePaise || wallet?.balancePaise || 0;
    if (walletBalance < exports.WALLET_MIN_BALANCE_PAISE && !vendor.isDepositFrozen) {
        vendor.isDepositFrozen = true;
        if (options.session)
            vendor.$session(options.session);
        await vendor.save();
    }
    else if (walletBalance >= exports.WALLET_MIN_BALANCE_PAISE && vendor.isDepositFrozen && vendor.status !== "FROZEN" && vendor.status !== "CLOSED") {
        vendor.isDepositFrozen = false;
        if (options.session)
            vendor.$session(options.session);
        await vendor.save();
    }
}
/**
 * Admin Fraud Penalty
 */
async function penalizeVendor(vendorId, penaltyType, transactionAmountPaise = 0, actorId = null) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const vendor = await Vendor_1.Vendor.findById(vendorId).session(session).exec();
        if (!vendor) {
            throw new Error(`Vendor ${vendorId} not found`);
        }
        let penaltyPaise = 0;
        const normType = (penaltyType || "").toUpperCase();
        if (normType === "FRAUD") {
            penaltyPaise = transactionAmountPaise * 10;
        }
        else if (normType === "TAMPERING") {
            penaltyPaise = transactionAmountPaise * 5;
        }
        else if (normType === "QR_REFUSAL") {
            penaltyPaise = 100000; // Flat Rs. 1,000
        }
        else {
            throw new Error(`Invalid penalty type: ${penaltyType}`);
        }
        // 1. Cover pending member commissions for this vendor from deposit first
        const pendingCommissions = await CommissionEntry_1.CommissionEntry.find({
            status: "PENDING_SETTLEMENT",
            idCardId: { $in: await MemberIdCard_1.MemberIdCard.find({ memberId: vendor.memberId }).select("_id").session(session) }
        }).session(session).exec();
        let depositRemaining = vendor.securityDepositPaise;
        let memberCommissionsCovered = 0;
        for (const comm of pendingCommissions) {
            if (depositRemaining >= comm.amountPaise) {
                depositRemaining -= comm.amountPaise;
                memberCommissionsCovered += comm.amountPaise;
            }
        }
        // 2. Forfeit remainder of penalty
        const penaltyDeducted = Math.min(depositRemaining, penaltyPaise);
        depositRemaining -= penaltyDeducted;
        const newStatus = normType === "FRAUD" ? "CLOSED" : vendor.status;
        vendor.securityDepositPaise = depositRemaining;
        vendor.status = newStatus;
        vendor.isDepositFrozen = depositRemaining < exports.SECURITY_DEPOSIT_PAISE;
        await vendor.save({ session });
        // 3. Write AuditLog
        await AuditLog_1.AuditLog.create([
            {
                actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId) : undefined,
                actorType: "ADMIN",
                action: `VENDOR_PENALTY_${normType}`,
                entityType: "Vendor",
                entityId: vendor.id,
                metadata: {
                    penaltyType: normType,
                    penaltyPaise,
                    memberCommissionsCovered,
                    penaltyDeductedFromDeposit: penaltyDeducted,
                    remainingDepositPaise: depositRemaining,
                    newStatus
                }
            }
        ], { session });
        await session.commitTransaction();
        return {
            vendor,
            penaltyType: normType,
            penaltyPaise,
            memberCommissionsCovered,
            penaltyDeducted,
            remainingDepositPaise: depositRemaining
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
