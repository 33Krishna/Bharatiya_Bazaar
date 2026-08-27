import mongoose, { Schema, Document } from "mongoose";

export interface IAutoPoolNode extends Document {
  idCardId: mongoose.Types.ObjectId;
  parentNodeId?: mongoose.Types.ObjectId;
  side?: string; // LEFT or RIGHT
  globalPosition: number;
  depthLevel: number;
  createdAt: Date;
}

const AutoPoolNodeSchema: Schema = new Schema(
  {
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard", required: true, unique: true },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "AutoPoolNode" },
    side: { type: String },
    globalPosition: { type: Number, required: true, unique: true },
    depthLevel: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }
);

export const AutoPoolNode = mongoose.model<IAutoPoolNode>("AutoPoolNode", AutoPoolNodeSchema);
