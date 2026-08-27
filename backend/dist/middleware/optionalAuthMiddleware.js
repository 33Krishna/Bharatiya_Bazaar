"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = optionalAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Member_1 = require("../models/Member");
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
/**
 * Optional Authentication Middleware.
 * If a valid Bearer token is provided, attaches req.member and req.loginContext.
 * If no token is provided, allows request to proceed with req.member = null.
 */
async function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.member = null;
        req.loginContext = null;
        return next();
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Cross-auth protection: Reject VENDOR or ADMIN tokens when authenticating as member
        if (decoded.type === "VENDOR" || decoded.type === "ADMIN") {
            req.member = null;
            req.loginContext = null;
            return next();
        }
        const member = await Member_1.Member.findById(decoded.id).exec();
        if (member && member.status !== "BLOCKED") {
            req.member = member;
            req.loginContext = {
                loginCardId: decoded.loginCardId || null,
                cardNumber: decoded.loginCardNumber || member.memberCode || "",
                loginCardNumber: decoded.loginCardNumber || member.memberCode || "",
                cardType: decoded.loginCardType || "MAIN",
                loginCardType: decoded.loginCardType || "MAIN",
                isSubCard: decoded.loginCardType ? decoded.loginCardType !== "MAIN" : false,
                ownerMemberCode: member.memberCode || null
            };
        }
        else {
            req.member = null;
            req.loginContext = null;
        }
    }
    catch (err) {
        req.member = null;
        req.loginContext = null;
    }
    next();
}
