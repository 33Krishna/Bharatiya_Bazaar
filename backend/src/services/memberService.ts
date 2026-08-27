import { Member } from "../models/Member";
import { Wallet } from "../models/Wallet";
import mongoose from "mongoose";

export interface CreateMemberArgs {
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  pinCode?: string;
  kycTier?: string;
  kycStatus?: string;
}

// Creates a new member with a temporary placeholder memberCode.
// The permanent memberCode is assigned in idCardService.purchaseIds matching the MAIN card number (BBxxxxx).
export async function createMember(args: CreateMemberArgs): Promise<any> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tempCode = `TEMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const existing = await Member.findOne({ mobile: args.mobile }).session(session).exec();
    if (existing) {
      throw new Error(`Mobile number ${args.mobile} is already registered`);
    }

    const memberArr = await Member.create(
      [
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
      ],
      { session }
    );
    const member = memberArr[0];

    // Create wallet for member
    await Wallet.create(
      [
        {
          memberId: member.id,
          balancePaise: 0
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return member;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getMemberById(id: string | mongoose.Types.ObjectId): Promise<any> {
  // Populate idCards and mainWallet
  const member = await Member.findById(id).exec();
  if (!member) return null;

  const idCards = await mongoose.model("MemberIdCard").find({ memberId: id }).exec();
  const mainWallet = await Wallet.findOne({ memberId: id }).exec();

  return {
    ...member.toObject(),
    idCards,
    mainWallet
  };
}

export async function getMemberByMobile(mobile: string): Promise<any> {
  const member = await Member.findOne({ mobile }).exec();
  if (!member) return null;

  const idCards = await mongoose.model("MemberIdCard").find({ memberId: member.id }).exec();
  const mainWallet = await Wallet.findOne({ memberId: member.id }).exec();

  return {
    ...member.toObject(),
    idCards,
    mainWallet
  };
}

// For sponsor/referral lookups (BB10001 → member)
export async function getMemberByCode(memberCode: string): Promise<any> {
  const member = await Member.findOne({ memberCode }).exec();
  if (!member) return null;

  const idCards = await mongoose.model("MemberIdCard").find({ memberId: member.id }).exec();
  const mainWallet = await Wallet.findOne({ memberId: member.id }).exec();

  return {
    ...member.toObject(),
    idCards,
    mainWallet
  };
}
