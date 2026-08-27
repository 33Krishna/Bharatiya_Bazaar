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
exports.credit = credit;
exports.debit = debit;
exports.getWalletBalance = getWalletBalance;
exports.getLedgerHistory = getLedgerHistory;
const Wallet_1 = require("../models/Wallet");
const LedgerEntry_1 = require("../models/LedgerEntry");
const ledgerService = __importStar(require("./ledgerService"));
async function credit(memberId, amountPaise, source, referenceId = null, description = null, options = {}) {
    if (amountPaise <= 0)
        return null;
    // Atomic findOneAndUpdate with $inc handles concurrent updates cleanly
    const updatedWallet = await Wallet_1.Wallet.findOneAndUpdate({ memberId }, { $inc: { balancePaise: amountPaise } }, { new: true, upsert: true, session: options.session });
    const balanceAfter = updatedWallet.balancePaise;
    const balanceBefore = balanceAfter - amountPaise;
    const ledger = await ledgerService.createEntry({
        walletId: updatedWallet.id,
        type: "CREDIT",
        amountPaise,
        balanceBeforePaise: balanceBefore,
        balanceAfterPaise: balanceAfter,
        source,
        referenceId,
        description,
    }, { session: options.session });
    return { wallet: updatedWallet, ledger };
}
async function debit(memberId, amountPaise, source, referenceId = null, description = null, options = {}) {
    if (amountPaise <= 0)
        return null;
    // Optimistic debit: decrement balance only if it is >= amountPaise
    const updatedWallet = await Wallet_1.Wallet.findOneAndUpdate({ memberId, balancePaise: { $gte: amountPaise } }, { $inc: { balancePaise: -amountPaise } }, { new: true, session: options.session });
    if (!updatedWallet) {
        throw new Error(`Insufficient funds for member ${memberId}.`);
    }
    const balanceAfter = updatedWallet.balancePaise;
    const balanceBefore = balanceAfter + amountPaise;
    const ledger = await ledgerService.createEntry({
        walletId: updatedWallet.id,
        type: "DEBIT",
        amountPaise,
        balanceBeforePaise: balanceBefore,
        balanceAfterPaise: balanceAfter,
        source,
        referenceId,
        description,
    }, { session: options.session });
    return { wallet: updatedWallet, ledger };
}
async function getWalletBalance(memberId) {
    const wallet = await Wallet_1.Wallet.findOne({ memberId });
    if (!wallet) {
        return { balancePaise: 0 };
    }
    return wallet;
}
async function getLedgerHistory(memberId, limit = 50, offset = 0) {
    const wallet = await Wallet_1.Wallet.findOne({ memberId });
    if (!wallet) {
        return [];
    }
    return await LedgerEntry_1.LedgerEntry.find({ walletId: wallet.id })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec();
}
