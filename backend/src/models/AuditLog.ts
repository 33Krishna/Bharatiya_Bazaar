import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorType: string; // ADMIN, SYSTEM, MEMBER
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: mongoose.Schema.Types.Mixed;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId },
    actorType: { type: String, required: true }, // ADMIN, SYSTEM, MEMBER
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now },
  }
);

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ actorId: 1 });
AuditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
