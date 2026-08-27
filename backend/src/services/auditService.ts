import { AuditLog } from "../models/AuditLog";

export interface LogActionParams {
  action: string;
  actorType: string; // ADMIN, SYSTEM, MEMBER
  actorId?: any; // ObjectId or string
  entityType?: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
}

/**
 * Logs an action to the AuditLog collection.
 */
export async function logAction(params: LogActionParams): Promise<any> {
  const { action, actorType, actorId, entityType, entityId, metadata, ipAddress } = params;
  return await AuditLog.create({
    action,
    actorType,
    actorId,
    entityType,
    entityId,
    metadata,
    ipAddress,
  });
}export async function getAuditLogs(filter: any = {}, limit = 50): Promise<any[]> {
  return await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
}
