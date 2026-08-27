import mongoose, { Schema, Document } from "mongoose";

export interface ISystemCounter extends Document {
  id: string; // The counter identifier, e.g., "AUTOPOOL_GLOBAL" or "SETUKOSH_GLOBAL"
  currentValue: number;
  updatedAt: Date;
}

const SystemCounterSchema: Schema = new Schema(
  {
    _id: { type: String, required: true }, // Map 'id' as the custom primary key
    currentValue: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

export const SystemCounter = mongoose.model<ISystemCounter>("SystemCounter", SystemCounterSchema);
