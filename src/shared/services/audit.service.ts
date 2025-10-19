// src/shared/services/audit.service.ts
import { FirebaseService } from './firebase.service';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import { config } from '../config';
import admin from 'firebase-admin';
import { SecurityLog } from '../types';
import { firebaseService } from '../container';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuditLogEntry {
    id?: string;
    userId?: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    duration?: number;
    status: 'success' | 'failure';
    error?: string;
    requestId?: string;
}

export interface AuditFilter {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: 'success' | 'failure';
    ipAddress?: string;
    limit?: number;
    offset?: number;
}

export interface AuditStats {
    totalLogs: number;
    successCount: number;
    failureCount: number;
    uniqueUsers: number;
    uniqueIPs: number;
    actions: Record<string, number>;
    resources: Record<string, number>;
}

interface LogContext {
    ip?: string;
    userAgent?: string;
    userId?: string;
    userEmail?: string;
    userRole?: string;
    requestId?: string;
}

interface RetentionPolicy {
    enabled: boolean;
    retentionDays: number;
    excludeActions: string[];
    excludeResources: string[];
}

/* ------------------------------------------------------------------ */
/* Service                                                            */
/* ------------------------------------------------------------------ */

export class AuditService {
    private readonly collectionName = 'audit_logs';
    private readonly isEnabled: boolean;

    constructor(
    ) {
        this.isEnabled = config.logging.enableAuditLog !== false;
    }
    private get firebaseService(): FirebaseService { return firebaseService}

    /* ------------------------ Core logging ---------------------------- */

    async logEvent(entry: AuditLogEntry): Promise<void> {
        if (!this.isEnabled) return;

        try {
            const log: AuditLogEntry = {
                ...entry,
                id: entry.id || this.generateId(),
                timestamp: entry.timestamp || new Date(),
            };

            await this.firebaseService.db
                .collection(this.collectionName)
                .doc(log.id!)
                .set(log);

            logger.info('AUDIT_LOG', log);
        } catch (err) {
            logger.error('Error writing audit log:', err);
            // swallow – audit must never break the business flow
        }
    }

    /* ------------------------ Convenience helpers --------------------- */

