import mongoose, { Schema, Document } from "mongoose";

export interface IVendorSale extends Document {
  vendorId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  idCardId?: mongoose.Types.ObjectId;
  amountPaise: number;
  marginPaise: number;
  idempotencyKey?: string;
  status: string; // COMPLETED, SETTLED, REFUNDED, CANCELLED
  createdAt: Date;
  completedAt?: Date; // Added for compatibility with some calculations
}

const VendorSaleSchema: Schema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    idCardId: { type: Schema.Types.ObjectId, ref: "MemberIdCard" },
    amountPaise: { type: Number, required: true },
    marginPaise: { type: Number, default: 0 },
    idempotencyKey: { type: String, unique: true, sparse: true },
    status: { type: String, default: "COMPLETED" }, // COMPLETED, SETTLED, REFUNDED, CANCELLED
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: Date.now },
  }
);

VendorSaleSchema.index({ vendorId: 1 });
VendorSaleSchema.index({ memberId: 1 });
VendorSaleSchema.index({ status: 1, createdAt: 1 });
VendorSaleSchema.index({ status: 1, completedAt: 1 });

export const VendorSale = mongoose.model<IVendorSale>("VendorSale", VendorSaleSchema);
