import { AutoPoolNode } from "../models/AutoPoolNode";
import { Voucher } from "../models/Voucher";
import * as adminService from "./adminService";
import mongoose from "mongoose";

export interface RebirthItem {
  memberId: mongoose.Types.ObjectId;
  ancestorPos: number;
  depthLevel: number;
  completedLevel: number;
  type: string; // "REBIRTH"
  sponsorIdCardId: null;
  sponsorSide: null;
}

export async function checkAndProcessRebirths(
  newlyPlacedGlobalPosition: number,
  options: { session?: mongoose.ClientSession } = {}
): Promise<RebirthItem[]> {
  const rebirthsToQueue: RebirthItem[] = [];

  // Rebirth triggers at AutoPool Levels 4, 5, 6, 7
  for (let L = 4; L <= 7; L++) {
    const numerator = newlyPlacedGlobalPosition + 1 - Math.pow(2, L);
    const denominator = Math.pow(2, L);

    if (numerator % denominator === 0) {
      const ancestorPos = numerator / denominator;

      if (ancestorPos >= 1) {
        // Ancestor completed Level L
        const ancestorNode = await AutoPoolNode.findOne({ globalPosition: ancestorPos })
          .populate("idCardId")
          .session(options.session || null)
          .exec();

        if (ancestorNode && ancestorNode.idCardId) {
          const cardOwnerId = (ancestorNode.idCardId as any).memberId;
          rebirthsToQueue.push({
            memberId: cardOwnerId,
            ancestorPos: ancestorPos,
            depthLevel: ancestorNode.depthLevel,
            completedLevel: L,
            type: "REBIRTH",
            sponsorIdCardId: null,
            sponsorSide: null
          });

          // Generate Voucher for Levels 5, 6, 7
          if (L >= 5 && L <= 7) {
            const faceValuePaise = await adminService.getSetting("VOUCHER_FACE_VALUE_PAISE", 20000, "integer", options);
            const validityDays = await adminService.getSetting("VOUCHER_VALIDITY_DAYS", 365, "integer", options);

            await Voucher.create(
              [
                {
                  memberId: cardOwnerId,
                  idCardId: ancestorNode.idCardId._id,
                  sourceType: `AUTOPOOL_LEVEL_${L}`,
                  faceValuePaise,
                  expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
                },
              ],
              { session: options.session }
            );
          }
        }
      }
    }
  }

  // Priority Ordering:
  // Primary: Depth (deepest first, i.e., highest depthLevel)
  // Secondary: Global Position (highest/newest first, i.e., highest ancestorPos)
  rebirthsToQueue.sort((a, b) => {
    if (a.depthLevel !== b.depthLevel) {
      return b.depthLevel - a.depthLevel;
    }
    return b.ancestorPos - a.ancestorPos;
  });

  return rebirthsToQueue;
}
