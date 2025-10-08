// src/shared/services/audit.service.ts

import { injectable } from 'inversify';
import { FirebaseService } from './firebase.service';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import { config } from '../config';

export interface AuditLogEntry {
    id?: string;
    userId?: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    duration?: number; // Request duration in milliseconds
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

@injectable()
export class AuditService {
    private collectionName = 'audit_logs';
    private isEnabled: boolean;

    constructor(
        @inject(FirebaseService) private firebaseService: FirebaseService
    ) {
        this.isEnabled = config.AUDIT_ENABLED !== false;
    }

    /**
     * Log an audit event
     */
    async logEvent(entry: AuditLogEntry): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        try {
            const logEntry: AuditLogEntry = {
                ...entry,
                id: entry.id || this.generateId(),
                timestamp: entry.timestamp || new Date()
            };

            // Store in Firestore
            await this.firebaseService.db
                .collection(this.collectionName)
                .doc(logEntry.id!)
                .set(logEntry);

            // Also log to file for backup
            logger.info('AUDIT_LOG', logEntry);
        } catch (error) {
            logger.error('Error writing audit log:', error);
            // Don't throw error for audit failures - we don't want to break the main flow
        }
    }

    /**
     * Log a successful action
     */
    async logSuccess(
        action: string,
        resource: string,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
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
            resourceId: metadata.resourceId,
            duration: metadata.duration,
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Log a failed action
     */
    async logFailure(
        action: string,
        resource: string,
        error: string,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
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
            resourceId: metadata.resourceId,
            duration: metadata.duration,
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Log user authentication events
     */
    async logAuthEvent(
        event: 'login' | 'logout' | 'register' | 'password_reset' | 'password_change' | 'mfa_enabled' | 'mfa_disabled',
        userId: string,
        userEmail: string,
        success: boolean,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
            action: `AUTH_${event.toUpperCase()}`,
            resource: 'authentication',
            userId,
            userEmail,
            userRole: metadata.userRole,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: success ? 'success' : 'failure',
            error: success ? undefined : metadata.error,
            timestamp: new Date(),
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Log data access events
     */
    async logDataAccess(
        action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
        resource: string,
        resourceId: string,
        userId: string,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
            action: `DATA_${action.toUpperCase()}`,
            resource,
            resourceId,
            userId,
            userEmail: metadata.userEmail,
            userRole: metadata.userRole,
            metadata,
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Log permission events
     */
    async logPermissionEvent(
        action: 'granted' | 'denied' | 'revoked',
        resource: string,
        resourceId: string,
        userId: string,
        permission: string,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
            action: `PERMISSION_${action.toUpperCase()}`,
            resource,
            resourceId,
            userId,
            userEmail: metadata.userEmail,
            userRole: metadata.userRole,
            metadata: {
                permission,
                ...metadata
            },
            ipAddress: context.ip || 'unknown',
            userAgent: context.userAgent || 'unknown',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Log system events
     */
    async logSystemEvent(
        action: string,
        metadata: Record<string, any> = {},
        context: any = {}
    ): Promise<void> {
        const entry: AuditLogEntry = {
            action: `SYSTEM_${action.toUpperCase()}`,
            resource: 'system',
            metadata,
            ipAddress: context.ip || 'localhost',
            userAgent: context.userAgent || 'system',
            status: 'success',
            timestamp: new Date(),
            requestId: context.requestId
        };

        await this.logEvent(entry);
    }

    /**
     * Get audit logs with filtering
     */
    async getAuditLogs(filter: AuditFilter = {}): Promise<{
        logs: AuditLogEntry[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            let query = this.firebaseService.db.collection(this.collectionName) as any;

            // Apply filters
            if (filter.userId) {
                query = query.where('userId', '==', filter.userId);
            }

            if (filter.action) {
                query = query.where('action', '==', filter.action);
            }

            if (filter.resource) {
                query = query.where('resource', '==', filter.resource);
            }

            if (filter.resourceId) {
                query = query.where('resourceId', '==', filter.resourceId);
            }

            if (filter.status) {
                query = query.where('status', '==', filter.status);
            }

            if (filter.ipAddress) {
                query = query.where('ipAddress', '==', filter.ipAddress);
            }

            if (filter.dateFrom) {
                query = query.where('timestamp', '>=', filter.dateFrom);
            }

            if (filter.dateTo) {
                query = query.where('timestamp', '<=', filter.dateTo);
            }

            // Order by timestamp descending
            query = query.orderBy('timestamp', 'desc');

            // Apply pagination
            const limit = filter.limit || 100;
            const offset = filter.offset || 0;

            if (offset > 0) {
                const snapshot = await query.limit(offset).get();
                if (!snapshot.empty) {
                    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
                    query = query.startAfter(lastDoc);
                }
            }

            const snapshot = await query.limit(limit + 1).get();
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AuditLogEntry));

            const hasMore = logs.length > limit;
            if (hasMore) {
                logs.pop();
            }

            // Get total count (approximate for large datasets)
            const totalSnapshot = await this.firebaseService.db.collection(this.collectionName).get();
            const total = totalSnapshot.size;

            return {
                logs,
                total,
                hasMore
            };
        } catch (error) {
            logger.error('Error fetching audit logs:', error);
            throw new AppError('Failed to fetch audit logs', 500);
        }
    }

    /**
     * Get audit statistics
     */
    async getAuditStats(filter: AuditFilter = {}): Promise<AuditStats> {
        try {
            const { logs } = await this.getAuditLogs({ ...filter, limit: 10000 });

            const stats: AuditStats = {
                totalLogs: logs.length,
                successCount: 0,
                failureCount: 0,
                uniqueUsers: new Set(),
                uniqueIPs: new Set(),
                actions: {},
                resources: {}
            };

            logs.forEach(log => {
                // Count success/failure
                if (log.status === 'success') {
                    stats.successCount++;
                } else {
                    stats.failureCount++;
                }

                // Count unique users and IPs
                if (log.userId) {
                    stats.uniqueUsers.add(log.userId);
                }
                if (log.ipAddress && log.ipAddress !== 'unknown') {
                    stats.uniqueIPs.add(log.ipAddress);
                }

                // Count actions
                stats.actions[log.action] = (stats.actions[log.action] || 0) + 1;

                // Count resources
                stats.resources[log.resource] = (stats.resources[log.resource] || 0) + 1;
            });

            return {
                ...stats,
                uniqueUsers: stats.uniqueUsers.size,
                uniqueIPs: stats.uniqueIPs.size
            };
        } catch (error) {
            logger.error('Error fetching audit stats:', error);
            throw new AppError('Failed to fetch audit statistics', 500);
        }
    }

    /**
     * Get audit logs for a specific user
     */
    async getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
        return this.getAuditLogs({ userId, limit }).then(result => result.logs);
    }

    /**
     * Get audit logs for a specific resource
     */
    async getResourceAuditLogs(resource: string, resourceId: string, limit: number = 100): Promise<AuditLogEntry[]> {
        return this.getAuditLogs({ resource, resourceId, limit }).then(result => result.logs);
    }

    /**
     * Export audit logs
     */
    async exportAuditLogs(filter: AuditFilter = {}, format: 'json' | 'csv' = 'json'): Promise<string> {
        try {
            const { logs } = await this.getAuditLogs({ ...filter, limit: 50000 });

            if (format === 'csv') {
                return this.convertToCSV(logs);
            } else {
                return JSON.stringify(logs, null, 2);
            }
        } catch (error) {
            logger.error('Error exporting audit logs:', error);
            throw new AppError('Failed to export audit logs', 500);
        }
    }

    /**
     * Clean up old audit logs
     */
    async cleanupAuditLogs(retentionDays: number = 90): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const snapshot = await this.firebaseService.db
                .collection(this.collectionName)
                .where('timestamp', '<', cutoffDate)
                .get();

            const batch = this.firebaseService.db.batch();
            let deletedCount = 0;

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });

