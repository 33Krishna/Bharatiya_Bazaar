import cron from "node-cron";
import { MemberIdCard } from "../models/MemberIdCard";
import { CommissionEntry } from "../models/CommissionEntry";
import * as acbService from "../services/acbService";
import * as walletService from "../services/walletService";
import * as settlementService from "../services/settlementService";
import mongoose from "mongoose";

export async function run7DaySweep(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let processed = 0;

  const pendingCommissions = await CommissionEntry.find({
    status: "PENDING_7_DAY",
    createdAt: { $lte: sevenDaysAgo }
  }).populate("idCardId").exec();

  for (const commission of pendingCommissions) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Recheck status inside transaction
      const current = await CommissionEntry.findById(commission.id).session(session).exec();
      if (!current || current.status !== "PENDING_7_DAY") {
        await session.commitTransaction();
        session.endSession();
        continue;
      }

      const idCard = commission.idCardId as any;
      if (!idCard) {
        await session.commitTransaction();
        session.endSession();
        continue;
      }

      // Check if source card owner has ACB qualified on MAIN card
      let hasAcb = false;
      const ownerMainCard = await MemberIdCard.findOne({
        memberId: idCard.memberId,
        type: "MAIN"
      }).session(session).exec();

      if (ownerMainCard && ownerMainCard.acbStatus) {
        hasAcb = true;
      }

      if (hasAcb) {
        current.status = "WITHDRAWABLE";
        await current.save({ session });

        await walletService.credit(
          idCard.memberId,
          commission.amountPaise,
          commission.stream,
          commission.id,
          `7-day hold released for ${commission.stream} Level ${commission.level}`,
          { session }
        );
      } else {
        current.status = "LOCKED_ACB";
        await current.save({ session });
      }

      processed++;
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return processed;
}

export async function runAcbSweep(): Promise<number> {
  let processed = 0;
  const cards = await MemberIdCard.find({ acbStatus: false }).exec();

  for (const card of cards) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const qualifies = await acbService.checkAcbStatus(card.id, { session });
      if (qualifies) {
        await acbService.unlockAcb(card.id, { session });
        await acbService.unlockLockedEarnings(card.id, { session });
        processed++;
      }
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  return processed;
}

/**
 * Weekly Monday Settlement Sweep at 00:00 UTC/IST
 */
export async function runMondaySettlement(): Promise<any> {
  try {
    const result = await settlementService.processWeeklySettlement(new Date());
    console.log(`[JOB SUMMARY] Weekly Settlement: Processed ${result.totalEntries} vendor payouts, Total Net: Rs. ${(result.netPaise / 100).toFixed(2)}`);
    return result;
  } catch (error) {
    console.error("[JOB ERROR] Weekly Settlement Failed:", error);
    throw error;
  }
}

/**
 * Daily Inactivity Lifecycle Sweep at 02:00
 */
export async function runDailyInactivitySweep(): Promise<any> {
  try {
    const result = await settlementService.sweepVendorInactivity(new Date());
    console.log(`[JOB SUMMARY] Inactivity Sweep: Inactivated: ${result.inactivated}, Frozen: ${result.frozen}, Closed: ${result.closed}`);
    return result;
  } catch (error) {
    console.error("[JOB ERROR] Inactivity Sweep Failed:", error);
    throw error;
  }
}

// 1. Hourly 7-day and ACB Sweeps
cron.schedule("0 * * * *", async () => {
  try {
    const holdProcessed = await run7DaySweep();
    const acbProcessed = await runAcbSweep();
    console.log(`[JOB SUMMARY] Hourly Sweep: Processed ${holdProcessed} 7-day holds, Unlocked ${acbProcessed} ACB statuses.`);
  } catch (error) {
    console.error("[JOB ERROR] Hourly Sweep Failed:", error);
  }
});

// 2. Weekly Monday Settlement at 00:00 ("0 0 * * MON")
cron.schedule("0 0 * * MON", async () => {
  await runMondaySettlement().catch(() => {});
});

// 3. Daily Inactivity Lifecycle Sweep at 02:00 ("0 2 * * *")
cron.schedule("0 2 * * *", async () => {
  await runDailyInactivitySweep().catch(() => {});
});
