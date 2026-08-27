import mongoose, { Schema, Document } from "mongoose";

export interface IAdminUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  role: string; // SUPER_ADMIN, ADMIN, SUPPORT
  status: string; // ACTIVE, INACTIVE
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "SUPPORT" }, // SUPER_ADMIN, ADMIN, SUPPORT
    status: { type: String, default: "ACTIVE" },
  },
  {
    timestamps: true,
  }
);

export const AdminUser = mongoose.model<IAdminUser>("AdminUser", AdminUserSchema);
