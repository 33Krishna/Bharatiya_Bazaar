import { AutoPoolNode } from "../models/AutoPoolNode";
import { MySystemNode } from "../models/MySystemNode";
import { MemberIdCard } from "../models/MemberIdCard";
import { CommissionEntry } from "../models/CommissionEntry";
import * as payOnceService from "./payOnceService";
import * as walletService from "./walletService";
import * as adminService from "./adminService";
import mongoose from "mongoose";

const L_AMOUNTS: Record<number, number> = {
  1: 30000, // Rs. 300
  2: 30000, // Rs. 300
  3: 20000  // Rs. 200
};

// AutoPool logic
export async function checkAutoPoolLevelCompletion(
  newGlobalPosition: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  for (let L = 1; L <= 7; L++) {
    const numerator = newGlobalPosition + 1 - Math.pow(2, L);
    const denominator = Math.pow(2, L);

    if (numerator % denominator === 0) {
      const ancestorPos = numerator / denominator;

      if (ancestorPos >= 1) {
        const ancestorNode = await AutoPoolNode.findOne({ globalPosition: ancestorPos })
          .session(options.session || null)
          .exec();

        if (ancestorNode) {
          if (L >= 1 && L <= 3) {
            await calculateAndCreateCommissions(ancestorNode.idCardId, L, "AUTOPOOL", L_AMOUNTS[L], options);
          } else {
            // Level 4-7 rebirth triggers are processed separately in rebirthService and queued
          }
        }
      }
    }
  }
}

// Helper for MY SYSTEM depth nodes counting
async function countMySystemNodesAtDepth(
  rootId: string | mongoose.Types.ObjectId,
  targetDepth: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<number> {
  let currentLevelIds: (string | mongoose.Types.ObjectId)[] = [rootId];

  for (let d = 1; d <= targetDepth; d++) {
    const children = await MySystemNode.find({ parentNodeId: { $in: currentLevelIds } })
      .session(options.session || null)
      .exec();

    if (children.length === 0) return 0;
    currentLevelIds = children.map(c => c._id as mongoose.Types.ObjectId);
  }

  return currentLevelIds.length;
}

// MY SYSTEM logic
export async function checkMySystemLevelCompletion(
  newNodeId: string | mongoose.Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  const requirements: Record<number, number> = { 1: 2, 2: 4, 3: 8 };
  let currentNode = await MySystemNode.findById(newNodeId).session(options.session || null).exec();

  for (let L = 1; L <= 3; L++) {
    if (!currentNode || !currentNode.parentNodeId) break;

    const ancestorNode = await MySystemNode.findById(currentNode.parentNodeId)
      .session(options.session || null)
      .exec();

    if (ancestorNode) {
      const count = await countMySystemNodesAtDepth(ancestorNode._id as mongoose.Types.ObjectId, L, options);

      if (count === requirements[L]) {
        const existingCommission = await CommissionEntry.findOne({
          idCardId: ancestorNode.idCardId,
          stream: "MY_SYSTEM",
          level: L
        }).session(options.session || null).exec();

        if (!existingCommission) {
          await calculateAndCreateCommissions(ancestorNode.idCardId, L, "MY_SYSTEM", L_AMOUNTS[L], options);
        }
      }
    }

    currentNode = ancestorNode;
  }
}

// Main orchestrator for creating commissions with Pay-Once rule
export async function calculateAndCreateCommissions(
  idCardId: string | mongoose.Types.ObjectId,
  level: number,
  stream: string,
  amountPaise: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  // 1. Check Pay-Once Ledger
  const alreadyPaid = await payOnceService.hasAlreadyPaid(idCardId, level, options);

  const idCard = await MemberIdCard.findById(idCardId).session(options.session || null).exec();
  if (!idCard) return;

  if (alreadyPaid) {
    // Prevent duplicate blocked rows when checks run more than once
    const existingBlocked = await CommissionEntry.findOne({
      idCardId,
      stream,
      level,
      status: "PAY_ONCE_BLOCKED"
    }).session(options.session || null).exec();

    if (existingBlocked) return;

    await CommissionEntry.create(
      [
        {
          idCardId,
          stream,
          level,
          amountPaise: 0,
          status: "PAY_ONCE_BLOCKED"
        },
      ],
      { session: options.session }
    );
  } else {
    // Record payment in PayOnceLedger
    await payOnceService.recordPayment(idCardId, level, stream, options);

    // Read live system toggles
    const mySystem7DayHold = await adminService.getSettingBoolean("MY_SYSTEM_7DAY_HOLD", true, options);
    const autoPoolLockedBeforeAcb = await adminService.getSettingBoolean("AUTOPOOL_LOCKED_BEFORE_ACB", true, options);
    const rebirthRequiresMainAcb = await adminService.getSettingBoolean("REBIRTH_WITHDRAWAL_REQUIRES_MAIN_ACB", true, options);

    const isRebirth = idCard.type === "REBIRTH";
    const ownerMainCard = await MemberIdCard.findOne({
      memberId: idCard.memberId,
      type: "MAIN"
    }).session(options.session || null).exec();

    let hasAcb = true;
    if (isRebirth) {
      hasAcb = rebirthRequiresMainAcb ? Boolean(ownerMainCard?.acbStatus) : true;
    } else {
      hasAcb = Boolean(ownerMainCard?.acbStatus || idCard.acbStatus);
    }

    let initialStatus = "CONFIRMED";

    if (stream === "MY_SYSTEM") {
      if (mySystem7DayHold) {
        initialStatus = "PENDING_7_DAY";
      } else {
        initialStatus = hasAcb ? "WITHDRAWABLE" : "LOCKED_ACB";
      }
    } else if (stream === "AUTOPOOL") {
      if (!autoPoolLockedBeforeAcb) {
        initialStatus = "WITHDRAWABLE";
      } else if (!hasAcb) {
        initialStatus = "LOCKED_ACB";
      } else {
        initialStatus = "WITHDRAWABLE";
      }
    }

    // Create commission entry
    const commissionArr = await CommissionEntry.create(
      [
        {
          idCardId,
          stream,
          level,
          amountPaise,
          status: initialStatus
        },
      ],
      { session: options.session }
    );
    const commission = commissionArr[0];

    // If immediately withdrawable, credit the wallet
    if (initialStatus === "WITHDRAWABLE") {
      await walletService.credit(
        idCard.memberId,
        amountPaise,
        stream,
        commission.id,
        `Commission for ${stream} Level ${level}`,
        options
      );
    }
  }
}
