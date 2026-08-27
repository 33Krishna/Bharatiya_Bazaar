"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMember = createMember;
exports.getMemberById = getMemberById;
exports.getMemberByMobile = getMemberByMobile;
exports.getMemberByCode = getMemberByCode;
const Member_1 = require("../models/Member");
const Wallet_1 = require("../models/Wallet");
const mongoose_1 = __importDefault(require("mongoose"));
// Creates a new member with a temporary placeholder memberCode.
// The permanent memberCode is assigned in idCardService.purchaseIds matching the MAIN card number (BBxxxxx).
async function createMember(args) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const tempCode = `TEMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const existing = await Member_1.Member.findOne({ mobile: args.mobile }).session(session).exec();
        if (existing) {
            throw new Error(`Mobile number ${args.mobile} is already registered`);
        }
        const memberArr = await Member_1.Member.create([
            {
                name: args.name,
                mobile: args.mobile,
                email: args.email,
                address: args.address,
                pinCode: args.pinCode,
                memberCode: tempCode,
                kycTier: args.kycTier || "NONE",
                kycStatus: args.kycStatus || "PENDING",
                status: "ACTIVE"
            }
        ], { session });
        const member = memberArr[0];
        // Create wallet for member
        await Wallet_1.Wallet.create([
            {
                memberId: member.id,
                balancePaise: 0
            }
        ], { session });
        await session.commitTransaction();
        return member;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
async function getMemberById(id) {
    // Populate idCards and mainWallet
    const member = await Member_1.Member.findById(id).exec();
    if (!member)
        return null;
    const idCards = await mongoose_1.default.model("MemberIdCard").find({ memberId: id }).exec();
    const mainWallet = await Wallet_1.Wallet.findOne({ memberId: id }).exec();
    return {
        ...member.toObject(),
        idCards,
        mainWallet
    };
}
async function getMemberByMobile(mobile) {
    const member = await Member_1.Member.findOne({ mobile }).exec();
    if (!member)
        return null;
    const idCards = await mongoose_1.default.model("MemberIdCard").find({ memberId: member.id }).exec();
    const mainWallet = await Wallet_1.Wallet.findOne({ memberId: member.id }).exec();
    return {
        ...member.toObject(),
        idCards,
        mainWallet
    };
}
// For sponsor/referral lookups (BB10001 → member)
async function getMemberByCode(memberCode) {
    const member = await Member_1.Member.findOne({ memberCode }).exec();
    if (!member)
        return null;
    const idCards = await mongoose_1.default.model("MemberIdCard").find({ memberId: member.id }).exec();
    const mainWallet = await Wallet_1.Wallet.findOne({ memberId: member.id }).exec();
    return {
        ...member.toObject(),
        idCards,
        mainWallet
    };
}
