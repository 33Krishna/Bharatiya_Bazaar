"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getProfile = getProfile;
exports.recordSale = recordSale;
exports.getSettlements = getSettlements;
exports.requestEarlySettlement = requestEarlySettlement;
const vendorService_1 = require("../services/vendorService");
const settlementService_1 = require("../services/settlementService");
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const Vendor_1 = require("../models/Vendor");
const VendorSale_1 = require("../models/VendorSale");
const VendorSettlement_1 = require("../models/VendorSettlement");
const Wallet_1 = require("../models/Wallet");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
async function register(req, res, next) {
    try {
        const { name, businessName, mobile, password, category = "GENERAL", entityType = "INDIVIDUAL", panNumber, gstin, address, pinCode, payoutMethod = "BANK", referrerCode, referrerMemberCode } = req.body;
        const trimmedMobile = String(mobile || "").trim();
        // 1. Resolve Referrer Member if code provided
        let referredByMemberId = null;
        const refCode = (referrerCode || referrerMemberCode || "").trim();
        if (refCode) {
            const referrer = await Member_1.Member.findOne({
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
        let member = await Member_1.Member.findOne({ mobile: trimmedMobile }).exec();
        const vendorExists = member ? await Vendor_1.Vendor.findOne({ memberId: member.id }).exec() : null;
        if (member && vendorExists) {
            return res.status(400).json({
                success: false,
                error: { code: "ALREADY_REGISTERED", message: `Mobile ${trimmedMobile} is already registered as a vendor` }
            });
        }
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        if (!member) {
            const memberCode = `M${trimmedMobile.slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
            const memberArr = await Member_1.Member.create([
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
            await Wallet_1.Wallet.create([{ memberId: member.id, balancePaise: 0 }]);
        }
        else if (!member.passwordHash) {
            member.passwordHash = passwordHash;
            await member.save();
        }
        // 3. Register Vendor via Service
        const vendor = await (0, vendorService_1.registerVendor)({
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
    }
    catch (err) {
        next(err);
    }
}
async function login(req, res, next) {
    try {
        const { mobile, password } = req.body;
        const input = (mobile || "").trim();
        const member = await Member_1.Member.findOne({
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
        const vendor = await Vendor_1.Vendor.findOne({ memberId: member.id }).exec();
        if (!vendor) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Invalid credentials or not registered as vendor" }
            });
        }
        const validPassword = await bcrypt_1.default.compare(password, member.passwordHash);
        if (!validPassword && password !== member.passwordHash) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Invalid credentials" }
            });
        }
        const token = jsonwebtoken_1.default.sign({
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
    }
    catch (err) {
        next(err);
    }
}
async function getProfile(req, res, next) {
    try {
        const vendor = req.vendor;
        const member = req.member;
        if (!vendor || !member) {
            return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        }
        const salesAgg = await VendorSale_1.VendorSale.aggregate([
            { $match: { vendorId: new mongoose_1.default.Types.ObjectId(vendor.id) } },
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
        const wallet = await Wallet_1.Wallet.findOne({ memberId: member.id }).exec();
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
    }
    catch (err) {
        next(err);
    }
}
async function recordSale(req, res, next) {
    try {
        const { memberId, buyerCode, cardNumber, memberCode, amountPaise, idCardId, idempotencyKey } = req.body;
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
            const card = await MemberIdCard_1.MemberIdCard.findOne({
                $or: [
                    { cardNumber: lookupQuery }
                ]
            }).exec();
            if (card) {
                resolvedMemberId = card.memberId;
                resolvedCardId = card.id;
            }
            else {
                const buyerMember = await Member_1.Member.findOne({
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
        const sale = await (0, vendorService_1.processMemberPurchase)(resolvedMemberId, vendor.id, parseInt(amountPaise, 10), {
            idCardId: resolvedCardId,
            idempotencyKey: idempotencyKey || req.headers["x-idempotency-key"] || null
        });
        res.status(201).json({
            success: true,
            data: sale
        });
    }
    catch (err) {
        next(err);
    }
}
async function getSettlements(req, res, next) {
    try {
        const vendor = req.vendor;
        if (!vendor) {
            return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        }
        const settlements = await VendorSettlement_1.VendorSettlement.find({ vendorId: vendor.id })
            .sort({ periodStart: -1 })
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
async function requestEarlySettlement(req, res, next) {
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
        const settlement = await (0, settlementService_1.processEarlySettlement)(vendor.id, {
            actorId: member.id
        });
        res.json({
            success: true,
            data: settlement
        });
    }
    catch (err) {
        next(err);
    }
}
