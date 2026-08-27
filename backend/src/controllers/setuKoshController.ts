import { Request, Response, NextFunction } from "express";
import { recordPurchase, getMemberCounter, getSetuKoshTree } from "../services/setuKoshService";

export async function purchase(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { vendorId, amountPaise, memberId, idCardId, idempotencyKey } = req.body;
    const targetMemberId = memberId || req.member?.id;

    if (!vendorId || !amountPaise || parseInt(amountPaise) <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "vendorId and positive amountPaise are required" }
      });
    }

    const result = await recordPurchase(targetMemberId, vendorId, parseInt(amountPaise), {
      idCardId,
      idempotencyKey: idempotencyKey || (req.headers["x-idempotency-key"] as string) || null
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getCounter(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const memberId = req.params.memberId || req.member?.id;
    if (!memberId) {
      return res.status(400).json({ success: false, error: { message: "Member ID required" } });
    }

    const counter = await getMemberCounter(memberId);
    res.json({
      success: true,
      data: counter
    });
  } catch (err) {
    next(err);
  }
}

export async function getTree(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    const { root = 1, depth = 10 } = req.query;
    const tree = await getSetuKoshTree(parseInt(root as string), parseInt(depth as string));
    if (!tree) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `Setu Kosh node at position ${root} not found` }
      });
    }

    res.json({
      success: true,
      data: tree
    });
  } catch (err) {
    next(err);
  }
}
