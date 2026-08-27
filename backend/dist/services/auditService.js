"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAction = logAction;
exports.getAuditLogs = getAuditLogs;
const AuditLog_1 = require("../models/AuditLog");
/**
 * Logs an action to the AuditLog collection.
 */
async function logAction(params) {
    const { action, actorType, actorId, entityType, entityId, metadata, ipAddress } = params;
    return await AuditLog_1.AuditLog.create({
        action,
        actorType,
        actorId,
        entityType,
        entityId,
        metadata,
        ipAddress,
    });
}
async function getAuditLogs(filter = {}, limit = 50) {
    return await AuditLog_1.AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
}
