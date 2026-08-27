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
exports.VendorSettlement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VendorSettlementSchema = new mongoose_1.Schema({
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Vendor", required: true },
    settlementRunId: { type: mongoose_1.Schema.Types.ObjectId, ref: "SettlementRun" },
    grossSalesPaise: { type: Number, required: true },
    marginPaise: { type: Number, required: true },
    postMarginPaise: { type: Number, required: true },
    adminChargePaise: { type: Number, required: true },
    volumeDiscountPaise: { type: Number, default: 0 },
    earlyFeePaise: { type: Number, default: 0 },
    payoutBeforeTdsPaise: { type: Number, default: 0 },
    tdsPaise: { type: Number, default: 0 },
    netPayablePaise: { type: Number, default: 0 },
    payoutMethod: { type: String, default: "BANK" }, // BANK, WALLET
    status: { type: String, default: "PENDING" }, // PENDING, COMPLETED, PAYOUT_DUE
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    settledAt: { type: Date },
}, {
    timestamps: true,
});
VendorSettlementSchema.index({ vendorId: 1 });
VendorSettlementSchema.index({ settlementRunId: 1 });
exports.VendorSettlement = mongoose_1.default.model("VendorSettlement", VendorSettlementSchema);
