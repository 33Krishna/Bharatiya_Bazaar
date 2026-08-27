"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.getLedger = getLedger;
exports.getCommissions = getCommissions;
const walletService_1 = require("../services/walletService");
const MemberIdCard_1 = require("../models/MemberIdCard");
const CommissionEntry_1 = require("../models/CommissionEntry");
async function getBalance(req, res, next) {
    try {
        const memberId = req.member?.id;
        const wallet = await (0, walletService_1.getWalletBalance)(memberId);
        // Calculate per-card earnings & wallet bifurcation
        const idCards = await MemberIdCard_1.MemberIdCard.find({ memberId }).sort({ createdAt: 1 }).exec();
        const cardIds = idCards.map(c => c._id);
        const commissionEntries = await CommissionEntry_1.CommissionEntry.find({ idCardId: { $in: cardIds } }).exec();
        const breakdown = idCards.map(c => {
            let withdrawablePaise = 0;
            let onHoldPaise = 0;
            let totalPaise = 0;
            const cardComms = commissionEntries.filter(comm => comm.idCardId.toString() === c.id.toString());
            cardComms.forEach(comm => {
                totalPaise += comm.amountPaise;
                if (comm.status === "WITHDRAWABLE") {
                    withdrawablePaise += comm.amountPaise;
                }
                else if (comm.status === "PENDING_7_DAY" || comm.status === "LOCKED_ACB") {
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
    }
    catch (err) {
        next(err);
    }
}
async function getLedger(req, res, next) {
    try {
        const memberId = req.member?.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const history = await (0, walletService_1.getLedgerHistory)(memberId, limit, offset);
        res.json({
            success: true,
            data: history
        });
    }
    catch (err) {
        next(err);
    }
}
async function getCommissions(req, res, next) {
    try {
        const memberId = req.member?.id;
        const idCards = await MemberIdCard_1.MemberIdCard.find({ memberId }).select("id cardNumber type").exec();
        const cardMap = {};
        idCards.forEach(c => {
            cardMap[c.id] = { cardNumber: c.cardNumber, cardType: c.type };
        });
        const whereClause = req.loginContext?.isSubCard && req.loginContext?.loginCardId
            ? { idCardId: req.loginContext.loginCardId }
            : { idCardId: { $in: idCards.map(i => i.id) } };
        const limit = parseInt(req.query.limit) || 50;
        const commissions = await CommissionEntry_1.CommissionEntry.find(whereClause)
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
    }
    catch (err) {
        next(err);
    }
}
