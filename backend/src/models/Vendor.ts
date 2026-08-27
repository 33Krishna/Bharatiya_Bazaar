import mongoose, { Schema, Document } from "mongoose";

export interface IVendor extends Document {
  memberId: mongoose.Types.ObjectId;
  businessName: string;
  category: string; // e.g. FOOD, CLOTHING, GENERAL
  gstin?: string;
  address?: string;
  pinCode?: string;
  marginRatePct: number;
  status: string; // PROVISIONAL, ACTIVE, VERIFIED, FROZEN, CLOSED
  securityDepositPaise: number;
  walletBalancePaise: number;
  isDepositFrozen: boolean;
  lastSaleAt?: Date;
  payoutMethod: string; // BANK, WALLET
  joinedAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true, unique: true },
    businessName: { type: String, required: true },
    category: { type: String, default: "GENERAL" },
    gstin: { type: String },
    address: { type: String },
    pinCode: { type: String },
    marginRatePct: { type: Number, required: true },
    status: { type: String, default: "PROVISIONAL" }, // PROVISIONAL, ACTIVE, VERIFIED, FROZEN, CLOSED
    securityDepositPaise: { type: Number, default: 500000 },
    walletBalancePaise: { type: Number, default: 0 },
    isDepositFrozen: { type: Boolean, default: false },
    lastSaleAt: { type: Date },
    payoutMethod: { type: String, default: "BANK" }, // BANK, WALLET
    joinedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

VendorSchema.index({ status: 1 });

export const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);
