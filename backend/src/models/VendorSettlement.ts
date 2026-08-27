import mongoose, { Schema, Document } from "mongoose";

export interface IVendorSettlement extends Document {
  vendorId: mongoose.Types.ObjectId;
  settlementRunId?: mongoose.Types.ObjectId;
  grossSalesPaise: number;
  marginPaise: number;
  postMarginPaise: number;
  adminChargePaise: number;
  volumeDiscountPaise: number;
  earlyFeePaise: number;
  payoutBeforeTdsPaise: number;
  tdsPaise: number;
  netPayablePaise: number;
  payoutMethod: string; // BANK, WALLET
  status: string; // PENDING, COMPLETED, PAYOUT_DUE
  periodStart: Date;
  periodEnd: Date;
  settledAt?: Date;
  createdAt: Date;
}

const VendorSettlementSchema: Schema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    settlementRunId: { type: Schema.Types.ObjectId, ref: "SettlementRun" },
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
  },
  {
    timestamps: true,
  }
);

VendorSettlementSchema.index({ vendorId: 1 });
VendorSettlementSchema.index({ settlementRunId: 1 });

export const VendorSettlement = mongoose.model<IVendorSettlement>("VendorSettlement", VendorSettlementSchema);
