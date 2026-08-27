"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = vendorAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Vendor_1 = require("../models/Vendor");
const Member_1 = require("../models/Member");
const Wallet_1 = require("../models/Wallet");
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
/**
 * Dedicated Vendor Authentication Middleware.
 * Enforces that decoded.type === "VENDOR" and attaches req.vendor and req.member.
 */
async function vendorAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" }
        });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Enforce strictly VENDOR token type
        if (decoded.type !== "VENDOR" || !decoded.vendorId) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Invalid token type: Vendor authentication required" }
            });
        }
        const vendor = await Vendor_1.Vendor.findById(decoded.vendorId).exec();
        if (!vendor) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Vendor account not found" }
            });
        }
        const member = await Member_1.Member.findById(vendor.memberId).exec();
        if (!member) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Vendor owner member not found" }
            });
        }
        const wallet = await Wallet_1.Wallet.findOne({ memberId: member.id }).exec();
        req.vendor = vendor;
        req.member = {
            ...member.toObject(),
            mainWallet: wallet
        };
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired vendor token" }
        });
    }
}
