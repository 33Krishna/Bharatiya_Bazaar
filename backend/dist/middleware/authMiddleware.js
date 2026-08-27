"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Member_1 = require("../models/Member");
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
async function authMiddleware(req, res, next) {
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
        // Cross-auth protection: Reject VENDOR tokens on member endpoints
        if (decoded.type === "VENDOR") {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Vendor tokens cannot access member endpoints" }
            });
        }
        // Attach member to request
        const member = await Member_1.Member.findById(decoded.id).exec();
        if (!member) {
            return res.status(401).json({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Member not found" }
            });
        }
        req.member = member;
        req.loginContext = {
            loginCardId: decoded.loginCardId || null,
            cardId: decoded.loginCardId || null,
            cardNumber: decoded.loginCardNumber || member.memberCode || "",
            loginCardNumber: decoded.loginCardNumber || member.memberCode || "",
            cardType: decoded.loginCardType || "MAIN",
            loginCardType: decoded.loginCardType || "MAIN",
            isSubCard: decoded.loginCardType ? decoded.loginCardType !== "MAIN" : false,
            ownerMemberCode: member.memberCode || null
        };
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired token" }
        });
    }
}
