import { Request, Response, NextFunction } from "express";
import { getAllSettings, getSetting, updateSetting, updateCategoryMargin } from "../services/adminService";
import { completeWithdrawal, rejectWithdrawal } from "../services/withdrawalService";
import { getAuditLogs } from "../services/auditService";
import { processWeeklySettlement, penalizeVendor } from "../services/settlementService";
import { Member } from "../models/Member";
import { MemberIdCard } from "../models/MemberIdCard";
import { AutoPoolNode } from "../models/AutoPoolNode";
import { Vendor } from "../models/Vendor";
import { Withdrawal } from "../models/Withdrawal";
import { TdsLedger } from "../models/TdsLedger";
import { AuditLog } from "../models/AuditLog";
import { AdminUser } from "../models/AdminUser";
import { Wallet } from "../models/Wallet";
import { CommissionEntry } from "../models/CommissionEntry";
import { LedgerEntry } from "../models/LedgerEntry";
import { VendorSettlement } from "../models/VendorSettlement";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

export async function listSettings(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const settings = await getAllSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    next(err);
  }
}

export async function getSingleSetting(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { key } = req.params;
    const value = await getSetting(key, null);
    if (value === null) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `Setting ${key} not found` }
      });
    }
    res.json({
      success: true,
      data: { key, value }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSettingValue(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    const adminId = req.admin?.id || "SYSTEM";
    const setting = await updateSetting(key, value, adminId, description);
    res.json({
      success: true,
      data: setting
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCategoryMarginReq(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { category } = req.params;
    const { marginRatePct, applyToExisting = false, description } = req.body;
    const adminId = req.admin?.id || "SYSTEM";
    const result = await updateCategoryMargin(category, marginRatePct, applyToExisting, adminId, description);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function approveWithdrawalReq(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const withdrawal = await completeWithdrawal(id);
    res.json({
      success: true,
      data: withdrawal
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectWithdrawalReq(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const withdrawal = await rejectWithdrawal(id, reason);
    res.json({
      success: true,
      data: withdrawal
    });
  } catch (err) {
    next(err);
  }
}

export async function runSettlement(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const runDate = req.body.runDate ? new Date(req.body.runDate) : new Date();
    const result = await processWeeklySettlement(runDate, {
      adminRatePctOverride: req.body.adminRatePctOverride ? parseFloat(req.body.adminRatePctOverride) : null,
      actorId: req.admin?.id || null
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function penalizeVendorReq(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const { penaltyType, transactionAmountPaise } = req.body;
    const result = await penalizeVendor(id, penaltyType, parseInt(transactionAmountPaise) || 0, req.admin?.id || null);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function freezeVendorReq(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const { freeze = true } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      {
        isDepositFrozen: freeze,
        status: freeze ? "FROZEN" : "ACTIVE"
      },
      { new: true }
    ).exec();

    if (!vendor) {
      return res.status(404).json({ success: false, error: { message: "Vendor not found" } });
    }

    await AuditLog.create({
      actorId: req.admin?.id,
      actorType: "ADMIN",
      action: freeze ? "VENDOR_MANUAL_FREEZE" : "VENDOR_MANUAL_UNFREEZE",
      entityType: "Vendor",
      entityId: id,
      metadata: { status: vendor.status, isDepositFrozen: vendor.isDepositFrozen }
    });

    res.json({
      success: true,
      data: vendor
    });
  } catch (err) {
    next(err);
  }
}

export async function getLogs(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await getAuditLogs({}, limit);
    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const [
      totalMembers,
      totalIdCards,
      autopoolGlobalCount,
      activeVendors,
      pendingWithdrawals,
      pending194RAgg,
      recentLogs
    ] = await Promise.all([
      Member.countDocuments(),
      MemberIdCard.countDocuments(),
      AutoPoolNode.countDocuments(),
      Vendor.countDocuments({ status: { $in: ["ACTIVE", "VERIFIED"] } }),
      Withdrawal.find({ status: "REQUESTED" }).select("grossPaise").exec(),
      TdsLedger.aggregate([
        { $match: { section: "194R", status: { $in: ["HELD", "PENDING"] } } },
        { $group: { _id: null, total: { $sum: "$amountPaise" } } }
      ]).exec(),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(10).exec()
    ]);

    const pendingWithdrawalsCount = pendingWithdrawals.length;
    const pendingWithdrawalsAmountPaise = pendingWithdrawals.reduce((sum, w) => sum + w.grossPaise, 0);
    const pending194RPaise = pending194RAgg.length > 0 ? pending194RAgg[0].total : 0;

    res.json({
      success: true,
      data: {
        totalMembers,
        totalIdCards,
        autopoolGlobalPosition: autopoolGlobalCount,
        activeVendors,
        pendingWithdrawalsCount,
        pendingWithdrawalsAmountPaise,
        pending194RPaise,
        recentLogs
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getReconciliationReport(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const [walletAgg, heldCommissionsAgg, ledgerCredits, ledgerDebits] = await Promise.all([
      Wallet.aggregate([
        { $group: { _id: null, total: { $sum: "$balancePaise" } } }
      ]).exec(),
      CommissionEntry.aggregate([
        { $match: { status: "HELD" } },
        { $group: { _id: null, total: { $sum: "$amountPaise" } } }
      ]).exec(),
      LedgerEntry.aggregate([
        { $match: { type: "CREDIT" } },
        { $group: { _id: null, total: { $sum: "$amountPaise" } } }
      ]).exec(),
      LedgerEntry.aggregate([
        { $match: { type: "DEBIT" } },
        { $group: { _id: null, total: { $sum: "$amountPaise" } } }
      ]).exec()
    ]);

    const totalWalletsBalancePaise = walletAgg.length > 0 ? walletAgg[0].total : 0;
    const totalWalletsOnHoldPaise = heldCommissionsAgg.length > 0 ? heldCommissionsAgg[0].total : 0;
    const totalWalletLiabilitiesPaise = totalWalletsBalancePaise;

    const totalCreditsPaise = ledgerCredits.length > 0 ? ledgerCredits[0].total : 0;
    const totalDebitsPaise = ledgerDebits.length > 0 ? ledgerDebits[0].total : 0;
    const netLedgerBalancePaise = totalCreditsPaise - totalDebitsPaise;

    const variancePaise = Math.abs(totalWalletLiabilitiesPaise - netLedgerBalancePaise);
    const isReconciled = variancePaise === 0;

    res.json({
      success: true,
      data: {
        totalWalletsBalancePaise,
        totalWalletsOnHoldPaise,
        totalWalletLiabilitiesPaise,
        totalCreditsPaise,
        totalDebitsPaise,
        netLedgerBalancePaise,
        variancePaise,
        isReconciled,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getPendingWithdrawalsReport(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const withdrawals = await Withdrawal.find({ status: "REQUESTED" })
      .populate("memberId", "id name mobile memberCode kycStatus panNumber")
      .populate("idCardId", "id cardNumber type")
      .sort({ requestedAt: -1 })
      .exec();

    res.json({
      success: true,
      data: withdrawals
    });
  } catch (err) {
    next(err);
  }
}

export async function getTdsSummaryReport(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const records = await TdsLedger.aggregate([
      {
        $group: {
          _id: { section: "$section", status: "$status" },
          amountPaise: { $sum: "$amountPaise" },
          count: { $sum: 1 }
        }
      }
    ]).exec();

    const summary: Record<string, any> = {
      "SECTION_194H": { HELD: 0, DEPOSITED: 0, REVERSED: 0, total: 0 },
      "SECTION_194R": { HELD: 0, DEPOSITED: 0, REVERSED: 0, total: 0 },
      "SECTION_194C": { HELD: 0, DEPOSITED: 0, REVERSED: 0, total: 0 }
    };

    records.forEach(r => {
      const sec = r._id.section;
      const st = r._id.status;
      const amt = r.amountPaise || 0;
      if (summary[sec]) {
        summary[sec][st] = amt;
        if (st === "HELD" || st === "DEPOSITED" || st === "PENDING") {
          summary[sec].total += amt;
        }
      }
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
}

export async function getSettlementsReport(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const settlements = await VendorSettlement.find({})
      .populate("vendorId", "id businessName category marginRatePct")
      .sort({ periodStart: -1 })
      .limit(100)
      .exec();

    res.json({
      success: true,
      data: settlements
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdminUsers(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const admins = await AdminUser.find({})
      .select("id email name role status createdAt")
      .sort({ createdAt: -1 })
      .exec();

    res.json({
      success: true,
      data: admins
    });
  } catch (err) {
    next(err);
  }
}

export async function createAdminUser(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { email, name, password, role = "ADMIN" } = req.body;
    const existing = await AdminUser.findOne({ email }).exec();
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: "ALREADY_EXISTS", message: `Admin with email ${email} already exists` }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newAdminArr = await AdminUser.create([
      {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        passwordHash,
        role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
        status: "ACTIVE"
      }
    ]);
    const newAdmin = newAdminArr[0];

    const adminId = req.admin?.id || "SYSTEM";
    await AuditLog.create({
      actorId: adminId,
      actorType: "ADMIN",
      action: "ADMIN_USER_CREATE",
      entityType: "AdminUser",
      entityId: newAdmin.id,
      metadata: { email: newAdmin.email, role: newAdmin.role }
    });

    res.status(201).json({
      success: true,
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        status: newAdmin.status,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminUserRole(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const targetAdmin = await AdminUser.findById(id).exec();
    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Admin user not found" }
      });
    }

    targetAdmin.role = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
    await targetAdmin.save();

    const adminId = req.admin?.id || "SYSTEM";
    await AuditLog.create({
      actorId: adminId,
      actorType: "ADMIN",
      action: "ADMIN_USER_ROLE_CHANGE",
      entityType: "AdminUser",
      entityId: id,
      metadata: { beforeRole: targetAdmin.role, afterRole: targetAdmin.role }
    });

    res.json({
      success: true,
      data: {
        id: targetAdmin.id,
        email: targetAdmin.email,
        name: targetAdmin.name,
        role: targetAdmin.role,
        status: targetAdmin.status,
        updatedAt: targetAdmin.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getPendingKyc(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const members = await Member.find({ kycStatus: "PENDING" }).exec();
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
}

export async function approveKyc(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndUpdate(
      id,
      { kycStatus: "VERIFIED", panVerified: true },
      { new: true }
    ).exec();

    if (!member) return res.status(404).json({ success: false, error: { message: "Member not found" } });

    const adminId = req.admin?.id || "SYSTEM";
    await AuditLog.create({
      actorId: adminId,
      actorType: "ADMIN",
      action: "MEMBER_KYC_APPROVE",
      entityType: "Member",
      entityId: id,
      metadata: { name: member.name }
    });

    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function rejectKyc(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndUpdate(
      id,
      { kycStatus: "REJECTED", panVerified: false },
      { new: true }
    ).exec();

    if (!member) return res.status(404).json({ success: false, error: { message: "Member not found" } });

    const adminId = req.admin?.id || "SYSTEM";
    await AuditLog.create({
      actorId: adminId,
      actorType: "ADMIN",
      action: "MEMBER_KYC_REJECT",
      entityType: "Member",
      entityId: id,
      metadata: { name: member.name }
    });

    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

