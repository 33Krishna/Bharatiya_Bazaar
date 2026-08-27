"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAlreadyPaid = hasAlreadyPaid;
exports.recordPayment = recordPayment;
const PayOnceLedger_1 = require("../models/PayOnceLedger");
async function hasAlreadyPaid(idCardId, level, options = {}) {
    const record = await PayOnceLedger_1.PayOnceLedger.findOne({ idCardId, level }).session(options.session || null).exec();
    return !!record;
}
async function recordPayment(idCardId, level, paidVia, options = {}) {
    const newRecordArr = await PayOnceLedger_1.PayOnceLedger.create([
        {
            idCardId,
            level,
            paidVia,
        },
    ], { session: options.session });
    return newRecordArr[0];
}
