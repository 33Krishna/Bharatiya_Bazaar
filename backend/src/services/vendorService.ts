import { Vendor } from "../models/Vendor";
import { VendorReferralBonus } from "../models/VendorReferralBonus";
import * as setuKoshService from "./setuKoshService";
import * as adminService from "./adminService";
import mongoose from "mongoose";

export const DEFAULT_CATEGORY_MARGINS: Record<string, number> = {
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
export async function getCategoryMargin(
  category = "GENERAL",
  options: { session?: mongoose.ClientSession } = {}
): Promise<number> {
  const normCat = (category || "GENERAL").toUpperCase();
  const settingKey = `CATEGORY_MARGIN_${normCat}`;
  const legacyKey = `VENDOR_MARGIN_${normCat}`;

  const dynamicMargin =
    (await adminService.getSetting(settingKey, null, "string", options)) ||
    (await adminService.getSetting(legacyKey, null, "string", options));

  if (dynamicMargin !== null && dynamicMargin !== undefined) {
    return parseFloat(dynamicMargin);
  }

  return DEFAULT_CATEGORY_MARGINS[normCat] ?? 10.0;
}

/**
 * Registers a new vendor with category margin and permanent referral binding.
 */
export async function registerVendor(data: {
  memberId: string | mongoose.Types.ObjectId;
  businessName: string;
  category?: string;
  gstin?: string;
  address?: string;
  pinCode?: string;
  marginRatePct?: number;
  payoutMethod?: string;
  referredByMemberId?: string | mongoose.Types.ObjectId | null;
}): Promise<any> {
  const {
    memberId,
    businessName,
    category = "GENERAL",
    gstin,
    address,
    pinCode,
    marginRatePct,
    payoutMethod,
    referredByMemberId = null
  } = data;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const resolvedMargin = marginRatePct ?? (await getCategoryMargin(category, { session }));

    const existing = await Vendor.findOne({ memberId }).session(session).exec();
    if (existing) {
      throw new Error(`Member ${memberId} is already registered as a vendor`);
    }

    const vendorArr = await Vendor.create(
      [
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
      ],
      { session }
    );
    const vendor = vendorArr[0];

    // Permanent first-referrer binding
    if (referredByMemberId) {
      const existingRef = await VendorReferralBonus.findOne({ referredVendorId: vendor.id })
        .session(session)
        .exec();

      if (!existingRef) {
        await VendorReferralBonus.create(
          [
            {
              memberId: referredByMemberId,
              referredVendorId: vendor.id,
              bonusPaise: 0,
              status: "ACTIVE"
            }
          ],
          { session }
        );
      }
    }

    await session.commitTransaction();
    return vendor;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Delegate purchase to setuKoshService.recordPurchase.
 */
export async function processMemberPurchase(
  memberId: string | mongoose.Types.ObjectId,
  vendorId: string | mongoose.Types.ObjectId,
  amountPaise: number,
  options: any = {}
): Promise<any> {
  return await setuKoshService.recordPurchase(memberId, vendorId, amountPaise, options);
}
