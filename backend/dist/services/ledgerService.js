"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEntry = createEntry;
const LedgerEntry_1 = require("../models/LedgerEntry");
async function createEntry(data, options = {}) {
    const newEntryArr = await LedgerEntry_1.LedgerEntry.create([
        {
            walletId: data.walletId,
            systemWallet: data.systemWallet,
            type: data.type,
            amountPaise: data.amountPaise,
            balanceBeforePaise: data.balanceBeforePaise,
            balanceAfterPaise: data.balanceAfterPaise,
            source: data.source,
            referenceId: data.referenceId || undefined,
            description: data.description || undefined,
            direction: data.direction,
            notes: data.notes,
        },
    ], { session: options.session });
    return newEntryArr[0];
}
