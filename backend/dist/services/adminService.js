"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSuperAdminOnly = isSuperAdminOnly;
exports.getSetting = getSetting;
exports.getSettingNumber = getSettingNumber;
exports.getSettingBoolean = getSettingBoolean;
exports.invalidateCache = invalidateCache;
exports.getAllSettings = getAllSettings;
exports.updateSetting = updateSetting;
exports.updateCategoryMargin = updateCategoryMargin;
const PlatformSetting_1 = require("../models/PlatformSetting");
const AdminUser_1 = require("../models/AdminUser");
const Vendor_1 = require("../models/Vendor");
const auditService_1 = require("./auditService");
const mongoose_1 = __importDefault(require("mongoose"));
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const SUPER_ADMIN_ONLY_PREFIXES = ["TDS_", "VENDOR_INACTIVITY_"];
const SUPER_ADMIN_ONLY_KEYS = [
    "MY_SYSTEM_7DAY_HOLD",
    "AUTOPOOL_LOCKED_BEFORE_ACB",
    "REBIRTH_WITHDRAWAL_REQUIRES_MAIN_ACB",
    "COMPANY_WALLET_MEMBER_ID"
];
function isSuperAdminOnly(key) {
    if (SUPER_ADMIN_ONLY_KEYS.includes(key))
        return true;
    if (SUPER_ADMIN_ONLY_PREFIXES.some(p => key.startsWith(p)))
        return true;
    return false;
}
function parseSettingValue(rawVal, type) {
    if (rawVal === undefined || rawVal === null)
        return rawVal;
    switch (type) {
        case "integer":
            return parseInt(rawVal, 10);
        case "number":
        case "float":
            return parseFloat(rawVal);
        case "boolean":
            return rawVal === "true" || rawVal === true || rawVal === "1" || rawVal === 1;
        case "json":
            try {
                return typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
            }
            catch (e) {
                return rawVal;
            }
        default:
            return String(rawVal);
    }
}
/**
 * Get a platform setting by key with in-memory caching (<= 60s TTL).
 */
async function getSetting(key, defaultValue, type = "string", options = {}) {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return parseSettingValue(cached.value, type);
    }
    const query = PlatformSetting_1.PlatformSetting.findOne({ key });
    if (options.session) {
        query.session(options.session);
    }
    const setting = await query.exec();
    if (!setting) {
        return defaultValue;
    }
    cache.set(key, {
        value: setting.value,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
    return parseSettingValue(setting.value, type);
}
async function getSettingNumber(key, defaultValue, options = {}) {
    return await getSetting(key, defaultValue, "number", options);
}
async function getSettingBoolean(key, defaultValue, options = {}) {
    return await getSetting(key, defaultValue, "boolean", options);
}
function invalidateCache(key = null) {
    if (key) {
        cache.delete(key);
    }
    else {
        cache.clear();
    }
}
/**
 * Retrieve all platform settings from the database.
 */
async function getAllSettings() {
    return await PlatformSetting_1.PlatformSetting.find({}).sort({ key: 1 }).exec();
}
/**
 * Update a platform setting with RBAC checks and immutable audit logging.
 */
async function updateSetting(key, value, adminId, description = null, options = {}) {
    const adminQuery = AdminUser_1.AdminUser.findById(adminId);
    if (options.session) {
        adminQuery.session(options.session);
    }
    const admin = await adminQuery.exec();
    if (!admin) {
        const err = new Error("Admin user not found.");
        err.status = 401;
        err.code = "UNAUTHORIZED";
        throw err;
    }
    const normRole = (admin.role || "").toUpperCase();
    // RBAC: Only SUPER_ADMIN can update financial/TDS/system lifecycle settings
    if (isSuperAdminOnly(key) && normRole !== "SUPER_ADMIN") {
        const err = new Error(`Unauthorized: Only SUPER_ADMIN can update ${key}.`);
        err.status = 403;
        err.code = "FORBIDDEN";
        throw err;
    }
    const settingQuery = PlatformSetting_1.PlatformSetting.findOne({ key });
    if (options.session) {
        settingQuery.session(options.session);
    }
    const existingSetting = await settingQuery.exec();
    const oldValue = existingSetting ? existingSetting.value : null;
    const strValue = String(value);
    let updatedSetting;
    if (existingSetting) {
        existingSetting.value = strValue;
        if (description !== null) {
            existingSetting.description = description;
        }
        existingSetting.updatedBy = admin.id;
        if (options.session) {
            existingSetting.$session(options.session);
        }
        updatedSetting = await existingSetting.save();
    }
    else {
        const newSettingArr = await PlatformSetting_1.PlatformSetting.create([
            {
                key,
                value: strValue,
                description: description || undefined,
                updatedBy: admin.id,
            },
        ], { session: options.session });
        updatedSetting = newSettingArr[0];
    }
    // Invalidate Cache
    invalidateCache(key);
    // Write immutable AuditLog
    await (0, auditService_1.logAction)({
        action: "SETTINGS_UPDATED",
        actorType: "ADMIN",
        actorId: admin.id,
        entityType: "PlatformSetting",
        entityId: updatedSetting.id,
        metadata: {
            key,
            oldValue,
            newValue: strValue,
            reason: description
        }
    });
    return updatedSetting;
}
/**
 * Category margin update with applyToExisting toggle.
 * ON (true) -> updates existing vendors' marginRatePct (past sales snapshots untouched).
 * OFF (false) -> existing vendors keep old rate; new vendors get new rate.
 */
async function updateCategoryMargin(category, marginRatePct, applyToExisting = false, adminId, description = null) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const admin = await AdminUser_1.AdminUser.findById(adminId).session(session).exec();
        if (!admin) {
            const err = new Error("Admin user not found.");
            err.status = 401;
            err.code = "UNAUTHORIZED";
            throw err;
        }
        const normCat = (category || "").toUpperCase();
        const key = `CATEGORY_MARGIN_${normCat}`;
        const rateVal = parseFloat(String(marginRatePct));
        // 1. Update PlatformSetting
        const setting = await updateSetting(key, String(rateVal), adminId, description || `Category margin for ${normCat}`, { session });
        let updatedVendorsCount = 0;
        // 2. If applyToExisting is ON, update all existing vendors in that category
        if (applyToExisting) {
            const updateRes = await Vendor_1.Vendor.updateMany({ category: normCat }, { marginRatePct: rateVal }).session(session);
            updatedVendorsCount = updateRes.modifiedCount;
        }
        // 3. Log Audit
        await (0, auditService_1.logAction)({
            action: "CATEGORY_MARGIN_UPDATED",
            actorType: "ADMIN",
            actorId: admin.id,
            entityType: "Category",
            entityId: normCat,
            metadata: {
                category: normCat,
                marginRatePct: rateVal,
                applyToExisting,
                updatedVendorsCount
            }
        });
        await session.commitTransaction();
        return {
            setting,
            category: normCat,
            marginRatePct: rateVal,
            applyToExisting,
            updatedVendorsCount
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
