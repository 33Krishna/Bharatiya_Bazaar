import mongoose, { Schema, Document } from "mongoose";

export interface ICommissionEntry extends Document {
  idCardId: mongoose.Types.ObjectId;
  stream: string; // MY_SYSTEM, AUTOPOOL, SETU_KOSH, VENDOR_REFERRAL_BONUS
  level: number;
  amountPaise: number;
  status: string; // CONFIRMED, WITHDRAWABLE, LOCKED_ACB, PENDING_7_DAY, PAY_ONCE_BLOCKED, PENDING_SETTLEMENT, PIN_GATE_INACTIVE
  sourceIdCardId?: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  createdAt: Date;
}

const CommissionEntrySchema: Schema = new Schema(
  {
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard", required: true },
    stream: { type: String, required: true },
    level: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, required: true },
    sourceIdCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard" },
    confirmedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  }
);

CommissionEntrySchema.index({ idCardId: 1 });
CommissionEntrySchema.index({ idCardId: 1, status: 1 });

export const CommissionEntry = mongoose.model<ICommissionEntry>("CommissionEntry", CommissionEntrySchema);
