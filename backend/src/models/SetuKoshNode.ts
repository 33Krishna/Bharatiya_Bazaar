import mongoose, { Schema, Document } from "mongoose";

export interface ISetuKoshNode extends Document {
  memberId: mongoose.Types.ObjectId;
  parentNodeId?: mongoose.Types.ObjectId;
  side?: string; // LEFT or RIGHT
  globalPosition: number;
  depthLevel: number;
  createdAt: Date;
}

const SetuKoshNodeSchema: Schema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "SetuKoshNode" },
    side: { type: String },
    globalPosition: { type: Number, required: true, unique: true },
    depthLevel: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }
);

SetuKoshNodeSchema.index({ memberId: 1 });

export const SetuKoshNode = mongoose.model<ISetuKoshNode>("SetuKoshNode", SetuKoshNodeSchema);