            await batch.commit();

            logger.info(`Cleaned up ${deletedCount} audit logs older than ${retentionDays} days`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up audit logs:', error);
            throw new AppError('Failed to cleanup audit logs', 500);
        }
    }

    /**
     * Create audit log retention policy
     */
    async setRetentionPolicy(policy: {
        enabled: boolean;
        retentionDays: number;
        excludeActions?: string[];
        excludeResources?: string[];
    }): Promise<void> {
        try {
            await this.firebaseService.db
                .collection('system_config')
                .doc('audit_retention')
                .set(policy);

            logger.info('Audit retention policy updated', policy);
        } catch (error) {
            logger.error('Error setting retention policy:', error);
            throw new AppError('Failed to set retention policy', 500);
        }
    }

    /**
     * Get retention policy
     */
    async getRetentionPolicy(): Promise<{
        enabled: boolean;
        retentionDays: number;
        excludeActions: string[];
        excludeResources: string[];
    }> {
        try {
            const doc = await this.firebaseService.db
                .collection('system_config')
                .doc('audit_retention')
                .get();

            if (doc.exists) {
                return doc.data() as any;
            }

            // Default policy
            return {
                enabled: true,
                retentionDays: 90,
                excludeActions: [],
                excludeResources: []
            };
        } catch (error) {
            logger.error('Error fetching retention policy:', error);
            throw new AppError('Failed to fetch retention policy', 500);
        }
    }

    /**
     * Convert audit logs to CSV format
     */
    private convertToCSV(logs: AuditLogEntry[]): string {
        const headers = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User ID', 'User Email', 'IP Address', 'Status', 'Error'];
        const rows = logs.map(log => [
            log.timestamp.toISOString(),
            log.action,
            log.resource,
            log.resourceId || '',
            log.userId || '',
            log.userEmail || '',
            log.ipAddress,
            log.status,
            log.error || ''
        ]);

        return [headers, ...rows].map(row =>
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    /**
     * Generate unique ID for audit log
     */
    private generateId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}