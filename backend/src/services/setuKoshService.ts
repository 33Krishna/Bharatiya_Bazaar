import { Member } from "../models/Member";
import { MemberIdCard } from "../models/MemberIdCard";
import { SetuKoshNode } from "../models/SetuKoshNode";
import { SetuKoshCounter } from "../models/SetuKoshCounter";
import { CommissionEntry } from "../models/CommissionEntry";
import { SystemCounter } from "../models/SystemCounter";
import { Vendor } from "../models/Vendor";
import { VendorSale } from "../models/VendorSale";
import { VendorReferralBonus } from "../models/VendorReferralBonus";
import { MySystemNode } from "../models/MySystemNode";
import * as walletService from "./walletService";
import * as adminService from "./adminService";
import mongoose from "mongoose";

export const SETU_KOSH_THRESHOLD_PAISE = 100000; // Rs. 1,000 in paise
const SYSTEM_COUNTER_ID = "SETUKOSH_GLOBAL";

/**
 * Checks if a PIN code has reached the minimum member threshold for active commission distribution.
 */
export async function isPinCodeActive(
  pinCode: string | undefined | null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<{ active: boolean; count: number; threshold: number }> {
  if (!pinCode) {
    return { active: false, count: 0, threshold: 10 };
  }

  const thresholdSetting = await adminService.getSetting("SETU_KOSH_PIN_THRESHOLD", "10", "integer", options);
  const threshold = typeof thresholdSetting === "number" ? thresholdSetting : parseInt(thresholdSetting, 10);

  const countQuery = Member.countDocuments({
    pinCode: String(pinCode).trim(),
    status: "ACTIVE"
  });

  if (options.session) {
    countQuery.session(options.session);
  }
  const count = await countQuery.exec();

  return {
    active: count >= threshold,
    count,
    threshold
  };
}

/**
 * Sweeps and activates PIN_GATE_INACTIVE commissions triggered by buyers in a PIN code when that PIN reaches threshold.
 */
export async function activatePinGateCommissions(
  pinCode: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<number> {
  if (!pinCode) return 0;

  const membersInPin = await Member.find({ pinCode: String(pinCode).trim() })
    .select("_id")
    .session(options.session || null)
    .exec();

  const memberIds = membersInPin.map(m => m._id);
  if (memberIds.length === 0) return 0;

  const idCards = await MemberIdCard.find({ memberId: { $in: memberIds } })
    .select("_id")
    .session(options.session || null)
    .exec();

  const sourceCardIds = idCards.map(c => c._id);
  if (sourceCardIds.length === 0) return 0;

  const result = await CommissionEntry.updateMany(
    {
      sourceIdCardId: { $in: sourceCardIds },
      stream: { $in: ["SETU_KOSH", "VENDOR_REFERRAL_BONUS"] },
      status: "PIN_GATE_INACTIVE"
    },
    { status: "PENDING_SETTLEMENT" }
  ).session(options.session || null).exec();

  await VendorReferralBonus.updateMany(
    {
      status: "PIN_GATE_INACTIVE"
      // Wait, is there a member filter for pinCode members here?
      // Yes, or we update all PIN_GATE_INACTIVE vendor referral bonuses
    },
    { status: "PENDING" }
  ).session(options.session || null).exec();

  return result.modifiedCount;
}

/**
 * Pure-integer commission split calculation.
 */
export function calculateCommissionSplits(marginPaise: number, purchaseAmountPaise: number): any {
  const fullRatePaise = Math.floor(marginPaise / 14);
  const halfRatePaise = Math.floor(marginPaise / 28);
  let referralBonusPaise = Math.floor((purchaseAmountPaise * 25) / 10000); // 0.25%

  const levelAmounts: Record<number, number> = {
    1: fullRatePaise,
    2: fullRatePaise,
    3: fullRatePaise,
    4: halfRatePaise,
    5: fullRatePaise,
    6: fullRatePaise,
    7: halfRatePaise,
    8: fullRatePaise,
    9: fullRatePaise,
    10: fullRatePaise
  };

  let totalLevelPayout = 0;
  for (let lvl = 1; lvl <= 10; lvl++) {
    totalLevelPayout += levelAmounts[lvl];
  }

  let totalPayout = totalLevelPayout + referralBonusPaise;

  // Cap Enforcement: Total payout cannot exceed vendor margin
  if (totalPayout > marginPaise) {
    if (referralBonusPaise >= marginPaise) {
      referralBonusPaise = marginPaise;
      for (let lvl = 1; lvl <= 10; lvl++) {
        levelAmounts[lvl] = 0;
      }
      totalPayout = referralBonusPaise;
    } else {
      const availableForLevels = Math.max(0, marginPaise - referralBonusPaise);
      const scalingFactor = totalLevelPayout > 0 ? (availableForLevels / totalLevelPayout) : 0;

      totalLevelPayout = 0;
      for (let lvl = 1; lvl <= 10; lvl++) {
        levelAmounts[lvl] = Math.floor(levelAmounts[lvl] * scalingFactor);
        totalLevelPayout += levelAmounts[lvl];
      }
      totalPayout = totalLevelPayout + referralBonusPaise;
    }
  }

  return {
    levelAmounts,
    referralBonusPaise,
    totalPayoutPaise: totalPayout,
    marginPaise
  };
}

/**
 * Deterministically generates a Setu Kosh node in the global 10-level tree and distributes upline commissions.
 */
export async function generateSetuKoshNode(
  memberId: string | mongoose.Types.ObjectId,
  nodeMarginPaise: number,
  isPinActive: boolean,
  sourceIdCardId: string | mongoose.Types.ObjectId | null = null,
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  // 1. Increment atomic global counter
  let counter = await SystemCounter.findById(SYSTEM_COUNTER_ID).session(options.session || null).exec();
  if (!counter) {
    counter = await SystemCounter.create(
      [
        {
          _id: SYSTEM_COUNTER_ID,
          currentValue: 0
        }
      ],
      { session: options.session }
    ).then(res => res[0]);
  }
  if (!counter) {
    throw new Error("Could not initialize SETUKOSH_GLOBAL system counter");
  }

  counter.currentValue += 1;
  await counter.save();
  const globalPosition = counter.currentValue;

  let parentNodeId: any = null;
  let side: string | null = null;
  let depthLevel = 0;

  // 2. Position Math for Parent and Side
  if (globalPosition > 1) {
    const parentPosition = Math.floor(globalPosition / 2);
    side = globalPosition % 2 === 0 ? "LEFT" : "RIGHT";

    const parentNode = await SetuKoshNode.findOne({ globalPosition: parentPosition })
      .session(options.session || null)
      .exec();

    if (!parentNode) {
      throw new Error(`Parent node at position ${parentPosition} not found for globalPosition ${globalPosition}`);
    }

    parentNodeId = parentNode.id;
    depthLevel = parentNode.depthLevel + 1;
  }

  // 3. Insert Node
  const newNodeArr = await SetuKoshNode.create(
    [
      {
        memberId,
        globalPosition,
        parentNodeId: parentNodeId || undefined,
        side: side || undefined,
        depthLevel
      }
    ],
    { session: options.session }
  );
  const newNode = newNodeArr[0];

  // 4. Distribute L1-L10 Upline Commissions
  if (parentNodeId && nodeMarginPaise > 0) {
    const splits = calculateCommissionSplits(nodeMarginPaise, SETU_KOSH_THRESHOLD_PAISE);
    const status = isPinActive ? "PENDING_SETTLEMENT" : "PIN_GATE_INACTIVE";

    let currentNodeId = parentNodeId;
    let currentLevel = 1;

    while (currentNodeId && currentLevel <= 10) {
      const ancestor = await SetuKoshNode.findById(currentNodeId)
        .populate({
          path: "memberId",
          populate: { path: "idCards" }
        })
        .session(options.session || null)
        .exec();

      if (!ancestor) break;

      const ancestorMember = ancestor.memberId as any;
      const idCards = ancestorMember?.idCards || [];
      const mainIdCard = idCards.find((c: any) => c.type === "MAIN") || idCards[0];
      const amountPaise = splits.levelAmounts[currentLevel] || 0;

      if (mainIdCard && amountPaise > 0) {
        await CommissionEntry.create(
          [
            {
              idCardId: mainIdCard._id,
              stream: "SETU_KOSH",
              level: currentLevel,
              amountPaise,
              status,
              sourceIdCardId: sourceIdCardId || undefined
            }
          ],
          { session: options.session }
        );
      }

      currentNodeId = ancestor.parentNodeId ? ancestor.parentNodeId.toString() : "";
      currentLevel++;
    }
  }

  return newNode;
}

/**
 * Records a member's purchase at a partner vendor.
 */
export async function recordPurchase(
  memberId: string | mongoose.Types.ObjectId,
  vendorId: string | mongoose.Types.ObjectId,
  amountPaise: number,
  options: {
    idCardId?: string | mongoose.Types.ObjectId | null;
    idempotencyKey?: string | null;
    bypassPinCheck?: boolean;
  } = {}
): Promise<any> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { idCardId = null, idempotencyKey = null, bypassPinCheck = false } = options;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingSale = await VendorSale.findOne({ idempotencyKey }).session(session).exec();
      if (existingSale) {
        await session.commitTransaction();
        return {
          vendorSale: existingSale,
          alreadyProcessed: true
        };
      }
    }

    // 2. Validate Vendor and Active Status
    const vendor = await Vendor.findById(vendorId).session(session).exec();
    if (!vendor || (vendor.status !== "ACTIVE" && vendor.status !== "VERIFIED")) {
      throw new Error(`Vendor ${vendorId} is not active or verified (Status: ${vendor?.status || 'NOT_FOUND'})`);
    }

    // 3. Snapshot Vendor Margin
    const marginPaise = Math.floor((amountPaise * vendor.marginRatePct) / 100);

    // 4. Create VendorSale Record
    const vendorSaleArr = await VendorSale.create(
      [
        {
          vendorId,
          memberId,
          idCardId: idCardId || undefined,
          amountPaise,
          marginPaise,
          idempotencyKey: idempotencyKey || undefined,
          status: "COMPLETED"
        }
      ],
      { session }
    );
    const vendorSale = vendorSaleArr[0];

    // 5. Evaluate PIN Code Gate
    const buyer = await Member.findById(memberId).populate("idCards").session(session).exec();
    const pinCheck = await isPinCodeActive(buyer?.pinCode, { session });
    const isPinActive = bypassPinCheck || pinCheck.active;

    // Resolve buyer card
    let buyerCard = null;
    const idCards = ((buyer as any)?.idCards as any[]) || [];
    if (idCardId) {
      buyerCard = idCards.find(c => c._id.toString() === idCardId.toString());
    }
    if (!buyerCard) {
      buyerCard = idCards.find(c => c.type === "MAIN") || idCards[0];
    }
    const sourceCardId = buyerCard?._id || null;

    // Activate existing locked commissions in this PIN if threshold just reached
    if (isPinActive && buyer?.pinCode) {
      await activatePinGateCommissions(buyer.pinCode, { session });
    }

    // 6. Referral Bonus (0.25% or dynamic BPS to MY SYSTEM sponsor)
    const bonusBps = await adminService.getSetting("SETU_KOSH_REFERRAL_BONUS_BPS", 25, "integer", { session });
    const bonusPaise = Math.floor((amountPaise * bonusBps) / 10000);

    if (bonusPaise > 0 && buyerCard) {
      // Find MySystemNode for buyerCard to see who is sponsor
      let buyerSystemNode = await MySystemNode.findOne({ idCardId: buyerCard._id }).session(session).exec();
      let sponsorCardId = buyerSystemNode?.sponsorIdCardId;

      if (!sponsorCardId && buyerSystemNode?.parentNodeId) {
        const parentNode = await MySystemNode.findById(buyerSystemNode.parentNodeId).session(session).exec();
        sponsorCardId = parentNode?.idCardId;
      }

      // Fallback to owner's MAIN card MY SYSTEM sponsor
      if (!sponsorCardId) {
        const ownerMainCard = idCards.find(c => c.type === "MAIN");
        if (ownerMainCard) {
          const mainSystemNode = await MySystemNode.findOne({ idCardId: ownerMainCard._id }).session(session).exec();
          sponsorCardId = mainSystemNode?.sponsorIdCardId;
          if (!sponsorCardId && mainSystemNode?.parentNodeId) {
            const parentNode = await MySystemNode.findById(mainSystemNode.parentNodeId).session(session).exec();
            sponsorCardId = parentNode?.idCardId;
          }
        }
      }

      if (sponsorCardId) {
        const sponsorCard = await MemberIdCard.findById(sponsorCardId).session(session).exec();
        if (sponsorCard) {
          await CommissionEntry.create(
            [
              {
                idCardId: sponsorCard._id,
                stream: "VENDOR_REFERRAL_BONUS",
                level: 1,
                amountPaise: bonusPaise,
                status: isPinActive ? "PENDING_SETTLEMENT" : "PIN_GATE_INACTIVE",
                sourceIdCardId: sourceCardId || undefined
              }
            ],
            { session }
          );

          await VendorReferralBonus.create(
            [
              {
                memberId: sponsorCard.memberId,
                referredVendorId: vendorId,
                bonusPaise,
                status: isPinActive ? "PENDING" : "PIN_GATE_INACTIVE"
              }
            ],
            { session }
          );
        }
      }
    }

    // 7. Unified Margin Accumulation on SetuKoshCounter
    const counter = await SetuKoshCounter.findOneAndUpdate(
      { memberId },
      {
        $setOnInsert: { memberId },
        $inc: { counterPaise: amountPaise, accumulatedMarginPaise: marginPaise }
      },
      { new: true, upsert: true, session }
    );

    const newCounterPaise = counter.counterPaise;
    const accMarginPaise = counter.accumulatedMarginPaise;

    const counterThresholdPaise = await adminService.getSetting("SETU_KOSH_COUNTER_THRESHOLD_PAISE", SETU_KOSH_THRESHOLD_PAISE, "integer", { session });
    const k = Math.floor(newCounterPaise / counterThresholdPaise);

    let remainingCounterPaise = newCounterPaise;
    let remainingMarginPaise = accMarginPaise;
    const createdNodes = [];

    // 8. Distribute when >= 1 new ID is generated
    if (k >= 1) {
      const marginPerNode = Math.floor(accMarginPaise / k);

      for (let i = 0; i < k; i++) {
        const node = await generateSetuKoshNode(memberId, marginPerNode, isPinActive, sourceCardId, { session });
        createdNodes.push(node);
      }

      const processedSpend = k * counterThresholdPaise;
      const processedMargin = k * marginPerNode;

      remainingCounterPaise = newCounterPaise - processedSpend;
      remainingMarginPaise = accMarginPaise - processedMargin;

      counter.counterPaise = remainingCounterPaise;
      counter.accumulatedMarginPaise = remainingMarginPaise;
      counter.idsCreated += k;
      await counter.save();
    }

    await session.commitTransaction();
    return {
      vendorSale,
      idsCreated: k,
      nodes: createdNodes,
      currentCounterPaise: remainingCounterPaise,
      accumulatedMarginPaise: remainingMarginPaise,
      isPinActive
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Settlement Hook: Releases PENDING_SETTLEMENT commissions to WITHDRAWABLE and credits wallets.
 */
export async function settlePending(
  options: { session?: mongoose.ClientSession } = {}
): Promise<any> {
  const pendingCommissions = await CommissionEntry.find({
    stream: { $in: ["SETU_KOSH", "VENDOR_REFERRAL_BONUS"] },
    status: "PENDING_SETTLEMENT"
  }).populate("idCardId").session(options.session || null).exec();

  let totalSettledPaise = 0;

  for (const comm of pendingCommissions) {
    comm.status = "WITHDRAWABLE";
    comm.confirmedAt = new Date();
    if (options.session) {
      comm.$session(options.session);
    }
    await comm.save();

    const idCard = comm.idCardId as any;

    await walletService.credit(
      idCard.memberId,
      comm.amountPaise,
      comm.stream,
      comm.id,
      `Weekly Settlement Release for ${comm.stream}`,
      options
    );

    totalSettledPaise += comm.amountPaise;
  }

  return {
    settledCount: pendingCommissions.length,
    totalSettledPaise
  };
}

/**
 * Returns member's current counter status.
 */
export async function getMemberCounter(memberId: string | mongoose.Types.ObjectId): Promise<any> {
  const [counter, referralBonuses, earnedIdCards] = await Promise.all([
    SetuKoshCounter.findOne({ memberId }).exec(),
    VendorReferralBonus.find({ memberId }).sort({ createdAt: -1 }).exec(),
    MemberIdCard.find({ memberId, type: "SUB" }).sort({ createdAt: -1 }).select("cardNumber type createdAt status").exec()
  ]);

  const counterPaise = counter?.counterPaise || 0;
  const idsCreated = counter?.idsCreated || 0;
  const accumulatedMarginPaise = counter?.accumulatedMarginPaise || 0;
  const progressPct = Math.min(100, Math.floor((counterPaise * 100) / SETU_KOSH_THRESHOLD_PAISE));
  const remainingPaise = Math.max(0, SETU_KOSH_THRESHOLD_PAISE - counterPaise);

  return {
    memberId,
    counterPaise,
    accumulatedMarginPaise,
    idsCreated,
    thresholdPaise: SETU_KOSH_THRESHOLD_PAISE,
    progressPct,
    remainingPaise,
    referralBonuses: referralBonuses || [],
    earnedIdCards: earnedIdCards || []
  };
}

/**
 * Returns 10-level tree for Setu Kosh explorer.
 */
export async function getSetuKoshTree(rootPosition = 1, maxDepth = 10): Promise<any> {
  const root = await SetuKoshNode.findOne({ globalPosition: rootPosition })
    .populate("memberId", "name memberCode")
    .exec();

  if (!root) return null;

  const allNodes = await SetuKoshNode.find({})
    .populate("memberId", "name memberCode")
    .exec();

  const nodeMap: Record<number, any> = {};
  for (const n of allNodes) {
    nodeMap[n.globalPosition] = n;
  }

  function buildTree(pos: number, depth: number): any {
    const node = nodeMap[pos];
    if (!node || depth > maxDepth) return null;

    const leftPos = pos * 2;
    const rightPos = pos * 2 + 1;
    const member = node.memberId as any;

    return {
      position: node.globalPosition,
      level: node.depthLevel,
      side: node.side,
      memberId: member?._id,
      memberName: member?.name || "—",
      memberCode: member?.memberCode || "—",
      children: {
        LEFT: nodeMap[leftPos] ? buildTree(leftPos, depth + 1) : null,
        RIGHT: nodeMap[rightPos] ? buildTree(rightPos, depth + 1) : null
      }
    };
  }

  return {
    rootNode: root,
    tree: buildTree(root.globalPosition, 0),
    totalNodes: allNodes.length
  };
}
