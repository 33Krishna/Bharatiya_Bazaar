import mongoose, { Schema, Document } from "mongoose";

export interface ISettlementRun extends Document {
  runDate: Date;
  runType: string; // REGULAR, EARLY
  periodStart?: Date;
  periodEnd?: Date;
  vendorCount: number;
  grossPaise: number;
  netPaise: number;
  status: string; // RUNNING, COMPLETED, FAILED
  totalEntries: number;
  totalPaise: number;
  startedAt: Date;
  completedAt?: Date;
}

const SettlementRunSchema: Schema = new Schema(
  {
    runDate: { type: Date, required: true, unique: true },
    runType: { type: String, default: "REGULAR" }, // REGULAR, EARLY
    periodStart: { type: Date },
    periodEnd: { type: Date },
    vendorCount: { type: Number, default: 0 },
    grossPaise: { type: Number, default: 0 },
    netPaise: { type: Number, default: 0 },
    status: { type: String, required: true }, // RUNNING, COMPLETED, FAILED
    totalEntries: { type: Number, default: 0 },
    totalPaise: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  }
);

export const SettlementRun = mongoose.model<ISettlementRun>("SettlementRun", SettlementRunSchema);
