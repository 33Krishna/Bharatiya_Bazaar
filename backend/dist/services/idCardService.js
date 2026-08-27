"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseIds = purchaseIds;
const Member_1 = require("../models/Member");
const MemberIdCard_1 = require("../models/MemberIdCard");
const AutoPoolNode_1 = require("../models/AutoPoolNode");
const MySystemNode_1 = require("../models/MySystemNode");
const SystemCounter_1 = require("../models/SystemCounter");
const commissionService = __importStar(require("./commissionService"));
const acbService = __importStar(require("./acbService"));
const rebirthService = __importStar(require("./rebirthService"));
const adminService = __importStar(require("./adminService"));
const mongoose_1 = __importDefault(require("mongoose"));
async function purchaseIds(memberId, count, sponsorIdCardId = null, sponsorSide = null) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const existingCards = await MemberIdCard_1.MemberIdCard.find({ memberId }).session(session).exec();
        // Enforce MAX_PURCHASED_IDS (rebirths are exempt)
        const maxPurchasedIds = await adminService.getSetting("MAX_PURCHASED_IDS", 255, "integer", { session });
        const nonRebirthCount = existingCards.filter(c => c.type !== "REBIRTH").length;
        if (nonRebirthCount + count > maxPurchasedIds) {
            const err = new Error(`Cannot purchase ${count} IDs. Member already owns ${nonRebirthCount} purchased IDs (Limit: ${maxPurchasedIds}).`);
            err.code = "ID_PURCHASE_LIMIT_REACHED";
            err.status = 400;
            throw err;
        }
        const hasMain = existingCards.some(c => c.type === "MAIN");
        const bulkMode = count > 1;
        // Snapshot the member's existing MY SYSTEM tree nodes ONCE
        const existingNodes = await MySystemNode_1.MySystemNode.find({ idCardId: { $in: existingCards.map(c => c.id) } })
            .session(session)
            .exec();
        const childrenMap = {};
        const nodeCardMap = {};
        for (const n of existingNodes) {
            nodeCardMap[n.id] = n.idCardId.toString();
            if (n.parentNodeId) {
                const parentIdStr = n.parentNodeId.toString();
                if (!childrenMap[parentIdStr])
                    childrenMap[parentIdStr] = [];
                childrenMap[parentIdStr].push({ id: n.id, side: n.side || "" });
            }
        }
        let existingMainNodeId = null;
        if (hasMain) {
            const mainCard = existingCards.find(c => c.type === "MAIN");
            if (mainCard) {
                const mn = existingNodes.find(n => n.idCardId.toString() === mainCard.id);
                if (mn)
                    existingMainNodeId = mn.id;
            }
        }
        // Initialize AUTOPOOL_GLOBAL counter
        let counterExists = await SystemCounter_1.SystemCounter.findById("AUTOPOOL_GLOBAL").session(session).exec();
        if (!counterExists) {
            const maxNode = await AutoPoolNode_1.AutoPoolNode.findOne({}).sort({ globalPosition: -1 }).session(session).exec();
            const seedPosition = maxNode ? maxNode.globalPosition : 0;
            counterExists = await SystemCounter_1.SystemCounter.create([
                {
                    _id: "AUTOPOOL_GLOBAL",
                    currentValue: seedPosition,
                },
            ], { session }).then(res => res[0]);
        }
        const queue = [];
        for (let i = 0; i < count; i++) {
            queue.push({
                memberId: memberId.toString(),
                type: !hasMain && i === 0 ? "MAIN" : "SUB",
                sponsorIdCardId,
                sponsorSide,
            });
        }
        const newCards = [];
        let firstMySystemNodeId = existingMainNodeId;
        let processedCount = 0;
        while (queue.length > 0) {
            if (processedCount++ >= 500) {
                throw new Error("Queue limit of 500 exceeded.");
            }
            const item = queue.shift();
            // Increment global counter
            const counter = await SystemCounter_1.SystemCounter.findByIdAndUpdate("AUTOPOOL_GLOBAL", { $inc: { currentValue: 1 } }, { new: true, session }).exec();
            if (!counter)
                throw new Error("Could not increment AUTOPOOL_GLOBAL counter");
            const globalPosition = counter.currentValue;
            let autoPoolParentNodeId = null;
            let autoPoolSide = null;
            if (globalPosition > 1) {
                const parentPosition = Math.floor(globalPosition / 2);
                const parentNode = await AutoPoolNode_1.AutoPoolNode.findOne({ globalPosition: parentPosition }).session(session).exec();
                if (parentNode) {
                    autoPoolParentNodeId = parentNode.id;
                    autoPoolSide = globalPosition % 2 === 0 ? "LEFT" : "RIGHT";
                }
            }
            const prefix = item.type === "SUB" ? "SB" : item.type === "REBIRTH" ? "RB" : "BB";
            const cardNumber = prefix + String(10000 + globalPosition).padStart(5, "0");
            // Ensure memberCode matches MAIN card number
            if (item.type === "MAIN") {
                await Member_1.Member.findByIdAndUpdate(item.memberId, { memberCode: cardNumber }, { session }).exec();
            }
            const idCardArr = await MemberIdCard_1.MemberIdCard.create([
                {
                    memberId: item.memberId,
                    cardNumber,
                    type: item.type,
                    status: "ACTIVE",
                    acbStatus: false,
                },
            ], { session });
            const idCard = idCardArr[0];
            await AutoPoolNode_1.AutoPoolNode.create([
                {
                    idCardId: idCard.id,
                    parentNodeId: autoPoolParentNodeId || undefined,
                    side: autoPoolSide || undefined,
                    globalPosition,
                    depthLevel: Math.floor(Math.log2(globalPosition)),
                },
            ], { session });
            let mySystemNode = null;
            if (item.type !== "REBIRTH") {
                mySystemNode = await placeInMySystem(idCard, item.memberId, item.type, item.sponsorIdCardId, item.sponsorSide, bulkMode, firstMySystemNodeId, childrenMap, nodeCardMap, session);
                if (mySystemNode && !firstMySystemNodeId) {
                    firstMySystemNodeId = mySystemNode.id;
                }
            }
            // Check completions
            await commissionService.checkAutoPoolLevelCompletion(globalPosition, { session });
            if (mySystemNode) {
                await commissionService.checkMySystemLevelCompletion(mySystemNode.id, { session });
            }
            // 1. Evaluate ACB for direct tree sponsor
            if (mySystemNode && mySystemNode.sponsorIdCardId) {
                const treeSponsor = await MemberIdCard_1.MemberIdCard.findById(mySystemNode.sponsorIdCardId).session(session).exec();
                if (treeSponsor && !treeSponsor.acbStatus) {
                    if (await acbService.checkAcbStatus(treeSponsor.id, { session })) {
                        await acbService.unlockAcb(treeSponsor.id, { session });
                        await acbService.unlockLockedEarnings(treeSponsor.id, { session });
                    }
                }
            }
            // 2. Evaluate ACB for purchasing member's MAIN card
            const mainCard = await MemberIdCard_1.MemberIdCard.findOne({ memberId: item.memberId, type: "MAIN" }).session(session).exec();
            if (mainCard && !mainCard.acbStatus) {
                if (await acbService.checkAcbStatus(mainCard.id, { session })) {
                    await acbService.unlockAcb(mainCard.id, { session });
                    await acbService.unlockLockedEarnings(mainCard.id, { session });
                }
            }
            // 3. Evaluate ACB for external batch sponsor if distinct
            if (item.sponsorIdCardId && (!mySystemNode || item.sponsorIdCardId.toString() !== mySystemNode.sponsorIdCardId?.toString())) {
                const sponsorCard = await MemberIdCard_1.MemberIdCard.findById(item.sponsorIdCardId).session(session).exec();
                if (sponsorCard && !sponsorCard.acbStatus) {
                    if (await acbService.checkAcbStatus(sponsorCard.id, { session })) {
                        await acbService.unlockAcb(sponsorCard.id, { session });
                        await acbService.unlockLockedEarnings(sponsorCard.id, { session });
                    }
                }
            }
            // Check rebirths
            const rebirths = await rebirthService.checkAndProcessRebirths(globalPosition, { session });
            if (rebirths.length > 0) {
                queue.unshift(...rebirths);
            }
            newCards.push(idCard);
        }
        await session.commitTransaction();
        return newCards;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