    async logSuccess(
        action: string,
        resource: string,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action,
            resource,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'success',
            timestamp: new Date(),
            userId: context.userId,
            userEmail: context.userEmail,
            userRole: context.userRole,
            resourceId: metadata.resourceId as string | undefined,
            duration: metadata.duration as number | undefined,
            requestId: context.requestId,
        });
    }

    async logFailure(
        action: string,
        resource: string,
        error: string,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action,
            resource,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'failure',
            error,
            timestamp: new Date(),
            userId: context.userId,
            userEmail: context.userEmail,
            userRole: context.userRole,
            resourceId: metadata.resourceId as string | undefined,
            duration: metadata.duration as number | undefined,
            requestId: context.requestId,
        });
    }

    async logAuthEvent(
        event: 'login' | 'logout' | 'register' | 'password_reset' | 'password_change' | 'mfa_enabled' | 'mfa_disabled',
        userId: string,
        userEmail: string,
        success: boolean,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action: `AUTH_${event.toUpperCase()}`,
            resource: 'authentication',
            userId,
            userEmail,
            userRole: metadata.userRole as string | undefined,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: success ? 'success' : 'failure',
            error: success ? undefined : (metadata.error as string | undefined),
            timestamp: new Date(),
            requestId: context.requestId,
        });
    }

    async logDataAccess(
        action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
        resource: string,
        resourceId: string,
        userId: string,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action: `DATA_${action.toUpperCase()}`,
            resource,
            resourceId,
            userId,
            userEmail: metadata.userEmail as string | undefined,
            userRole: metadata.userRole as string | undefined,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId,
        });
    }

    async logPermissionEvent(
        action: 'granted' | 'denied' | 'revoked',
        resource: string,
        resourceId: string,
        userId: string,
        permission: string,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action: `PERMISSION_${action.toUpperCase()}`,
            resource,
            resourceId,
            userId,
            userEmail: metadata.userEmail as string | undefined,
            userRole: metadata.userRole as string | undefined,
            metadata: { permission, ...metadata },
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId,
        });
    }

    async logSystemEvent(
        action: string,
        metadata: Record<string, unknown> = {},
        context: LogContext = {},
    ): Promise<void> {
        return this.logEvent({
            action: `SYSTEM_${action.toUpperCase()}`,
            resource: 'system',
            metadata,
            ipAddress: context.ip || 'localhost',
            userAgent: context.userAgent || 'system',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId,
        });
    }


    async logSecurityEvent(securityLog: SecurityLog & { success?: boolean }): Promise<void> {
        return this.logEvent({
            action: `SECURITY_${securityLog.event.toUpperCase()}`,
            resource: 'security',
            userId: securityLog.userId,
            userEmail: securityLog.metadata?.userEmail as string | undefined,
            userRole: securityLog.metadata?.userRole as string | undefined,
            metadata: securityLog.metadata,
            ipAddress: securityLog.ip,
            userAgent: securityLog.userAgent,
            status: securityLog.success === false ? 'failure' : 'success',
            timestamp: securityLog.timestamp,
        });
    }

    // inside AuditService
    async logActivity(entry: {
        userId: string;
        action: string;
        metadata?: any;
        resource?: string;            // optional override
        timestamp?: Date;             // optional override
    }): Promise<void> {
        return this.logDataAccess(
            entry.action as any,
            entry.resource || 'activity', // default resource
            entry.userId,
            entry.metadata,
            {
                userId: entry.userId,
                ...(entry.timestamp && { timestamp: entry.timestamp }), // pass if supplied
            }
        );
    }

    /* ------------------------ Querying -------------------------------- */

    async getAuditLogs(filter: AuditFilter = {}): Promise<{
        logs: AuditLogEntry[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            let base: admin.firestore.CollectionReference = this.firebaseService.db.collection(this.collectionName);

            let query: admin.firestore.Query = base;

            if (filter.userId) query = query.where('userId', '==', filter.userId);
            if (filter.action) query = query.where('action', '==', filter.action);
            if (filter.resource) query = query.where('resource', '==', filter.resource);
            if (filter.resourceId) query = query.where('resourceId', '==', filter.resourceId);
            if (filter.status) query = query.where('status', '==', filter.status);
            if (filter.ipAddress) query = query.where('ipAddress', '==', filter.ipAddress);
            if (filter.dateFrom) query = query.where('timestamp', '>=', filter.dateFrom);
            if (filter.dateTo) query = query.where('timestamp', '<=', filter.dateTo);

            query = query.orderBy('timestamp', 'desc');

            const limit = Math.min(filter.limit || 100, 1000);
            query = query.limit(limit + 1);

            if (filter.offset) {
                const snap = await base.limit(filter.offset).get();
                if (!snap.empty) {
                    query = query.startAfter(snap.docs[snap.docs.length - 1]).limit(limit + 1);
                }
            }

            const snap = await query.get();
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
            const hasMore = logs.length > limit;
            if (hasMore) logs.pop();

            // cheap total – for large collections use metadata counter doc
            const totalSnap = await this.firebaseService.db.collection(this.collectionName).get();
            return { logs, total: totalSnap.size, hasMore };
        } catch (err) {
            logger.error('Error fetching audit logs:', err);
            this.throw('Failed to fetch audit logs', 500);
        }
    }

    async getAuditStats(filter: AuditFilter = {}): Promise<AuditStats> {
        const { logs } = await this.getAuditLogs({ ...filter, limit: 10_000 });

        const internal: MutableStats = {
            totalLogs: logs.length,
            successCount: 0,
            failureCount: 0,
            uniqueUsers: new Set<string>(),
            uniqueIPs: new Set<string>(),
            actions: {},
            resources: {},
        };

        for (const log of logs) {
            if (log.status === 'success') internal.successCount++;
            else internal.failureCount++;

            if (log.userId) internal.uniqueUsers.add(log.userId);
            if (log.ipAddress && log.ipAddress !== 'unknown') internal.uniqueIPs.add(log.ipAddress);

            internal.actions[log.action] = (internal.actions[log.action] || 0) + 1;
            internal.resources[log.resource] = (internal.resources[log.resource] || 0) + 1;
        }

        return {
            totalLogs: internal.totalLogs,
            successCount: internal.successCount,
            failureCount: internal.failureCount,
            uniqueUsers: internal.uniqueUsers.size,
            uniqueIPs: internal.uniqueIPs.size,
            actions: internal.actions,
            resources: internal.resources,
        };
    }

    async getUserAuditLogs(userId: string, limit = 100): Promise<AuditLogEntry[]> {
        return this.getAuditLogs({ userId, limit }).then(r => r.logs);
    }

    async getResourceAuditLogs(resource: string, resourceId: string, limit = 100): Promise<AuditLogEntry[]> {
        return this.getAuditLogs({ resource, resourceId, limit }).then(r => r.logs);
    }

    /* ------------------------ Export / Cleanup ------------------------ */

    async exportAuditLogs(filter: AuditFilter = {}, format: 'json' | 'csv' = 'json'): Promise<string> {
        const { logs } = await this.getAuditLogs({ ...filter, limit: 50_000 });
        return format === 'csv' ? this.convertToCSV(logs) : JSON.stringify(logs, null, 2);
    }

    async cleanupAuditLogs(retentionDays = 90): Promise<number> {
        const policy = await this.getRetentionPolicy();
        if (!policy.enabled) return 0;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        let q = this.firebaseService.db
            .collection(this.collectionName)
            .where('timestamp', '<', cutoff) as FirebaseFirestore.Query;

        if (policy.excludeActions.length)
            q = q.where('action', 'not-in', policy.excludeActions);
        if (policy.excludeResources.length)
            q = q.where('resource', 'not-in', policy.excludeResources);

        const snap = await q.get();

        const batch = this.firebaseService.db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        logger.info(`Cleaned up ${snap.size} audit logs older than ${retentionDays} days`);
        return snap.size;
    }

    /* ------------------------ Retention policy ------------------------ */

    async setRetentionPolicy(policy: RetentionPolicy): Promise<void> {
        try {
            await this.firebaseService.db
                .collection('system_config')
                .doc('audit_retention')
                .set(policy);
            logger.info('Audit retention policy updated', policy);
        } catch (err) {
            logger.error('Error setting retention policy:', err);
            this.throw('Failed to set retention policy', 500);
        }
    }

    async getRetentionPolicy(): Promise<RetentionPolicy> {
        try {
            const snap = await this.firebaseService.db
                .collection('system_config')
                .doc('audit_retention')
                .get();
            return snap.exists
                ? (snap.data() as RetentionPolicy)
                : { enabled: true, retentionDays: 90, excludeActions: [], excludeResources: [] };
        } catch (err) {
            logger.error('Error fetching retention policy:', err);
            this.throw('Failed to fetch retention policy', 500);
        }
    }

    /* ------------------------ Private --------------------------------- */

    private convertToCSV(logs: AuditLogEntry[]): string {
        const headers = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User ID', 'User Email', 'IP Address', 'Status', 'Error'];
        const rows = logs.map(l => [
            l.timestamp.toISOString(),
            l.action,
            l.resource,
            l.resourceId ?? '',
            l.userId ?? '',
            l.userEmail ?? '',
            l.ipAddress,
            l.status,
            l.error ?? '',
        ]);
        return [headers, ...rows]
            .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }

    private generateId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    private throw(message: string, code: number): never {
        throw new AppError(message, code);
    }
}

/* ------------------------------------------------------------------ */
/* Internal helper types                                              */
/* ------------------------------------------------------------------ */

interface MutableStats extends Omit<AuditStats, 'uniqueUsers' | 'uniqueIPs'> {
    uniqueUsers: Set<string>;
    uniqueIPs: Set<string>;
}