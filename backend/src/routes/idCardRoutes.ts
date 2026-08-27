import express from "express";
import * as idCardService from "../services/idCardService";
import { MemberIdCard } from "../models/MemberIdCard";
import { CommissionEntry } from "../models/CommissionEntry";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Apply auth middleware to all ID card routes
router.use(authMiddleware as any);

router.post("/purchase", async (req: express.Request, res: express.Response) => {
  try {
    const { count, sponsorIdCardId, sponsorSide } = req.body;
    const memberId = req.member?.id;

    if (!memberId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!count || count < 1) {
      return res.status(400).json({
        success: false,
        message: "count (minimum 1) is required"
      });
    }

    // Validate sponsor side if provided
    if (sponsorIdCardId && !["LEFT", "RIGHT"].includes(sponsorSide)) {
      return res.status(400).json({
        success: false,
        message: "sponsorSide must be LEFT or RIGHT when sponsorIdCardId is provided"
      });
    }

    const cards = await idCardService.purchaseIds(
      memberId,
      count,
      sponsorIdCardId || null,
      sponsorSide || null
    );

    res.status(201).json({
      success: true,
      message: `Successfully purchased ${cards.length} ID(s)`,
      data: cards
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/my-cards", async (req: express.Request, res: express.Response) => {
  try {
    const memberId = req.member?.id;
    if (!memberId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cards = await MemberIdCard.find({ memberId })
      .populate("mySystemNode")
      .populate("autoPoolNode")
      .sort({ createdAt: 1 })
      .exec();

    res.json({
      success: true,
      data: cards
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/commissions", async (req: express.Request, res: express.Response) => {
  try {
    const memberId = req.member?.id;
    if (!memberId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cards = await MemberIdCard.find({ memberId }).select("_id cardNumber type").exec();
    const cardIds = cards.map(c => c._id);

    const commissions = await CommissionEntry.find({ idCardId: { $in: cardIds } })
      .sort({ createdAt: -1 })
      .exec();

    const cardMap: Record<string, { cardNumber: string; type: string }> = {};
    cards.forEach(c => {
      cardMap[c.id.toString()] = { cardNumber: c.cardNumber, type: c.type };
    });

    const enriched = commissions.map(c => {
      const cardInfo = cardMap[c.idCardId.toString()];
      return {
        ...c.toObject(),
        idCard: cardInfo ? { cardNumber: cardInfo.cardNumber, type: cardInfo.type } : null
      };
    });

    res.json({
      success: true,
      data: enriched
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/tree/:memberId", async (req: express.Request, res: express.Response) => {
  try {
    const { memberId } = req.params;

    const idCards = await MemberIdCard.find({ memberId })
      .populate("mySystemNode")
      .populate("autoPoolNode")
      .exec();

    res.json({
      success: true,
      data: idCards
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/purchase-additional", async (req: express.Request, res: express.Response) => {
  try {
    const requested = parseInt(req.body && req.body.count, 10) || 1;
    const count = Math.min(Math.max(requested, 1), 10);

    const memberId = req.member?.id;
    if (!memberId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Please log in to purchase IDs" }
      });
    }

    const mainCard = await MemberIdCard.findOne({ memberId, type: "MAIN" }).exec();
    if (!mainCard) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_MAIN_ID", message: "Please activate your membership (MAIN ID) first." }
      });
    }

    await idCardService.purchaseIds(memberId, count, null, null);

    const newCards = await MemberIdCard.find({ memberId })
      .sort({ createdAt: -1 })
      .limit(count)
      .populate({
        path: "mySystemNode",
        populate: {
          path: "parentNodeId",
          populate: {
            path: "idCardId",
            select: "cardNumber"
          }
        }
      })
      .populate("autoPoolNode")
      .exec();

    res.json({
      success: true,
      data: {
        purchased: newCards.length,
        cards: newCards.map((c: any) => ({
          cardNumber: c.cardNumber,
          type: c.type,
          placedUnder: c.mySystemNode && c.mySystemNode.parentNodeId ? c.mySystemNode.parentNodeId.idCardId?.cardNumber : "ROOT",
          side: c.mySystemNode ? c.mySystemNode.side : null,
          poolPosition: c.autoPoolNode ? c.autoPoolNode.globalPosition : null
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: "PURCHASE_FAILED", message: err.message }
    });
  }
});

export default router;
