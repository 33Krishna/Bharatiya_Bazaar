import mongoose, { Schema, Document } from "mongoose";

export interface IPlatformSetting extends Document {
  key: string;
  value: string;
  description?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingSchema: Schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    description: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  }
);

export const PlatformSetting = mongoose.model<IPlatformSetting>("PlatformSetting", PlatformSettingSchema);
