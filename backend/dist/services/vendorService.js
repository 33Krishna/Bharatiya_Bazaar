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
exports.DEFAULT_CATEGORY_MARGINS = void 0;
exports.getCategoryMargin = getCategoryMargin;
exports.registerVendor = registerVendor;
exports.processMemberPurchase = processMemberPurchase;
const Vendor_1 = require("../models/Vendor");
const VendorReferralBonus_1 = require("../models/VendorReferralBonus");
const setuKoshService = __importStar(require("./setuKoshService"));
const adminService = __importStar(require("./adminService"));
const mongoose_1 = __importDefault(require("mongoose"));
exports.DEFAULT_CATEGORY_MARGINS = {
    GROCERY: 7.0,
    APPAREL: 15.0,
    ELECTRONICS: 10.0,
    RESTAURANT: 12.0,
    HEALTHCARE: 10.0,
    SERVICES: 20.0,
    GENERAL: 10.0
};
/**
 * Resolves category margin percentage from PlatformSettings or default.
 */
async function getCategoryMargin(category = "GENERAL", options = {}) {
    const normCat = (category || "GENERAL").toUpperCase();
    const settingKey = `CATEGORY_MARGIN_${normCat}`;
    const legacyKey = `VENDOR_MARGIN_${normCat}`;
    const dynamicMargin = (await adminService.getSetting(settingKey, null, "string", options)) ||
        (await adminService.getSetting(legacyKey, null, "string", options));
    if (dynamicMargin !== null && dynamicMargin !== undefined) {
        return parseFloat(dynamicMargin);
    }
    return exports.DEFAULT_CATEGORY_MARGINS[normCat] ?? 10.0;
}
/**
 * Registers a new vendor with category margin and permanent referral binding.
 */
async function registerVendor(data) {
    const { memberId, businessName, category = "GENERAL", gstin, address, pinCode, marginRatePct, payoutMethod, referredByMemberId = null } = data;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const resolvedMargin = marginRatePct ?? (await getCategoryMargin(category, { session }));
        const existing = await Vendor_1.Vendor.findOne({ memberId }).session(session).exec();
        if (existing) {
            throw new Error(`Member ${memberId} is already registered as a vendor`);
        }
        const vendorArr = await Vendor_1.Vendor.create([
            {
                memberId,
                businessName,
                category: category.toUpperCase(),
                gstin,
                address,
                pinCode,
                marginRatePct: resolvedMargin,
                payoutMethod: payoutMethod || "BANK",
                status: "ACTIVE"
            }
        ], { session });
        const vendor = vendorArr[0];
        // Permanent first-referrer binding
        if (referredByMemberId) {
            const existingRef = await VendorReferralBonus_1.VendorReferralBonus.findOne({ referredVendorId: vendor.id })
                .session(session)
                .exec();
            if (!existingRef) {
                await VendorReferralBonus_1.VendorReferralBonus.create([
                    {
                        memberId: referredByMemberId,
                        referredVendorId: vendor.id,
                        bonusPaise: 0,
                        status: "ACTIVE"
                    }
                ], { session });
            }
        }
        await session.commitTransaction();
        return vendor;
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
 * Delegate purchase to setuKoshService.recordPurchase.
 */
async function processMemberPurchase(memberId, vendorId, amountPaise, options = {}) {
    return await setuKoshService.recordPurchase(memberId, vendorId, amountPaise, options);
}
