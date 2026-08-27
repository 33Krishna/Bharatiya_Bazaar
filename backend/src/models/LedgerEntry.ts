import mongoose, { Schema, Document } from "mongoose";

export interface ILedgerEntry extends Document {
  walletId?: mongoose.Types.ObjectId; // Optional to support system/company wallet logs
  systemWallet?: string; // e.g. "COMPANY_WALLET"
  type: string; // e.g. MY_SYSTEM_COMMISSION, SETU_KOSH_COMMISSION, WITHDRAWAL_REQUEST, etc.
  amountPaise: number;
  source: string; // e.g. COMMISSION, WITHDRAWAL, VENDOR_SETTLEMENT, etc.
  direction?: string; // CREDIT, DEBIT (optional, for compatibility)
  notes?: string; // optional notes
  referenceId?: string; // ID of the triggering commission, withdrawal, settlement
  description?: string;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  createdAt: Date;
}

const LedgerEntrySchema: Schema = new Schema(
  {
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    systemWallet: { type: String },
    type: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    source: { type: String, required: true },
    direction: { type: String },
    notes: { type: String },
    referenceId: { type: String },
    description: { type: String },
    balanceBeforePaise: { type: Number, default: 0 },
    balanceAfterPaise: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }
);

LedgerEntrySchema.index({ walletId: 1 });
LedgerEntrySchema.index({ referenceId: 1 });

export const LedgerEntry = mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);
