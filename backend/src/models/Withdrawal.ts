import mongoose, { Schema, Document } from "mongoose";

export interface IWithdrawal extends Document {
  memberId: mongoose.Types.ObjectId;
  idCardId: mongoose.Types.ObjectId;
  method: string; // BANK, VOUCHER_CONVERSION
  grossPaise: number;
  recovered194RPaise: number;
  tdsPaise: number;
  adminChargePaise: number;
  netPaise: number;
  idempotencyKey?: string;
  status: string; // REQUESTED, APPROVED, COMPLETED, REJECTED
  requestedAt: Date;
  completedAt?: Date;
  paymentDetails?: string;
  rejectionReason?: string;
}

const WithdrawalSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard", required: true },
    method: { type: String, required: true }, // BANK, VOUCHER_CONVERSION
    grossPaise: { type: Number, required: true },
    recovered194RPaise: { type: Number, default: 0 },
    tdsPaise: { type: Number, required: true },
    adminChargePaise: { type: Number, required: true },
    netPaise: { type: Number, required: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    status: { type: String, default: "REQUESTED" }, // REQUESTED, APPROVED, COMPLETED, REJECTED
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    paymentDetails: { type: String },
    rejectionReason: { type: String },
  }
);

WithdrawalSchema.index({ memberId: 1 });
WithdrawalSchema.index({ idCardId: 1 });

export const Withdrawal = mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema);
