import mongoose, { Schema, Document } from "mongoose";

export interface IPayOnceLedger extends Document {
  idCardId: mongoose.Types.ObjectId;
  level: number;
  paidVia: string;
  paidAt: Date;
}

const PayOnceLedgerSchema: Schema = new Schema(
  {
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard", required: true },
    level: { type: Number, required: true },
    paidVia: { type: String, required: true },
    paidAt: { type: Date, default: Date.now },
  }
);

// Enforce unique combination of idCardId and level
PayOnceLedgerSchema.index({ idCardId: 1, level: 1 }, { unique: true });

export const PayOnceLedger = mongoose.model<IPayOnceLedger>("PayOnceLedger", PayOnceLedgerSchema);
