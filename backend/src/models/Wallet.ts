import mongoose, { Schema, Document } from "mongoose";

export interface IWallet extends Document {
  memberId: mongoose.Types.ObjectId;
  balancePaise: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true, unique: true },
    balancePaise: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Wallet = mongoose.model<IWallet>("Wallet", WalletSchema);
