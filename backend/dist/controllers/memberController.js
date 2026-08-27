"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateKyc = updateKyc;
exports.getMySystemTree = getMySystemTree;
exports.getAutoPoolTree = getAutoPoolTree;
exports.checkAvailability = checkAvailability;
exports.getMyPlacement = getMyPlacement;
exports.getMyReferralCount = getMyReferralCount;
exports.getAutoPoolExplorer = getAutoPoolExplorer;
exports.getNotifications = getNotifications;
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const MySystemNode_1 = require("../models/MySystemNode");
const AutoPoolNode_1 = require("../models/AutoPoolNode");
const Wallet_1 = require("../models/Wallet");
const LedgerEntry_1 = require("../models/LedgerEntry");
const Withdrawal_1 = require("../models/Withdrawal");
const Voucher_1 = require("../models/Voucher");
const VendorReferralBonus_1 = require("../models/VendorReferralBonus");
const CommissionEntry_1 = require("../models/CommissionEntry");
const mongoose_1 = __importDefault(require("mongoose"));
async function getProfile(req, res, next) {
    try {
        const memberId = req.member?.id;
        const member = await Member_1.Member.findById(memberId).exec();
        if (!member) {
            return res.status(404).json({ success: false, error: { message: "Member not found" } });
        }
        const mainWallet = await Wallet_1.Wallet.findOne({ memberId }).exec();
        const idCards = await MemberIdCard_1.MemberIdCard.find({ memberId }).exec();
        const vouchers = await Voucher_1.Voucher.find({ memberId }).exec();
        const activeCard = idCards.find(c => c.cardNumber === req.loginContext?.loginCardNumber) ||
            idCards.find(c => c.type === "MAIN") ||
            idCards[0];
        res.json({
            success: true,
            data: {
                ...member.toObject(),
                mainWallet,
                idCards,
                vouchers,
                activeCard: activeCard ? {
                    id: activeCard.id,
                    cardNumber: activeCard.cardNumber,
                    type: activeCard.type,
                    acbStatus: activeCard.acbStatus
                } : null
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function updateKyc(req, res, next) {
    try {
        const { panNumber } = req.body;
        const memberId = req.member?.id;
        const updated = await Member_1.Member.findByIdAndUpdate(memberId, {
            panNumber,
            kycStatus: "PENDING"
        }, { new: true }).exec();
        res.json({
            success: true,
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
}
async function getMySystemTree(req, res, next) {
    try {
        if (req.loginContext?.loginCardType === "REBIRTH") {
            return res.json({
                success: true,
                data: null,
                isRebirth: true,
                message: "Rebirth IDs participate exclusively in AutoPool."
            });
        }
        const memberId = req.member?.id;
        const targetCard = req.loginContext?.isSubCard && req.loginContext?.loginCardId
            ? await MemberIdCard_1.MemberIdCard.findById(req.loginContext.loginCardId).exec()
            : await MemberIdCard_1.MemberIdCard.findOne({ memberId, type: "MAIN" }).exec();
        if (!targetCard) {
            return res.json({ success: true, data: null });
        }
        const rootNode = await MySystemNode_1.MySystemNode.findOne({ idCardId: targetCard.id }).exec();
        if (!rootNode) {
            return res.json({ success: true, data: null });
        }
        const allNodes = await MySystemNode_1.MySystemNode.find({})
            .populate({
            path: "idCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .populate({
            path: "sponsorIdCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .exec();
        function buildTree(nodeId, depth) {
            const node = allNodes.find(n => n.id === nodeId);
            if (!node || depth > 6)
                return null;
            const children = allNodes.filter(n => n.parentNodeId?.toString() === nodeId);
            const left = children.find(c => c.side === "LEFT");
            const right = children.find(c => c.side === "RIGHT");
            const idCard = node.idCardId;
            const sponsorCard = node.sponsorIdCardId;
            return {
                id: node.id,
                memberName: idCard?.memberId?.name || "—",
                memberCode: idCard?.memberId?.memberCode || "—",
                cardNumber: idCard?.cardNumber || "—",
                cardType: idCard?.type || "MAIN",
                acbStatus: idCard?.acbStatus || false,
                joinedAt: idCard?.createdAt,
                acbUnlockedAt: idCard?.acbUnlockedAt || null,
                side: node.side,
                placementType: node.placementType,
                sponsorName: sponsorCard?.memberId?.name || null,
                sponsorCode: sponsorCard?.memberId?.memberCode || null,
                sponsorCardNumber: sponsorCard?.cardNumber || null,
                parentId: node.parentNodeId,
                children: {
                    LEFT: left ? buildTree(left.id, depth + 1) : null,
                    RIGHT: right ? buildTree(right.id, depth + 1) : null
                }
            };
        }
        const tree = buildTree(rootNode.id, 0);
        function countLeg(node, side) {
            if (!node)
                return 0;
            let count = 0;
            if (node.side === side)
                count++;
            count += countLeg(node.children?.LEFT, side);
            count += countLeg(node.children?.RIGHT, side);
            return count;
        }
        const stats = {
            leftLegSize: countLeg(tree, "LEFT"),
            rightLegSize: countLeg(tree, "RIGHT"),
            totalNetwork: countLeg(tree, "LEFT") + countLeg(tree, "RIGHT"),
            hasDirectLeft: !!tree?.children?.LEFT,
            hasDirectRight: !!tree?.children?.RIGHT,
            acbStatus: targetCard.acbStatus
        };
        res.json({ success: true, data: { tree, stats } });
    }
    catch (err) {
        next(err);
    }
}
async function getAutoPoolTree(req, res, next) {
    try {
        const memberId = req.member?.id;
        const targetCard = req.loginContext?.loginCardId
            ? await MemberIdCard_1.MemberIdCard.findById(req.loginContext.loginCardId).exec()
            : await MemberIdCard_1.MemberIdCard.findOne({ memberId, type: "MAIN" }).exec();
        const myPoolNode = targetCard
            ? await AutoPoolNode_1.AutoPoolNode.findOne({ idCardId: targetCard.id }).exec()
            : null;
        const allNodes = await AutoPoolNode_1.AutoPoolNode.find({})
            .populate({
            path: "idCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .exec();
        // Fetch MySystemNode mappings for sponsor details
        const mySystemNodes = await MySystemNode_1.MySystemNode.find({})
            .populate("idCardId")
            .populate({
            path: "sponsorIdCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .exec();
        const systemNodeMap = {};
        for (const m of mySystemNodes) {
            if (m.idCardId) {
                systemNodeMap[m.idCardId._id.toString()] = m;
            }
        }
        const positionMap = {};
        for (const n of allNodes) {
            const idCard = n.idCardId;
            const sysNode = systemNodeMap[idCard?._id.toString()];
            const sponsorCard = sysNode?.sponsorIdCardId;
            positionMap[n.globalPosition] = {
                id: n.id,
                position: n.globalPosition,
                level: n.depthLevel,
                side: n.side,
                memberId: idCard?.memberId?._id,
                memberName: idCard?.memberId?.name || "—",
                memberCode: idCard?.memberId?.memberCode || idCard?.cardNumber || "—",
                cardNumber: idCard?.cardNumber,
                cardType: idCard?.type || "MAIN",
                acbStatus: idCard?.acbStatus || false,
                acbUnlockedAt: idCard?.acbUnlockedAt || null,
                joinedAt: idCard?.createdAt,
                sponsorCode: sponsorCard?.memberId?.memberCode || null,
                sponsorName: sponsorCard?.memberId?.name || null
            };
        }
        function buildTree(pos, levelsLeft, currentDepth) {
            const node = positionMap[pos];
            const result = node
                ? { ...node, filled: true }
                : { position: pos, level: currentDepth, filled: false, side: pos % 2 === 0 ? "LEFT" : "RIGHT" };
            if (levelsLeft > 0) {
                result.children = {
                    LEFT: buildTree(pos * 2, levelsLeft - 1, currentDepth + 1),
                    RIGHT: buildTree(pos * 2 + 1, levelsLeft - 1, currentDepth + 1)
                };
            }
            return result;
        }
        const globalTree = buildTree(1, 4, 0);
        let myStats = null;
        let myTree = null;
        const levelStatus = [];
        if (myPoolNode && targetCard) {
            const p = myPoolNode.globalPosition;
            myTree = buildTree(p, 3, myPoolNode.depthLevel);
            let rebirthIds = 0, vouchersPaise = 0;
            for (let lvl = 1; lvl <= 7; lvl++) {
                const size = Math.pow(2, lvl);
                const start = p * size;
                let filled = 0;
                for (let i = start; i < start + size; i++)
                    if (positionMap[i])
                        filled++;
                const complete = filled === size;
                if (complete) {
                    if (lvl >= 4)
                        rebirthIds += 1;
                    if (lvl >= 5)
                        vouchersPaise += 20000;
                }
                levelStatus.push({ level: lvl, size, filled, complete });
            }
            const apSum = await CommissionEntry_1.CommissionEntry.aggregate([
                {
                    $match: {
                        idCardId: new mongoose_1.default.Types.ObjectId(targetCard.id),
                        stream: "AUTOPOOL"
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: "$amountPaise" }
                    }
                }
            ]).exec();
            const cashEarnedPaise = apSum.length > 0 ? apSum[0].totalEarnings : 0;
            myStats = {
                position: p,
                level: myPoolNode.depthLevel,
                totalInPool: allNodes.length,
                highestLevel: Math.max(...allNodes.map(n => n.depthLevel)),
                cashEarnedPaise,
                rebirthIds,
                vouchersPaise
            };
        }
        res.json({ success: true, data: { globalTree, myTree, myStats, levelStatus } });
    }
    catch (err) {
        next(err);
    }
}
async function checkAvailability(req, res, next) {
    try {
        const { mobile, email } = req.query;
        if (!mobile) {
            return res.status(400).json({ success: false, message: "Mobile is required" });
        }
        const existingMobile = await Member_1.Member.findOne({ mobile: String(mobile) }).exec();
        if (existingMobile) {
            return res.json({
                success: true,
                available: false,
                reason: "mobile",
                message: "This mobile number is already registered"
            });
        }
        if (email) {
            const existingEmail = await Member_1.Member.findOne({ email: String(email) }).exec();
            if (existingEmail) {
                return res.json({
                    success: true,
                    available: false,
                    reason: "email",
                    message: "This email is already registered"
                });
            }
        }
        res.json({ success: true, available: true });
    }
    catch (err) {
        next(err);
    }
}
async function getMyPlacement(req, res, next) {
    try {
        if (req.loginContext?.loginCardType === "REBIRTH") {
            return res.json({ success: true, data: null, message: "Rebirth IDs are not placed in MY SYSTEM." });
        }
        const targetCard = req.loginContext?.isSubCard && req.loginContext?.loginCardId
            ? await MemberIdCard_1.MemberIdCard.findById(req.loginContext.loginCardId).exec()
            : await MemberIdCard_1.MemberIdCard.findOne({ memberId: req.member?.id, type: "MAIN" }).exec();
        if (!targetCard)
            return res.json({ success: true, data: null });
        const node = await MySystemNode_1.MySystemNode.findOne({ idCardId: targetCard.id })
            .populate({
            path: "idCardId",
            populate: { path: "memberId", select: "memberCode name" }
        })
            .populate({
            path: "sponsorIdCardId",
            populate: { path: "memberId", select: "memberCode name" }
        })
            .populate({
            path: "parentNodeId",
            populate: {
                path: "idCardId",
                populate: { path: "memberId", select: "memberCode name" }
            }
        })
            .exec();
        if (!node)
            return res.json({ success: true, data: null });
        const idCard = node.idCardId;
        const sponsorCard = node.sponsorIdCardId;
        const parentNode = node.parentNodeId;
        res.json({
            success: true,
            data: {
                memberCode: idCard?.memberId?.memberCode,
                cardNumber: idCard?.cardNumber,
                side: node.side,
                placementType: node.placementType,
                sponsoredBy: sponsorCard?.memberId?.memberCode || null,
                sponsoredByCard: sponsorCard?.cardNumber || null,
                sponsorName: sponsorCard?.memberId?.name || null,
                placedUnder: parentNode?.idCardId?.memberId?.memberCode || null,
                placedUnderCard: parentNode?.idCardId?.cardNumber || null,
                placedUnderName: parentNode?.idCardId?.memberId?.name || null
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function getMyReferralCount(req, res, next) {
    try {
        if (req.loginContext?.loginCardType === "REBIRTH") {
            return res.json({ success: true, data: { directReferrals: 0, left: 0, right: 0, total: 0 } });
        }
        const targetCard = req.loginContext?.isSubCard && req.loginContext?.loginCardId
            ? await MemberIdCard_1.MemberIdCard.findById(req.loginContext.loginCardId).exec()
            : await MemberIdCard_1.MemberIdCard.findOne({ memberId: req.member?.id, type: "MAIN" }).exec();
        if (!targetCard)
            return res.json({ success: true, data: { directReferrals: 0, left: 0, right: 0, total: 0 } });
        const [leftCount, rightCount] = await Promise.all([
            MySystemNode_1.MySystemNode.countDocuments({ sponsorIdCardId: targetCard.id, side: "LEFT" }),
            MySystemNode_1.MySystemNode.countDocuments({ sponsorIdCardId: targetCard.id, side: "RIGHT" })
        ]);
        res.json({
            success: true,
            data: {
                directReferrals: leftCount + rightCount,
                left: leftCount,
                right: rightCount,
                total: leftCount + rightCount
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function getAutoPoolExplorer(req, res, next) {
    try {
        const { root, depth = 7 } = req.query;
        const maxDepth = Math.min(Math.max(parseInt(String(depth)) || 7, 1), 7);
        let rootCard = null;
        let rootNode = null;
        if (root) {
            const rootStr = String(root).trim().toUpperCase();
            if (rootStr.startsWith("BB") || rootStr.startsWith("SB") || rootStr.startsWith("RB")) {
                rootCard = await MemberIdCard_1.MemberIdCard.findOne({ cardNumber: rootStr }).exec();
                if (rootCard) {
                    rootNode = await AutoPoolNode_1.AutoPoolNode.findOne({ idCardId: rootCard.id }).exec();
                }
            }
            else if (!isNaN(parseInt(rootStr))) {
                rootNode = await AutoPoolNode_1.AutoPoolNode.findOne({ globalPosition: parseInt(rootStr) }).exec();
                if (rootNode) {
                    rootCard = await MemberIdCard_1.MemberIdCard.findById(rootNode.idCardId).exec();
                }
            }
        }
        else {
            const targetCardId = req.loginContext?.loginCardId
                ? req.loginContext.loginCardId
                : (await MemberIdCard_1.MemberIdCard.findOne({ memberId: req.member?.id, type: "MAIN" }))?.id;
            rootNode = await AutoPoolNode_1.AutoPoolNode.findOne({ idCardId: targetCardId }).exec();
            if (rootNode) {
                rootCard = await MemberIdCard_1.MemberIdCard.findById(rootNode.idCardId).exec();
            }
        }
        if (!rootNode || !rootCard) {
            return res.status(404).json({
                success: false,
                error: { code: "NOT_FOUND", message: `AutoPool node for "${root || 'active card'}" not found.` }
            });
        }
        const p = rootNode.globalPosition;
        const ranges = [];
        for (let lvl = 0; lvl <= maxDepth; lvl++) {
            const start = p * Math.pow(2, lvl);
            const end = start + Math.pow(2, lvl) - 1;
            ranges.push({ globalPosition: { $gte: start, $lte: end } });
        }
        const allNodes = await AutoPoolNode_1.AutoPoolNode.find({ $or: ranges })
            .populate({
            path: "idCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .exec();
        const mySystemNodes = await MySystemNode_1.MySystemNode.find({})
            .populate({
            path: "sponsorIdCardId",
            populate: { path: "memberId", select: "name memberCode" }
        })
            .exec();
        const sysNodeMap = {};
        for (const m of mySystemNodes) {
            sysNodeMap[m.idCardId.toString()] = m;
        }
        const positionMap = {};
        for (const n of allNodes) {
            const idCard = n.idCardId;
            const sysNode = sysNodeMap[idCard?._id.toString()];
            const sponsorCard = sysNode?.sponsorIdCardId;
            positionMap[n.globalPosition] = {
                id: n.id,
                position: n.globalPosition,
                level: n.depthLevel,
                side: n.side,
                memberId: idCard?.memberId?._id,
                memberName: idCard?.memberId?.name || "—",
                memberCode: idCard?.memberId?.memberCode || idCard?.cardNumber || "—",
                cardNumber: idCard?.cardNumber,
                cardType: idCard?.type || "MAIN",
                acbStatus: idCard?.acbStatus || false,
                acbUnlockedAt: idCard?.acbUnlockedAt || null,
                joinedAt: idCard?.createdAt,
                sponsorCode: sponsorCard?.memberId?.memberCode || null,
                sponsorName: sponsorCard?.memberId?.name || null
            };
        }
        function buildSparseTree(pos, levelsLeft, currentDepth) {
            const node = positionMap[pos];
            if (!node) {
                return {
                    position: pos,
                    level: currentDepth,
                    filled: false,
                    side: pos % 2 === 0 ? "LEFT" : "RIGHT"
                };
            }
            const result = {
                ...node,
                filled: true
            };
            if (levelsLeft > 0) {
                const leftPos = pos * 2;
                const rightPos = pos * 2 + 1;
                result.children = {
                    LEFT: buildSparseTree(leftPos, levelsLeft - 1, currentDepth + 1),
                    RIGHT: buildSparseTree(rightPos, levelsLeft - 1, currentDepth + 1)
                };
            }
            return result;
        }
        const tree = buildSparseTree(p, maxDepth, rootNode.depthLevel);
        res.json({
            success: true,
            data: {
                rootNode: positionMap[p],
                tree,
                depth: maxDepth,
                totalFilled: allNodes.length
            }
        });
    }
    catch (err) {
        next(err);
    }
}
async function getNotifications(req, res, next) {
    try {
        const memberId = req.member?.id;
        const [ledgerEntries, withdrawals, rebirthCards, acbCards, referralBonuses, vouchers] = await Promise.all([
            // 1. Ledger credits (wallet credits)
            Wallet_1.Wallet.findOne({ memberId }).exec().then(async (wallet) => {
                if (!wallet)
                    return [];
                return await LedgerEntry_1.LedgerEntry.find({ walletId: wallet.id, type: "CREDIT" })
                    .sort({ createdAt: -1 })
                    .limit(30)
                    .exec();
            }),
            // 2. Withdrawals
            Withdrawal_1.Withdrawal.find({ memberId }).sort({ requestedAt: -1 }).limit(20).exec(),
            // 3. Rebirth cards
            MemberIdCard_1.MemberIdCard.find({ memberId, type: "REBIRTH" }).sort({ createdAt: -1 }).limit(20).exec(),
            // 4. ACB Unlocks
            MemberIdCard_1.MemberIdCard.find({ memberId, acbStatus: true }).sort({ createdAt: -1 }).limit(20).exec(),
            // 5. Vendor referral bonuses
            VendorReferralBonus_1.VendorReferralBonus.find({ memberId }).sort({ createdAt: -1 }).limit(20).exec(),
            // 6. Vouchers issued
            Voucher_1.Voucher.find({ memberId }).sort({ issuedAt: -1 }).limit(20).exec()
        ]);
        const notifications = [];
        // 1. Ledger Entries
        for (const l of ledgerEntries) {
            notifications.push({
                id: `ledger-${l.id}`,
                type: "WALLET_CREDIT",
                category: "COMMISSION",
                title: "Wallet Credit Received",
                message: `₹${(l.amountPaise / 100).toFixed(2)} credited to your wallet (${l.description || l.source})`,
                timestamp: l.createdAt.toISOString()
            });
        }
        // 2. Withdrawals
        for (const w of withdrawals) {
            notifications.push({
                id: `wd-${w.id}`,
                type: "WITHDRAWAL_STATUS",
                category: "WITHDRAWAL",
                title: `Withdrawal ${w.status}`,
                message: `Withdrawal request for ₹${(w.grossPaise / 100).toFixed(2)} via ${w.method} is currently ${w.status}${w.rejectionReason ? ': ' + w.rejectionReason : ''}`,
                timestamp: (w.completedAt || w.requestedAt).toISOString()
            });
        }
        // 3. Rebirth Cards
        for (const r of rebirthCards) {
            notifications.push({
                id: `rebirth-${r.id}`,
                type: "REBIRTH_GENERATED",
                category: "LIFECYCLE",
                title: "Rebirth ID Generated 🎉",
                message: `Rebirth ID Card #${r.cardNumber} was auto-generated and placed into the AutoPool tree.`,
                timestamp: r.createdAt.toISOString()
            });
        }
        // 4. ACB Cards
        for (const a of acbCards) {
            notifications.push({
                id: `acb-${a.id}`,
                type: "ACB_UNLOCKED",
                category: "LIFECYCLE",
                title: "ACB Qualification Achieved 🚀",
                message: `Card #${a.cardNumber} has unlocked Active Commission Beneficiary (ACB) status for AutoPool payouts.`,
                timestamp: (a.acbUnlockedAt || a.createdAt).toISOString()
            });
        }
        // 5. Referral Bonuses
        for (const b of referralBonuses) {
            notifications.push({
                id: `ref-${b.id}`,
                type: "REFERRAL_BONUS",
                category: "SETU_KOSH",
                title: "Merchant Referral Bonus",
                message: `Earned ₹${(b.bonusPaise / 100).toFixed(2)} referral bonus from store purchase (Status: ${b.status}).`,
                timestamp: b.createdAt.toISOString()
            });
        }
        // 6. Vouchers
        for (const v of vouchers) {
            notifications.push({
                id: `voucher-${v.id}`,
                type: "VOUCHER_ISSUED",
                category: "COMMISSION",
                title: "Reward Voucher Issued 🎁",
                message: `Reward voucher worth ₹${(v.faceValuePaise / 100).toFixed(2)} issued (Status: ${v.status}).`,
                timestamp: v.issuedAt.toISOString()
            });
        }
        // Sort descending by timestamp and cap at latest 50
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const cappedNotifications = notifications.slice(0, 50);
        res.json({
            success: true,
            data: cappedNotifications
        });
    }
    catch (err) {
        next(err);
    }
}
