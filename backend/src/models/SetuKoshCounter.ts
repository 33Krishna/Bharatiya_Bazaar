import mongoose, { Schema, Document } from "mongoose";

export interface ISetuKoshCounter extends Document {
  memberId: mongoose.Types.ObjectId;
  counterPaise: number;
  idsCreated: number;
  accumulatedMarginPaise: number;
  createdAt: Date;
  updatedAt: Date;
}

const SetuKoshCounterSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true, unique: true },
    counterPaise: { type: Number, default: 0 },
    idsCreated: { type: Number, default: 0 },
    accumulatedMarginPaise: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const SetuKoshCounter = mongoose.model<ISetuKoshCounter>("SetuKoshCounter", SetuKoshCounterSchema);
