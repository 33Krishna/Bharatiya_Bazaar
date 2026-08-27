import mongoose, { Schema, Document } from "mongoose";

export interface ITdsLedger extends Document {
  memberId?: mongoose.Types.ObjectId; // Optional, for member TDS (194H, 194R)
  vendorId?: mongoose.Types.ObjectId; // Optional, for vendor TDS (194C)
  section: string; // 194H, 194R, 194C
  amountPaise: number;
  status: string; // HELD, PENDING, DEPOSITED, RECOVERED, SETTLED
  referenceId?: string;
  financialYear?: string; // e.g. "2026-2027" (for statutory tracking)
  createdAt: Date;
}

const TdsLedgerSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    section: { type: String, required: true }, // 194H, 194R, 194C
    amountPaise: { type: Number, required: true },
    status: { type: String, default: "HELD" }, // HELD, PENDING, DEPOSITED, RECOVERED, SETTLED
    referenceId: { type: String },
    financialYear: { type: String },
    createdAt: { type: Date, default: Date.now },
  }
);

TdsLedgerSchema.index({ memberId: 1 });
TdsLedgerSchema.index({ vendorId: 1 });
TdsLedgerSchema.index({ section: 1, financialYear: 1 });

export const TdsLedger = mongoose.model<ITdsLedger>("TdsLedger", TdsLedgerSchema);
