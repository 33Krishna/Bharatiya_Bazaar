"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSettings = listSettings;
exports.getSingleSetting = getSingleSetting;
exports.updateSettingValue = updateSettingValue;
exports.updateCategoryMarginReq = updateCategoryMarginReq;
exports.approveWithdrawalReq = approveWithdrawalReq;
exports.rejectWithdrawalReq = rejectWithdrawalReq;
exports.runSettlement = runSettlement;
exports.penalizeVendorReq = penalizeVendorReq;
exports.freezeVendorReq = freezeVendorReq;
exports.getLogs = getLogs;
exports.getDashboardStats = getDashboardStats;
exports.getReconciliationReport = getReconciliationReport;
exports.getPendingWithdrawalsReport = getPendingWithdrawalsReport;
exports.getTdsSummaryReport = getTdsSummaryReport;
exports.getSettlementsReport = getSettlementsReport;
exports.listAdminUsers = listAdminUsers;
exports.createAdminUser = createAdminUser;
exports.updateAdminUserRole = updateAdminUserRole;
exports.getPendingKyc = getPendingKyc;
exports.approveKyc = approveKyc;
exports.rejectKyc = rejectKyc;
const adminService_1 = require("../services/adminService");
const withdrawalService_1 = require("../services/withdrawalService");
const auditService_1 = require("../services/auditService");
const settlementService_1 = require("../services/settlementService");
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const AutoPoolNode_1 = require("../models/AutoPoolNode");
const Vendor_1 = require("../models/Vendor");
const Withdrawal_1 = require("../models/Withdrawal");
const TdsLedger_1 = require("../models/TdsLedger");
const AuditLog_1 = require("../models/AuditLog");
const AdminUser_1 = require("../models/AdminUser");
const Wallet_1 = require("../models/Wallet");
const CommissionEntry_1 = require("../models/CommissionEntry");
const LedgerEntry_1 = require("../models/LedgerEntry");
const VendorSettlement_1 = require("../models/VendorSettlement");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function listSettings(req, res, next) {
    try {
        const settings = await (0, adminService_1.getAllSettings)();
        res.json({
            success: true,
            data: settings
        });
    }
    catch (err) {
        next(err);
    }
}
async function getSingleSetting(req, res, next) {
    try {
        const { key } = req.params;
        const value = await (0, adminService_1.getSetting)(key, null);
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
    }
    catch (err) {
        next(err);
    }
}
async function updateSettingValue(req, res, next) {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        const adminId = req.admin?.id || "SYSTEM";
        const setting = await (0, adminService_1.updateSetting)(key, value, adminId, description);
        res.json({
            success: true,
            data: setting
        });
    }
    catch (err) {
        next(err);
    }
}
async function updateCategoryMarginReq(req, res, next) {
    try {
        const { category } = req.params;
        const { marginRatePct, applyToExisting = false, description } = req.body;
        const adminId = req.admin?.id || "SYSTEM";
        const result = await (0, adminService_1.updateCategoryMargin)(category, marginRatePct, applyToExisting, adminId, description);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
async function approveWithdrawalReq(req, res, next) {
    try {
        const { id } = req.params;
        const withdrawal = await (0, withdrawalService_1.completeWithdrawal)(id);
        res.json({
            success: true,
            data: withdrawal
        });
    }
    catch (err) {
        next(err);
    }
}
async function rejectWithdrawalReq(req, res, next) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const withdrawal = await (0, withdrawalService_1.rejectWithdrawal)(id, reason);
        res.json({
            success: true,
            data: withdrawal
        });
    }
    catch (err) {
        next(err);
    }
}
async function runSettlement(req, res, next) {
    try {
        const runDate = req.body.runDate ? new Date(req.body.runDate) : new Date();
        const result = await (0, settlementService_1.processWeeklySettlement)(runDate, {
            adminRatePctOverride: req.body.adminRatePctOverride ? parseFloat(req.body.adminRatePctOverride) : null,
            actorId: req.admin?.id || null
        });
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
async function penalizeVendorReq(req, res, next) {
    try {
        const { id } = req.params;
        const { penaltyType, transactionAmountPaise } = req.body;
        const result = await (0, settlementService_1.penalizeVendor)(id, penaltyType, parseInt(transactionAmountPaise) || 0, req.admin?.id || null);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
async function freezeVendorReq(req, res, next) {
    try {
        const { id } = req.params;
        const { freeze = true } = req.body;
        const vendor = await Vendor_1.Vendor.findByIdAndUpdate(id, {
            isDepositFrozen: freeze,
            status: freeze ? "FROZEN" : "ACTIVE"
        }, { new: true }).exec();
        if (!vendor) {
            return res.status(404).json({ success: false, error: { message: "Vendor not found" } });
        }
        await AuditLog_1.AuditLog.create({
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
    }
    catch (err) {
        next(err);
    }
}
async function getLogs(req, res, next) {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const logs = await (0, auditService_1.getAuditLogs)({}, limit);
        res.json({
            success: true,
            data: logs
        });
    }
    catch (err) {
        next(err);
    }
}
async function getDashboardStats(req, res, next) {
    try {
        const [totalMembers, totalIdCards, autopoolGlobalCount, activeVendors, pendingWithdrawals, pending194RAgg, recentLogs] = await Promise.all([
            Member_1.Member.countDocuments(),
            MemberIdCard_1.MemberIdCard.countDocuments(),
            AutoPoolNode_1.AutoPoolNode.countDocuments(),
            Vendor_1.Vendor.countDocuments({ status: { $in: ["ACTIVE", "VERIFIED"] } }),
            Withdrawal_1.Withdrawal.find({ status: "REQUESTED" }).select("grossPaise").exec(),
            TdsLedger_1.TdsLedger.aggregate([
                { $match: { section: "194R", status: { $in: ["HELD", "PENDING"] } } },
                { $group: { _id: null, total: { $sum: "$amountPaise" } } }
            ]).exec(),
            AuditLog_1.AuditLog.find({}).sort({ createdAt: -1 }).limit(10).exec()
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
    }
    catch (err) {
        next(err);
    }
}
async function getReconciliationReport(req, res, next) {
    try {
        const [walletAgg, heldCommissionsAgg, ledgerCredits, ledgerDebits] = await Promise.all([
            Wallet_1.Wallet.aggregate([
                { $group: { _id: null, total: { $sum: "$balancePaise" } } }
            ]).exec(),
            CommissionEntry_1.CommissionEntry.aggregate([
                { $match: { status: "HELD" } },
                { $group: { _id: null, total: { $sum: "$amountPaise" } } }
            ]).exec(),
            LedgerEntry_1.LedgerEntry.aggregate([
                { $match: { type: "CREDIT" } },
                { $group: { _id: null, total: { $sum: "$amountPaise" } } }
            ]).exec(),
            LedgerEntry_1.LedgerEntry.aggregate([
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
    }
    catch (err) {
        next(err);
    }
}
async function getPendingWithdrawalsReport(req, res, next) {
    try {
        const withdrawals = await Withdrawal_1.Withdrawal.find({ status: "REQUESTED" })
            .populate("memberId", "id name mobile memberCode kycStatus panNumber")
            .populate("idCardId", "id cardNumber type")
            .sort({ requestedAt: -1 })
            .exec();
        res.json({
            success: true,
            data: withdrawals
        });
    }
    catch (err) {
        next(err);
    }
}
async function getTdsSummaryReport(req, res, next) {
    try {
        const records = await TdsLedger_1.TdsLedger.aggregate([
            {
                $group: {
                    _id: { section: "$section", status: "$status" },
                    amountPaise: { $sum: "$amountPaise" },
                    count: { $sum: 1 }
                }
            }
        ]).exec();
        const summary = {
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
    }
    catch (err) {
        next(err);
    }
}
async function getSettlementsReport(req, res, next) {
    try {
        const settlements = await VendorSettlement_1.VendorSettlement.find({})
            .populate("vendorId", "id businessName category marginRatePct")
            .sort({ periodStart: -1 })
            .limit(100)
            .exec();
        res.json({
            success: true,
            data: settlements
        });
    }
    catch (err) {
        next(err);
    }
}
async function listAdminUsers(req, res, next) {
    try {
        const admins = await AdminUser_1.AdminUser.find({})
            .select("id email name role status createdAt")
            .sort({ createdAt: -1 })
            .exec();
        res.json({
            success: true,
            data: admins
        });
    }
    catch (err) {
        next(err);
    }
}
async function createAdminUser(req, res, next) {
    try {
        const { email, name, password, role = "ADMIN" } = req.body;
        const existing = await AdminUser_1.AdminUser.findOne({ email }).exec();
        if (existing) {
            return res.status(400).json({
                success: false,
                error: { code: "ALREADY_EXISTS", message: `Admin with email ${email} already exists` }
            });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const newAdminArr = await AdminUser_1.AdminUser.create([
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
        await AuditLog_1.AuditLog.create({
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
    }
    catch (err) {
        next(err);
    }
}
async function updateAdminUserRole(req, res, next) {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const targetAdmin = await AdminUser_1.AdminUser.findById(id).exec();
        if (!targetAdmin) {
            return res.status(404).json({
                success: false,
                error: { code: "NOT_FOUND", message: "Admin user not found" }
            });
        }
        targetAdmin.role = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
        await targetAdmin.save();
        const adminId = req.admin?.id || "SYSTEM";
        await AuditLog_1.AuditLog.create({
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
    }
    catch (err) {
        next(err);
    }
}
async function getPendingKyc(req, res, next) {
    try {
        const members = await Member_1.Member.find({ kycStatus: "PENDING" }).exec();
        res.json({ success: true, data: members });
    }
    catch (err) {
        next(err);
    }
}
async function approveKyc(req, res, next) {
    try {
        const { id } = req.params;
        const member = await Member_1.Member.findByIdAndUpdate(id, { kycStatus: "VERIFIED", panVerified: true }, { new: true }).exec();
        if (!member)
            return res.status(404).json({ success: false, error: { message: "Member not found" } });
        const adminId = req.admin?.id || "SYSTEM";
        await AuditLog_1.AuditLog.create({
            actorId: adminId,
            actorType: "ADMIN",
            action: "MEMBER_KYC_APPROVE",
            entityType: "Member",
            entityId: id,
            metadata: { name: member.name }
        });
        res.json({ success: true, data: member });
    }
    catch (err) {
        next(err);
    }
}
async function rejectKyc(req, res, next) {
    try {
        const { id } = req.params;
        const member = await Member_1.Member.findByIdAndUpdate(id, { kycStatus: "REJECTED", panVerified: false }, { new: true }).exec();
        if (!member)
            return res.status(404).json({ success: false, error: { message: "Member not found" } });
        const adminId = req.admin?.id || "SYSTEM";
        await AuditLog_1.AuditLog.create({
            actorId: adminId,
            actorType: "ADMIN",
            action: "MEMBER_KYC_REJECT",
            entityType: "Member",
            entityId: id,
            metadata: { name: member.name }
        });
        res.json({ success: true, data: member });
    }
    catch (err) {
        next(err);
    }
}
