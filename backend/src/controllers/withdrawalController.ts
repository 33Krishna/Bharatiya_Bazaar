import { Request, Response, NextFunction } from "express";
import {
  requestWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  previewWithdrawal
} from "../services/withdrawalService";
import { MemberIdCard } from "../models/MemberIdCard";
import { Withdrawal } from "../models/Withdrawal";
import mongoose from "mongoose";

export async function request(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    // Restrict withdrawals to MAIN card logins only
    if (req.loginContext && req.loginContext.isSubCard) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN_SUB_CARD",
          message: `Withdrawals can only be initiated when logged in as the MAIN ID (${req.member?.memberCode}). You are currently logged in as ${req.loginContext.loginCardNumber} (${req.loginContext.loginCardType}).`
        }
      });
    }

    const { idCardId, method, amountPaise, paymentDetails, idempotencyKey } = req.body;
    const memberId = req.member?.id;

    // Default to member's MAIN ID card if idCardId is not specified
    let targetCardId = idCardId;
    if (!targetCardId) {
      const mainCard = await MemberIdCard.findOne({ memberId, type: "MAIN" }).exec();
      if (!mainCard) {
        return res.status(400).json({
          success: false,
          error: { code: "NO_MAIN_CARD", message: "No MAIN ID card found for this member" }
        });
      }
      targetCardId = mainCard.id;
    }

    // Verify idCard belongs to member
    const idCard = await MemberIdCard.findOne({ _id: targetCardId, memberId }).exec();
    if (!idCard) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "ID Card does not belong to you or does not exist" }
      });
    }

    const withdrawal = await requestWithdrawal(
      memberId,
      targetCardId,
      method || "BANK",
      parseInt(amountPaise),
      paymentDetails,
      idempotencyKey || (req.headers["x-idempotency-key"] as string) || null
    );

    res.status(201).json({
      success: true,
      data: withdrawal
    });
  } catch (err: any) {
    if (err.message.includes("Insufficient funds")) {
      return res.status(400).json({ success: false, error: { code: "INSUFFICIENT_FUNDS", message: err.message } });
    }
    if (err.message.includes("ACB status required")) {
      return res.status(400).json({ success: false, error: { code: "ACB_REQUIRED", message: err.message } });
    }
    if (err.message.includes("Minimum withdrawal")) {
      return res.status(400).json({ success: false, error: { code: "MIN_WITHDRAWAL_LIMIT", message: err.message } });
    }
    if (err.message.includes("Invalid withdrawal method")) {
      return res.status(400).json({ success: false, error: { code: "INVALID_METHOD", message: err.message } });
    }
    next(err);
  }
}

export async function complete(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const withdrawalId = req.params.id || req.body.withdrawalId;
    if (!withdrawalId) {
      return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "withdrawalId required" } });
    }

    const completed = await completeWithdrawal(withdrawalId);
    res.json({
      success: true,
      data: completed
    });
  } catch (err: any) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: err.message } });
    }
    if (err.message.includes("already processed")) {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATUS_TRANSITION", message: err.message } });
    }
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const withdrawalId = req.params.id || req.body.withdrawalId;
    const reason = req.body.reason || "Rejected by admin";

    if (!withdrawalId) {
      return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "withdrawalId required" } });
    }

    const rejected = await rejectWithdrawal(withdrawalId, reason);
    res.json({
      success: true,
      data: rejected
    });
  } catch (err: any) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: err.message } });
    }
    if (err.message.includes("already processed")) {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATUS_TRANSITION", message: err.message } });
    }
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const withdrawals = await Withdrawal.find({ memberId: req.member?.id })
      .sort({ requestedAt: -1 })
      .exec();

    res.json({
      success: true,
      data: withdrawals
    });
  } catch (err) {
    next(err);
  }
}

export async function getTdsPreview(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { amountPaise, method } = req.query;
    if (!amountPaise || isNaN(parseInt(amountPaise as string))) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "amountPaise query param required and must be an integer" }
      });
    }

    const memberId = req.member ? req.member.id : null;
    const preview = await previewWithdrawal(memberId, (method as string) || "BANK", parseInt(amountPaise as string));

    res.json({
      success: true,
      data: preview
    });
  } catch (err) {
    next(err);
  }
}
