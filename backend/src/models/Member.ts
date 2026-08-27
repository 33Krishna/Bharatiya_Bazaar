import mongoose, { Schema, Document } from "mongoose";

export interface IMember extends Document {
  memberCode?: string;
  name: string;
  mobile: string;
  email?: string;
  passwordHash?: string;
  address?: string;
  pinCode?: string;
  gender?: string;
  dateOfBirth?: Date;
  panNumber?: string;
  panVerified: boolean;
  kycTier: string; // NONE, TIER1, TIER2
  kycStatus: string; // PENDING, VERIFIED, REJECTED
  status: string; // ACTIVE, INACTIVE, CLOSED, FROZEN, SYSTEM
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema: Schema = new Schema(
  {
    memberCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String },
    passwordHash: { type: String },
    address: { type: String },
    pinCode: { type: String },
    gender: { type: String },
    dateOfBirth: { type: Date },
    panNumber: { type: String },
    panVerified: { type: Boolean, default: false },
    kycTier: { type: String, default: "NONE" },
    kycStatus: { type: String, default: "PENDING" },
    status: { type: String, default: "ACTIVE" },
  },
  {
    timestamps: true,
  }
);

export const Member = mongoose.model<IMember>("Member", MemberSchema);
