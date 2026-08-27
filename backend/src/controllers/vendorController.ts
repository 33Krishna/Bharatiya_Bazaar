import { Request, Response, NextFunction } from "express";
import { processMemberPurchase, registerVendor } from "../services/vendorService";
import { processEarlySettlement } from "../services/settlementService";
import { Member } from "../models/Member";
import { MemberIdCard } from "../models/MemberIdCard";
import { Vendor } from "../models/Vendor";
import { VendorSale } from "../models/VendorSale";
import { VendorSettlement } from "../models/VendorSettlement";
import { Wallet } from "../models/Wallet";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

export async function register(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const {
      name,
      businessName,
      mobile,
      password,
      category = "GENERAL",
      entityType = "INDIVIDUAL",
      panNumber,
      gstin,
      address,
      pinCode,
      payoutMethod = "BANK",
      referrerCode,
      referrerMemberCode
    } = req.body;

    const trimmedMobile = String(mobile || "").trim();

    // 1. Resolve Referrer Member if code provided
    let referredByMemberId: string | null = null;
    const refCode = (referrerCode || referrerMemberCode || "").trim();
    if (refCode) {
      const referrer = await Member.findOne({
        $or: [
          { memberCode: refCode },
          { mobile: refCode }
        ]
      }).exec();
      if (referrer) {
        referredByMemberId = referrer.id;
      }
    }

    // 2. Find or Create Owner Member
    let member = await Member.findOne({ mobile: trimmedMobile }).exec();
    const vendorExists = member ? await Vendor.findOne({ memberId: member.id }).exec() : null;

    if (member && vendorExists) {
      return res.status(400).json({
        success: false,
        error: { code: "ALREADY_REGISTERED", message: `Mobile ${trimmedMobile} is already registered as a vendor` }
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (!member) {
      const memberCode = `M${trimmedMobile.slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      
      const memberArr = await Member.create([
        {
          name: name.trim(),
          mobile: trimmedMobile,
          memberCode,
          passwordHash,
          panNumber: panNumber ? panNumber.trim().toUpperCase() : undefined,
          panVerified: !!panNumber,
          kycStatus: "VERIFIED",
          pinCode: pinCode ? String(pinCode).trim() : undefined,
          address: address ? address.trim() : undefined
        }
      ]);
      member = memberArr[0];
      
      await Wallet.create([{ memberId: member.id, balancePaise: 0 }]);
    } else if (!member.passwordHash) {
      member.passwordHash = passwordHash;
      await member.save();
    }

    // 3. Register Vendor via Service
    const vendor = await registerVendor({
      memberId: member.id,
      businessName: businessName.trim(),
      category: (category || "GENERAL").toUpperCase(),
      gstin: gstin ? gstin.trim().toUpperCase() : undefined,
      address: address ? address.trim() : undefined,
      pinCode: pinCode ? String(pinCode).trim() : undefined,
      payoutMethod: (payoutMethod || "BANK").toUpperCase(),
      referredByMemberId
    });

    res.status(201).json({
      success: true,
      data: {
        vendor,
        member: {
          id: member.id,
          name: member.name,
          mobile: member.mobile,
          memberCode: member.memberCode
        },
        vendorCode: vendor.id
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { mobile, password } = req.body;
    const input = (mobile || "").trim();

    const member = await Member.findOne({
      $or: [
        { mobile: input },
        { memberCode: input }
      ]
    }).exec();

    if (!member || !member.passwordHash) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" }
      });
    }

    const vendor = await Vendor.findOne({ memberId: member.id }).exec();
    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid credentials or not registered as vendor" }
      });
    }

    const validPassword = await bcrypt.compare(password, member.passwordHash);
    if (!validPassword && password !== member.passwordHash) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" }
      });
    }

    const token = jwt.sign({
      id: member.id,
      vendorId: vendor.id,
      type: "VENDOR"
    }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      data: {
        vendor,
        member: {
          id: member.id,
          name: member.name,
          mobile: member.mobile,
          memberCode: member.memberCode
        },
        token
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const vendor = req.vendor;
    const member = req.member;

    if (!vendor || !member) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }

    const salesAgg = await VendorSale.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(vendor.id) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amountPaise: { $sum: "$amountPaise" },
          marginPaise: { $sum: "$marginPaise" }
        }
      }
    ]).exec();

    const stats = salesAgg.length > 0 ? salesAgg[0] : { count: 0, amountPaise: 0, marginPaise: 0 };
    const wallet = await Wallet.findOne({ memberId: member.id }).exec();

    res.json({
      success: true,
      data: {
        vendor,
        member: {
          id: member.id,
          name: member.name,
          mobile: member.mobile,
          memberCode: member.memberCode,
          panNumber: member.panNumber
        },
        walletBalancePaise: wallet?.balancePaise || vendor.walletBalancePaise || 0,
        totalSalesCount: stats.count,
        totalSalesPaise: stats.amountPaise,
        totalMarginPaise: stats.marginPaise
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function recordSale(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const {
      memberId,
      buyerCode,
      cardNumber,
      memberCode,
      amountPaise,
      idCardId,
      idempotencyKey
    } = req.body;

    const vendor = req.vendor;
    if (!vendor) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }

    if (vendor.status === "FROZEN" || vendor.status === "CLOSED") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: `Vendor account is ${vendor.status}. Sales recording disabled.` }
      });
    }

    let resolvedMemberId = memberId;
    let resolvedCardId = idCardId;

    const lookupQuery = (buyerCode || cardNumber || memberCode || "").trim();
    if (!resolvedMemberId && lookupQuery) {
      const card = await MemberIdCard.findOne({
        $or: [
          { cardNumber: lookupQuery }
        ]
      }).exec();

      if (card) {
        resolvedMemberId = card.memberId;
        resolvedCardId = card.id;
      } else {
        const buyerMember = await Member.findOne({
          $or: [
            { memberCode: lookupQuery },
            { mobile: lookupQuery }
          ]
        }).exec();
        if (buyerMember) {
          resolvedMemberId = buyerMember.id;
        }
      }
    }

    if (!resolvedMemberId) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Valid buyer member ID, member code, or card number is required" }
      });
    }

    const sale = await processMemberPurchase(resolvedMemberId, vendor.id, parseInt(amountPaise, 10), {
      idCardId: resolvedCardId,
      idempotencyKey: idempotencyKey || (req.headers["x-idempotency-key"] as string) || null
    });

    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (err) {
    next(err);
  }
}

export async function getSettlements(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const vendor = req.vendor;
    if (!vendor) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }

    const settlements = await VendorSettlement.find({ vendorId: vendor.id })
      .sort({ periodStart: -1 })
      .exec();

    res.json({
      success: true,
      data: settlements
    });
  } catch (err) {
    next(err);
  }
}

export async function requestEarlySettlement(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const vendor = req.vendor;
    const member = req.member;
    if (!vendor || !member) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }

    if (vendor.status === "FROZEN" || vendor.status === "CLOSED") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: `Vendor account is ${vendor.status}. Settlements unavailable.` }
      });
    }

    const settlement = await processEarlySettlement(vendor.id, {
      actorId: member.id
    });

    res.json({
      success: true,
      data: settlement
    });
  } catch (err) {
    next(err);
  }
}
