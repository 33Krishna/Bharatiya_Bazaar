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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndProcessRebirths = checkAndProcessRebirths;
const AutoPoolNode_1 = require("../models/AutoPoolNode");
const Voucher_1 = require("../models/Voucher");
const adminService = __importStar(require("./adminService"));
async function checkAndProcessRebirths(newlyPlacedGlobalPosition, options = {}) {
    const rebirthsToQueue = [];
    // Rebirth triggers at AutoPool Levels 4, 5, 6, 7
    for (let L = 4; L <= 7; L++) {
        const numerator = newlyPlacedGlobalPosition + 1 - Math.pow(2, L);
        const denominator = Math.pow(2, L);
        if (numerator % denominator === 0) {
            const ancestorPos = numerator / denominator;
            if (ancestorPos >= 1) {
                // Ancestor completed Level L
                const ancestorNode = await AutoPoolNode_1.AutoPoolNode.findOne({ globalPosition: ancestorPos })
                    .populate("idCardId")
                    .session(options.session || null)
                    .exec();
                if (ancestorNode && ancestorNode.idCardId) {
                    const cardOwnerId = ancestorNode.idCardId.memberId;
                    rebirthsToQueue.push({
                        memberId: cardOwnerId,
                        ancestorPos: ancestorPos,
                        depthLevel: ancestorNode.depthLevel,
                        completedLevel: L,
                        type: "REBIRTH",
                        sponsorIdCardId: null,
                        sponsorSide: null
                    });
                    // Generate Voucher for Levels 5, 6, 7
                    if (L >= 5 && L <= 7) {
                        const faceValuePaise = await adminService.getSetting("VOUCHER_FACE_VALUE_PAISE", 20000, "integer", options);
                        const validityDays = await adminService.getSetting("VOUCHER_VALIDITY_DAYS", 365, "integer", options);
                        await Voucher_1.Voucher.create([
                            {
                                memberId: cardOwnerId,
                                idCardId: ancestorNode.idCardId._id,
                                sourceType: `AUTOPOOL_LEVEL_${L}`,
                                faceValuePaise,
                                expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
                            },
                        ], { session: options.session });
                    }
                }
            }
        }
    }
    // Priority Ordering:
    // Primary: Depth (deepest first, i.e., highest depthLevel)
    // Secondary: Global Position (highest/newest first, i.e., highest ancestorPos)
    rebirthsToQueue.sort((a, b) => {
        if (a.depthLevel !== b.depthLevel) {
            return b.depthLevel - a.depthLevel;
        }
        return b.ancestorPos - a.ancestorPos;
    });
    return rebirthsToQueue;
}
