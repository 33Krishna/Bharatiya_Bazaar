"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReferral = validateReferral;
exports.register = register;
exports.login = login;
exports.adminLogin = adminLogin;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const AdminUser_1 = require("../models/AdminUser");
const memberService_1 = require("../services/memberService");
const idCardService_1 = require("../services/idCardService");
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
async function validateReferral(req, res, next) {
    try {
        const { code } = req.query;
        const cleanCode = String(code || "").trim().toUpperCase();
        if (!cleanCode)
            return res.status(400).json({ success: false, error: { message: "Code required" } });
        // Find member by memberCode or idCard cardNumber
        const sponsor = await Member_1.Member.findOne({
            $or: [
                { memberCode: cleanCode },
                { idCards: { $elemMatch: { cardNumber: cleanCode } } } // Mongoose ref lookup or direct
            ]
        }).exec();
        // Fallback: If not found directly, check via MemberIdCard
        let sponsorMember = sponsor;
        if (!sponsorMember) {
            const idCard = await MemberIdCard_1.MemberIdCard.findOne({ cardNumber: cleanCode }).populate("memberId").exec();
            if (idCard && idCard.memberId) {
                sponsorMember = idCard.memberId;
            }
        }
        if (!sponsorMember) {
            return res.status(404).json({ success: false, error: { message: "Sponsor not found" } });
        }
        res.json({
            success: true,
            data: { name: sponsorMember.name, memberCode: sponsorMember.memberCode, valid: true }
        });
    }
    catch (err) {
        next(err);
    }
}
async function register(req, res, next) {
    try {
        const { name, mobile, email, address, pinCode, password, referralCode, side } = req.body;
        const existingMember = await Member_1.Member.findOne({ mobile }).exec();
        if (existingMember) {
            return res.status(409).json({ success: false, error: { code: "CONFLICT", message: "Mobile number already registered" } });
        }
        let sponsorIdCardId = null;
        if (referralCode && referralCode.trim()) {
            const cleanRef = referralCode.trim().toUpperCase();
            let sponsorCard = await MemberIdCard_1.MemberIdCard.findOne({ cardNumber: cleanRef }).exec();
            if (!sponsorCard) {
                // Find by member code of sponsor
                const sponsorMember = await Member_1.Member.findOne({ memberCode: cleanRef }).exec();
                if (sponsorMember) {
                    sponsorCard = await MemberIdCard_1.MemberIdCard.findOne({ memberId: sponsorMember.id, type: "MAIN" }).exec();
                }
            }
            if (!sponsorCard) {
                return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid sponsor code" } });
            }
            sponsorIdCardId = sponsorCard.id;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const member = await (0, memberService_1.createMember)({
            name, mobile, email, address, pinCode, kycTier: "NONE", kycStatus: "PENDING"
        });
        await Member_1.Member.findByIdAndUpdate(member.id, { passwordHash }).exec();
        // Trigger ID Card Creation & Tree Placement
        const sponsorSide = (side === "LEFT" || side === "RIGHT") ? side : "LEFT";
        const newCards = await (0, idCardService_1.purchaseIds)(member.id, 1, sponsorIdCardId, sponsorSide);
        // Re-fetch member to get the permanent memberCode
        const freshMember = await Member_1.Member.findById(member.id).exec();
        if (!freshMember)
            throw new Error("Registered member not found after creation");
        const freshCards = await MemberIdCard_1.MemberIdCard.find({ memberId: freshMember.id }).exec();
        const mainCard = freshCards.find(c => c.type === "MAIN") || freshCards[0];
        const loginCardNumber = mainCard ? mainCard.cardNumber : freshMember.memberCode;
        const token = jsonwebtoken_1.default.sign({
            id: freshMember.id,
            type: "MEMBER",
            loginCardId: mainCard?.id || null,
            loginCardNumber,
            loginCardType: "MAIN",
            isSubCard: false,
            ownerMemberCode: freshMember.memberCode
        }, JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({
            success: true,
            data: {
                member: { id: freshMember.id, memberCode: freshMember.memberCode, name: freshMember.name, mobile: freshMember.mobile },
                token,
                loginContext: {
                    loginCardId: mainCard?.id || null,
                    cardNumber: loginCardNumber,
                    cardType: "MAIN",
                    isSubCard: false,
                    ownerMemberCode: freshMember.memberCode
                }
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function login(req, res, next) {
    try {
        const { mobile, password } = req.body;
        const input = (mobile || "").trim();
        // Search by mobile, memberCode, or cardNumber
        let member = await Member_1.Member.findOne({
            $or: [
                { mobile: input },
                { memberCode: input }
            ]
        }).exec();
        let matchedCard = null;
        const idCards = member ? await MemberIdCard_1.MemberIdCard.find({ memberId: member.id }).exec() : [];
        if (!member) {
            // Search by card number directly
            matchedCard = await MemberIdCard_1.MemberIdCard.findOne({ cardNumber: { $regex: new RegExp(`^${input}$`, "i") } }).exec();
            if (matchedCard) {
                member = await Member_1.Member.findById(matchedCard.memberId).exec();
            }
        }
        else {
            matchedCard = idCards.find(c => c.cardNumber.toUpperCase() === input.toUpperCase());
        }
        if (!member || !member.passwordHash) {
            return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
        }
        const validPassword = await bcrypt_1.default.compare(password, member.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
        }
        const freshCards = idCards.length > 0 ? idCards : await MemberIdCard_1.MemberIdCard.find({ memberId: member.id }).exec();
        const mainCard = freshCards.find(c => c.type === "MAIN") || freshCards[0];
        const activeLoginCard = matchedCard || mainCard;
        const loginCardNumber = activeLoginCard ? activeLoginCard.cardNumber : member.memberCode;
        const loginCardType = activeLoginCard ? activeLoginCard.type : "MAIN";
        const loginCardId = activeLoginCard ? activeLoginCard.id : null;
        const token = jsonwebtoken_1.default.sign({
            id: member.id,
            type: "MEMBER",
            loginCardId,
            loginCardNumber,
            loginCardType
        }, JWT_SECRET, { expiresIn: "7d" });
        res.json({
            success: true,
            data: {
                member: { id: member.id, memberCode: member.memberCode, name: member.name, mobile: member.mobile },
                loginContext: {
                    cardNumber: loginCardNumber,
                    cardType: loginCardType,
                    isSubCard: loginCardType !== "MAIN",
                    ownerMemberCode: member.memberCode
                },
                token
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function adminLogin(req, res, next) {
    try {
        const { email, password } = req.body;
        const admin = await AdminUser_1.AdminUser.findOne({ email }).exec();
        if (!admin || !admin.passwordHash) {
            return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
        }
        const validPassword = await bcrypt_1.default.compare(password, admin.passwordHash);
        if (!validPassword && password !== admin.passwordHash) {
            return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
        }
        const token = jsonwebtoken_1.default.sign({ id: admin.id, type: "ADMIN", role: admin.role }, JWT_SECRET, { expiresIn: "1d" });
        res.json({
            success: true,
            data: {
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
                token
            }
        });
    }
    catch (err) {
        next(err);
    }
}
