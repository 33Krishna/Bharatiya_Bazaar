import { Request, Response, NextFunction } from "express";
import { getWalletBalance, getLedgerHistory } from "../services/walletService";
import { MemberIdCard } from "../models/MemberIdCard";
import { CommissionEntry } from "../models/CommissionEntry";
import mongoose from "mongoose";

export async function getBalance(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const memberId = req.member?.id;
    const wallet = await getWalletBalance(memberId);

    // Calculate per-card earnings & wallet bifurcation
    const idCards = await MemberIdCard.find({ memberId }).sort({ createdAt: 1 }).exec();
    const cardIds = idCards.map(c => c._id);

    const commissionEntries = await CommissionEntry.find({ idCardId: { $in: cardIds } }).exec();

    const breakdown = idCards.map(c => {
      let withdrawablePaise = 0;
      let onHoldPaise = 0;
      let totalPaise = 0;

      const cardComms = commissionEntries.filter(comm => comm.idCardId.toString() === c.id.toString());
      cardComms.forEach(comm => {
        totalPaise += comm.amountPaise;
        if (comm.status === "WITHDRAWABLE") {
          withdrawablePaise += comm.amountPaise;
        } else if (comm.status === "PENDING_7_DAY" || comm.status === "LOCKED_ACB") {
          onHoldPaise += comm.amountPaise;
        }
      });

      return {
        cardId: c.id,
        cardNumber: c.cardNumber,
        cardType: c.type,
        acbStatus: c.acbStatus,
        withdrawablePaise,
        onHoldPaise,
        totalPaise,
        isCurrentLogin: req.loginContext?.loginCardNumber === c.cardNumber
      };
    });

    let filteredBreakdown = breakdown;
    let cardEarnings = null;

    if (req.loginContext?.isSubCard) {
      const active = breakdown.find(b => b.cardNumber === req.loginContext?.loginCardNumber) || breakdown[0];
      filteredBreakdown = active ? [active] : [];
      cardEarnings = active ? {
        cardTotalPaise: active.totalPaise,
        cardWithdrawablePaise: active.withdrawablePaise,
        cardOnHoldPaise: active.onHoldPaise,
        acbStatus: active.acbStatus,
        cardNumber: active.cardNumber,
        cardType: active.cardType
      } : null;
    }

    res.json({
      success: true,
      data: {
        ...wallet,
        loginContext: req.loginContext,
        cardEarnings,
        breakdown: filteredBreakdown
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getLedger(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const memberId = req.member?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const history = await getLedgerHistory(memberId, limit, offset);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
}

export async function getCommissions(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const memberId = req.member?.id;
    const idCards = await MemberIdCard.find({ memberId }).select("id cardNumber type").exec();

    const cardMap: Record<string, { cardNumber: string; cardType: string }> = {};
    idCards.forEach(c => {
      cardMap[c.id] = { cardNumber: c.cardNumber, cardType: c.type };
    });

    const whereClause = req.loginContext?.isSubCard && req.loginContext?.loginCardId
      ? { idCardId: req.loginContext.loginCardId }
      : { idCardId: { $in: idCards.map(i => i.id) } };

    const limit = parseInt(req.query.limit as string) || 50;
    const commissions = await CommissionEntry.find(whereClause)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    const enriched = commissions.map(c => {
      const cardInfo = cardMap[c.idCardId.toString()];
      return {
        ...c.toObject(),
        cardNumber: cardInfo?.cardNumber || null,
        cardType: cardInfo?.cardType || null,
        isCurrentLogin: req.loginContext?.loginCardNumber === cardInfo?.cardNumber
      };
    });

    res.json({
      success: true,
      data: enriched,
      loginContext: req.loginContext
    });
  } catch (err) {
    next(err);
  }
}