async function findSpillSlot(sponsorNodeId, preferredSide, session) {
    let currentId = sponsorNodeId;
    while (true) {
        const child = await MySystemNode_1.MySystemNode.findOne({ parentNodeId: currentId, side: preferredSide })
            .session(session)
            .exec();
        if (!child)
            return { parentNodeId: currentId, side: preferredSide };
        currentId = child.id;
    }
}
function nextSlot(childrenMap, rootId) {
    const q = [rootId];
    while (q.length > 0) {
        const cur = q.shift();
        const kids = childrenMap[cur] || [];
        if (!kids.some(k => k.side === "LEFT"))
            return { parentNodeId: cur, side: "LEFT" };
        if (!kids.some(k => k.side === "RIGHT"))
            return { parentNodeId: cur, side: "RIGHT" };
        for (const k of kids)
            q.push(k.id);
    }
    throw new Error("No available position found in MY SYSTEM tree");
}
async function placeInMySystem(idCard, memberId, type, sponsorIdCardId, sponsorSide, bulkMode, bulkRootNodeId, childrenMap, nodeCardMap, session) {
    if (idCard.type === "REBIRTH")
        return null;
    if (type === "MAIN") {
        if (sponsorIdCardId && sponsorSide) {
            const sponsorNode = await MySystemNode_1.MySystemNode.findOne({ idCardId: sponsorIdCardId }).session(session).exec();
            if (sponsorNode) {
                const slot = await findSpillSlot(sponsorNode.id, sponsorSide, session);
                const nodeArr = await MySystemNode_1.MySystemNode.create([
                    {
                        idCardId: idCard.id,
                        parentNodeId: slot.parentNodeId,
                        side: slot.side,
                        placementType: "SPONSOR",
                        sponsorIdCardId
                    },
                ], { session });
                const node = nodeArr[0];
                if (!childrenMap[slot.parentNodeId])
                    childrenMap[slot.parentNodeId] = [];
                childrenMap[slot.parentNodeId].push({ id: node.id, side: slot.side });
                nodeCardMap[node.id] = idCard.id;
                return node;
            }
        }
        const nodeArr = await MySystemNode_1.MySystemNode.create([
            {
                idCardId: idCard.id,
                parentNodeId: undefined,
                side: undefined,
                placementType: "ROOT",
                sponsorIdCardId: undefined
            },
        ], { session });
        const node = nodeArr[0];
        nodeCardMap[node.id] = idCard.id;
        return node;
    }
    // SUB ID
    let rootNodeId = bulkRootNodeId;
    if (!rootNodeId) {
        const mainCard = await MemberIdCard_1.MemberIdCard.findOne({ memberId, type: "MAIN" }).session(session).exec();
        if (!mainCard)
            throw new Error("MAIN ID not found for SUB placement");
        let mn = null;
        for (const nid of Object.keys(nodeCardMap)) {
            if (nodeCardMap[nid] === mainCard.id) {
                mn = nid;
                break;
            }
        }
        if (!mn) {
            const dbn = await MySystemNode_1.MySystemNode.findOne({ idCardId: mainCard.id }).session(session).exec();
            if (!dbn)
                throw new Error("MAIN ID MY SYSTEM node not found.");
            mn = dbn.id;
        }
        rootNodeId = mn;
    }
    const position = nextSlot(childrenMap, rootNodeId);
    const parentCardId = nodeCardMap[position.parentNodeId] || null;
    const nodeArr = await MySystemNode_1.MySystemNode.create([
        {
            idCardId: idCard.id,
            parentNodeId: position.parentNodeId,
            side: position.side,
            placementType: "AUTO",
            sponsorIdCardId: parentCardId || undefined
        },
    ], { session });
    const node = nodeArr[0];
    // Update pure-JS tree state instantly
    if (!childrenMap[position.parentNodeId])
        childrenMap[position.parentNodeId] = [];
    childrenMap[position.parentNodeId].push({ id: node.id, side: position.side });
    nodeCardMap[node.id] = idCard.id;
    return node;
}
