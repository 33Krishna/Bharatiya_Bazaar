import mongoose, { Schema, Document } from "mongoose";

export interface IMemberIdCard extends Document {
  memberId: mongoose.Types.ObjectId;
  cardNumber: string;
  type: string; // MAIN, SUB, REBIRTH
  status: string; // ACTIVE, INACTIVE
  acbStatus: boolean;
  acbUnlockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MemberIdCardSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    cardNumber: { type: String, required: true, unique: true },
    type: { type: String, required: true }, // MAIN, SUB, REBIRTH
    status: { type: String, default: "ACTIVE" }, // ACTIVE, INACTIVE
    acbStatus: { type: Boolean, default: false },
    acbUnlockedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

MemberIdCardSchema.index({ memberId: 1 });

export const MemberIdCard = mongoose.model<IMemberIdCard>("MemberIdCard", MemberIdCardSchema);
