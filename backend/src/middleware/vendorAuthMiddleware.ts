import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Vendor } from "../models/Vendor";
import { Member } from "../models/Member";
import { Wallet } from "../models/Wallet";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

/**
 * Dedicated Vendor Authentication Middleware.
 * Enforces that decoded.type === "VENDOR" and attaches req.vendor and req.member.
 */
export default async function vendorAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" }
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Enforce strictly VENDOR token type
    if (decoded.type !== "VENDOR" || !decoded.vendorId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid token type: Vendor authentication required" }
      });
    }

    const vendor = await Vendor.findById(decoded.vendorId).exec();
    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Vendor account not found" }
      });
    }

    const member = await Member.findById(vendor.memberId).exec();
    if (!member) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Vendor owner member not found" }
      });
    }

    const wallet = await Wallet.findOne({ memberId: member.id }).exec();

    req.vendor = vendor;
    req.member = {
      ...member.toObject(),
      mainWallet: wallet
    } as any;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired vendor token" }
    });
  }
}
