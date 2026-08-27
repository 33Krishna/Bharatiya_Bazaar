import { Member } from "../models/Member";
import { Withdrawal } from "../models/Withdrawal";
import { TdsLedger } from "../models/TdsLedger";
import { VendorSettlement } from "../models/VendorSettlement";
import { VendorReferralBonus } from "../models/VendorReferralBonus";
import { Voucher } from "../models/Voucher";
import * as adminService from "./adminService";
import mongoose from "mongoose";

// Section Thresholds (in Paise)
export const THRESHOLD_194H_PAISE = 2000000;   // ₹20,000
export const THRESHOLD_194R_PAISE = 2000000;   // ₹20,000
export const SINGLE_194C_PAISE = 3000000;      // ₹30,000
export const AGGREGATE_194C_PAISE = 10000000;  // ₹1,00,000

/**
 * Returns exact start and end timestamps for the Indian Financial Year (April 1 to March 31).
 */
export function getCurrentFinancialYearRange(date = new Date()): { startDate: Date; endDate: Date } {
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

export const getCurrentFYDateRange = getCurrentFinancialYearRange;

/**
 * Section 194H: Member Cash Commissions
 * ₹20k FY threshold (or dynamic), marginal method, 3% with PAN / KYC Tier 2 / Verified, 20% without.
 */
export async function calculate194HTds(
  memberId: string | mongoose.Types.ObjectId,
  requestGrossPaise: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const member = await Member.findById(memberId).session(options.session || null).exec();
  if (!member) {
    throw new Error(`Member with id ${memberId} not found`);
  }

  const thresholdPaise = await adminService.getSetting("TDS_194H_THRESHOLD_PAISE", THRESHOLD_194H_PAISE, "integer", options);
  const isPanVerified = member.panVerified || member.kycStatus === "VERIFIED" || member.kycTier === "TIER2";

  let rate = 0.03;
  if (isPanVerified) {
    const dynamicRate = await adminService.getSetting("TDS_194H_RATE_VERIFIED", 0.03, "number", options);
    rate = dynamicRate > 1 ? dynamicRate / 100 : dynamicRate;
  } else {
    const unverifiedRate = await adminService.getSetting("TDS_194H_RATE_UNVERIFIED", 0.20, "number", options);
    rate = unverifiedRate > 1 ? unverifiedRate / 100 : unverifiedRate;
  }

  const { startDate, endDate } = getCurrentFinancialYearRange();

  // Find all COMPLETED withdrawals in the current FY
  const pastWithdrawals = await Withdrawal.find({
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
    } else {
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
export async function calculate194R(
  memberId: string | mongoose.Types.ObjectId,
  newVoucherFaceValuePaise: number,
  currentVoucherId: string | null = null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const { startDate, endDate } = getCurrentFinancialYearRange();
  const thresholdPaise = await adminService.getSetting("TDS_194R_THRESHOLD_PAISE", THRESHOLD_194R_PAISE, "integer", options);
  const rawRate = await adminService.getSetting("TDS_194R_RATE", 0.10, "number", options);
  const rate = rawRate > 1 ? rawRate / 100 : rawRate;

  // 1. Get all vouchers redeemed in current FY
  const redeemedVouchers = await Voucher.find({
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
  const past194RLedger = await TdsLedger.find({
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
export async function create194RLiability(
  memberId: string | mongoose.Types.ObjectId,
  voucherFaceValuePaise: number,
  referenceId: string | null = null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const calc = await calculate194R(memberId, voucherFaceValuePaise, referenceId, options);

  if (calc.liabilityPaise > 0) {
    await TdsLedger.create(
      [
        {
          memberId,
          section: "SECTION_194R",
          amountPaise: calc.liabilityPaise,
          status: "PENDING",
          referenceId,
          financialYear: getCurrentFinancialYearRange().startDate.getFullYear().toString(),
        },
      ],
      { session: options.session }
    );
  }

  return calc;
}

/**
 * Section 194C: Vendor Payout TDS Calculation
 */
export async function calculate194C(
  vendorId: string | mongoose.Types.ObjectId,
  payoutBeforeTdsPaise: number,
  entityType = "INDIVIDUAL",
  hasPan = true,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const singleThreshold = await adminService.getSetting("TDS_194C_SINGLE_THRESHOLD_PAISE", SINGLE_194C_PAISE, "integer", options);
  const aggregateThreshold = await adminService.getSetting("TDS_194C_AGGREGATE_THRESHOLD_PAISE", AGGREGATE_194C_PAISE, "integer", options);

  let rate = 0.20;
  if (hasPan) {
    if (entityType.toUpperCase() === "COMPANY") {
      const compRate = await adminService.getSetting("TDS_194C_RATE_COMPANY", 0.02, "number", options);
      rate = compRate > 1 ? compRate / 100 : compRate;
    } else {
      const indRate = await adminService.getSetting("TDS_194C_RATE_INDIVIDUAL", 0.01, "number", options);
      rate = indRate > 1 ? indRate / 100 : indRate;
    }
  } else {
    const unvRate = await adminService.getSetting("TDS_194C_RATE_UNVERIFIED", 0.20, "number", options);
    rate = unvRate > 1 ? unvRate / 100 : unvRate;
  }

  const { startDate, endDate } = getCurrentFinancialYearRange();

  const pastSettlements = await VendorSettlement.find({
    vendorId,
    status: { $in: ["COMPLETED", "SETTLED", "PAYOUT_DUE"] },
    settledAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).session(options.session || null).exec();

  const priorAggregatePaise = pastSettlements.reduce(
    (sum, s) => sum + (s.payoutBeforeTdsPaise > 0 ? s.payoutBeforeTdsPaise : (s.grossSalesPaise || 0)),
    0
  );
  const totalAggregatePaise = priorAggregatePaise + payoutBeforeTdsPaise;

  const isSingleThresholdCrossed = payoutBeforeTdsPaise > singleThreshold;
  const isAggregateThresholdCrossed = totalAggregatePaise > aggregateThreshold;

  let taxablePaise = 0;

  if (isSingleThresholdCrossed || isAggregateThresholdCrossed) {
    if (priorAggregatePaise >= aggregateThreshold || isSingleThresholdCrossed) {
      taxablePaise = payoutBeforeTdsPaise;
    } else {
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
export async function calculate194HVendorReferralTds(
  memberId: string | mongoose.Types.ObjectId,
  bonusAmountPaise: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const member = await Member.findById(memberId).session(options.session || null).exec();
  const isPanVerified = member?.panVerified || member?.kycStatus === "VERIFIED" || member?.kycTier === "TIER2";
  const rate = isPanVerified ? 0.03 : 0.20;

  const { startDate, endDate } = getCurrentFinancialYearRange();

  const pastBonuses = await VendorReferralBonus.find({
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
  if (totalBonusPaise > THRESHOLD_194H_PAISE) {
    if (priorBonusPaise >= THRESHOLD_194H_PAISE) {
      taxablePaise = bonusAmountPaise;
    } else {
      taxablePaise = totalBonusPaise - THRESHOLD_194H_PAISE;
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
export async function getPending194RLiability(
  memberId: string | mongoose.Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<number> {
  const pendingEntries = await TdsLedger.find({
    memberId,
    section: "SECTION_194R",
    status: { $in: ["PENDING", "HELD"] }
  }).session(options.session || null).exec();

  return pendingEntries.reduce((sum, e) => sum + e.amountPaise, 0);
}

/**
 * Settles/recovers 194R liability up to maxDeductPaise.
 */
export async function recover194RLiability(
  memberId: string | mongoose.Types.ObjectId,
  maxDeductPaise: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<number> {
  if (maxDeductPaise <= 0) return 0;

  const pendingEntries = await TdsLedger.find({
    memberId,
    section: "SECTION_194R",
    status: { $in: ["PENDING", "HELD"] }
  }).sort({ createdAt: 1 }).session(options.session || null).exec();

  let remainingToDeduct = maxDeductPaise;
  let totalRecovered = 0;

  for (const entry of pendingEntries) {
    if (remainingToDeduct <= 0) break;

    if (entry.amountPaise <= remainingToDeduct) {
      entry.status = "RECOVERED";
      if (options.session) {
        entry.$session(options.session);
      }
      await entry.save();
      remainingToDeduct -= entry.amountPaise;
      totalRecovered += entry.amountPaise;
    } else {
      // Partial recovery: reduce amount on this entry and create a new RECOVERED entry
      const deductVal = remainingToDeduct;
      entry.amountPaise = entry.amountPaise - deductVal;
      if (options.session) {
        entry.$session(options.session);
      }
      await entry.save();

      await TdsLedger.create(
        [
          {
            memberId,
            section: "SECTION_194R",
            amountPaise: deductVal,
            status: "RECOVERED",
            referenceId: entry.referenceId,
            financialYear: entry.financialYear
          },
        ],
        { session: options.session }
      );

      totalRecovered += deductVal;
      remainingToDeduct = 0;
    }
  }

  return totalRecovered;
}

/**
 * Creates generic TdsLedger entry.
 */
export async function trackTDSLedger(
  { memberId, vendorId, section, amountPaise, status = "HELD", referenceId = null }: any,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const newEntryArr = await TdsLedger.create(
    [
      {
        memberId: memberId || undefined,
        vendorId: vendorId || undefined,
        section,
        amountPaise,
        status,
        referenceId: referenceId || undefined,
        financialYear: getCurrentFinancialYearRange().startDate.getFullYear().toString(),
      },
    ],
    { session: options.session }
  );
  return newEntryArr[0];
}

/**
 * Marks TDS entries associated with a withdrawal as DEPOSITED.
 */
export async function depositTDS(
  withdrawalId: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  return await TdsLedger.updateMany(
    {
      referenceId: withdrawalId,
      status: { $in: ["PENDING", "HELD"] }
    },
    { status: "DEPOSITED" }
  ).session(options.session || null).exec();
}

/**
 * Reverses TDS entries associated with a rejected withdrawal.
 */
export async function reverseTDS(
  withdrawalId: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  return await TdsLedger.updateMany(
    {
      referenceId: withdrawalId,
      status: { $in: ["PENDING", "HELD"] }
    },
    { status: "REVERSED" }
  ).session(options.session || null).exec();
}
