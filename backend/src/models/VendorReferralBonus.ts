import mongoose, { Schema, Document } from "mongoose";

export interface IVendorReferralBonus extends Document {
  memberId: mongoose.Types.ObjectId;
  referredVendorId: mongoose.Types.ObjectId;
  bonusPaise: number;
  status: string; // PENDING, PIN_GATE_INACTIVE, SETTLED
  createdAt: Date;
}

const VendorReferralBonusSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    referredVendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    bonusPaise: { type: Number, required: true },
    status: { type: String, default: "PENDING" }, // PENDING, PIN_GATE_INACTIVE, SETTLED
    createdAt: { type: Date, default: Date.now },
  }
);

VendorReferralBonusSchema.index({ memberId: 1 });
VendorReferralBonusSchema.index({ referredVendorId: 1 });

export const VendorReferralBonus = mongoose.model<IVendorReferralBonus>("VendorReferralBonus", VendorReferralBonusSchema);
