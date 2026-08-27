import mongoose, { Schema, Document } from "mongoose";

export interface IMySystemNode extends Document {
  idCardId: mongoose.Types.ObjectId;
  parentNodeId?: mongoose.Types.ObjectId;
  side?: string; // LEFT or RIGHT
  placementType: string; // ROOT, SPONSOR, AUTO
  sponsorIdCardId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MySystemNodeSchema: Schema = new Schema(
  {
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard", required: true, unique: true },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "MySystemNode" },
    side: { type: String }, // LEFT or RIGHT
    placementType: { type: String, required: true }, // ROOT, SPONSOR, AUTO
    sponsorIdCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard" },
  },
  {
    timestamps: true,
  }
);

MySystemNodeSchema.index({ parentNodeId: 1 });
MySystemNodeSchema.index({ sponsorIdCardId: 1 });

export const MySystemNode = mongoose.model<IMySystemNode>("MySystemNode", MySystemNodeSchema);
