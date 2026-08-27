import mongoose, { Schema, Document } from "mongoose";

export interface IVoucher extends Document {
  memberId: mongoose.Types.ObjectId;
  idCardId?: mongoose.Types.ObjectId;
  sourceType: string; // e.g. AUTOPOOL_LEVEL_5, etc.
  faceValuePaise: number;
  status: string; // ACTIVE, REDEEMED, EXPIRED
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date;
}

const VoucherSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard" },
    sourceType: { type: String, required: true },
    faceValuePaise: { type: Number, required: true },
    status: { type: String, default: "ACTIVE" }, // ACTIVE, REDEEMED, EXPIRED
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    redeemedAt: { type: Date },
  }
);

VoucherSchema.index({ memberId: 1 });
VoucherSchema.index({ status: 1 });

export const Voucher = mongoose.model<IVoucher>("Voucher", VoucherSchema);
