import { MySystemNode } from "../models/MySystemNode";
import { MemberIdCard } from "../models/MemberIdCard";
import { CommissionEntry } from "../models/CommissionEntry";
import * as walletService from "./walletService";
import mongoose from "mongoose";

export async function checkAcbStatus(
  idCardId: string | mongoose.Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<boolean> {
  // Query nodes directly sponsored by this ID card (direct referrals)
  const sponsoredNodes = await MySystemNode.find({ sponsorIdCardId: idCardId })
    .session(options.session || null)
    .exec();

  if (sponsoredNodes.length === 0) {
    return false;
  }

  const hasLeft = sponsoredNodes.some(n => n.side === "LEFT");
  const hasRight = sponsoredNodes.some(n => n.side === "RIGHT");

  return hasLeft && hasRight;
}

export async function unlockAcb(
  idCardId: string | mongoose.Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  await MemberIdCard.findByIdAndUpdate(
    idCardId,
    {
      acbStatus: true,
      acbUnlockedAt: new Date(),
    },
    { session: options.session }
  ).exec();
}

export async function unlockLockedEarnings(
  idCardId: string | mongoose.Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  // Find all locked commissions for this ID
  const lockedCommissions = await CommissionEntry.find({
    idCardId,
    status: "LOCKED_ACB"
  }).session(options.session || null).exec();

  if (lockedCommissions.length === 0) return;

  const idCard = await MemberIdCard.findById(idCardId).session(options.session || null).exec();
  if (!idCard) return;

  for (const commission of lockedCommissions) {
    // 1. Update commission to WITHDRAWABLE
    commission.status = "WITHDRAWABLE";
    if (options.session) {
      commission.$session(options.session);
    }
    await commission.save();

    // 2. Credit wallet
    await walletService.credit(
      idCard.memberId,
      commission.amountPaise,
      commission.stream,
      commission.id,
      `ACB Unlocked ${commission.stream} Level ${commission.level}`,
      { session: options.session }
    );
  }
}
