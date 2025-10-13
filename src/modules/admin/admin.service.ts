import { injectable, inject } from 'tsyringe';
import { AdminRepository } from './admin.repository';
import {
    AdminUser,
    SystemStats,
    UserStats,
    SystemConfig,
    AdminAuditLog,
    UserFilter,
    BackupRecord,
} from './admin.types';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { Timestamp } from 'firebase-admin/firestore';

@injectable()
export class AdminService {
    constructor(
        @inject('AdminRepository') private readonly adminRepo: AdminRepository,
        @inject('CacheService') private readonly cache: CacheService,
        @inject('EmailService') private readonly email: EmailService
    ) { }

    /* =========================================================
       User management
    ========================================================= */

    async getAllUsers(filter: UserFilter, adminId: string) {
        await this.adminRepo.logAdminAction(adminId, 'USER_LIST_VIEWED', 'user', undefined, { filter });

        const cacheKey = `admin:users:${JSON.stringify(filter)}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const { users, total } = await this.adminRepo.getAllUsers(filter);

        const result = {
            users, // <-- plain AdminUser[]  (controller can map if needed)
            total,
            page: filter.page || 1,
            limit: filter.limit || 20,
        };

        await this.cache.set(cacheKey, result, { ttl: 300 }); // 5 min
        return result;
    }

    async getUserById(userId: string, adminId: string): Promise<AdminUser> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        await this.adminRepo.logAdminAction(adminId, 'USER_VIEWED', 'user', userId);
        return user;
    }

    async updateUser(userId: string, updates: Partial<AdminUser>, adminId: string): Promise<AdminUser> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        // role change logging
        if (updates.role && updates.role !== user.role) {
            await this.adminRepo.logAdminAction(adminId, 'USER_ROLE_CHANGED', 'user', userId, {
                oldRole: user.role,
                newRole: updates.role,
            });
        }

        await this.adminRepo.updateUser(userId, updates);
        await this.cache.delete(`user:${userId}`); // invalidate single user
        await this.clearUsersListCache(); // invalidate list(s)

        return (await this.adminRepo.getUserById(userId))!; // fresh copy
    }

    async banUser(userId: string, payload: { reason?: string; durationDays?: number }, adminId: string): Promise<void> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        const lockedUntil = payload.durationDays
            ? new Date(Date.now() + payload.durationDays * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 yr default

        await this.adminRepo.updateUser(userId, {
            security: { ...user.security, lockedUntil: lockedUntil as any, failedLoginAttempts: 0 },
        });

        await this.adminRepo.logAdminAction(adminId, 'USER_BANNED', 'user', userId, {
            reason: payload.reason,
            durationDays: payload.durationDays,
            lockedUntil: lockedUntil.toISOString(),
        });

        await this.email.sendAccountBannedEmail(
            user.email,
            user.displayName,
            payload.reason,
            payload.durationDays ? `${payload.durationDays} days` : undefined
        );

        await this.cache.delete(`user:${userId}`);
        await this.clearUsersListCache();
    }

    async unbanUser(userId: string, adminId: string): Promise<void> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        await this.adminRepo.updateUser(userId, {
            security: { ...user.security, lockedUntil: null as any, failedLoginAttempts: 0 },
        });

        await this.adminRepo.logAdminAction(adminId, 'USER_UNBANNED', 'user', userId);
        await this.email.sendAccountUnbannedEmail(user.email, user.displayName);

        await this.cache.delete(`user:${userId}`);
        await this.clearUsersListCache();
    }

    async deleteUser(userId: string, adminId: string, softDelete = true): Promise<void> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        await this.adminRepo.deleteUser(userId, softDelete);

        await this.adminRepo.logAdminAction(adminId, 'USER_DELETED', 'user', userId, { softDelete, userEmail: user.email });

        if (softDelete) {
            await this.email.sendAccountDeletedEmail(user.email, user.displayName);
        }

        await this.cache.delete(`user:${userId}`);
        await this.clearUsersListCache();
    }

    async restoreUser(userId: string, adminId: string): Promise<void> {
        const user = await this.adminRepo.getUserById(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);
        if (!user.isDeleted) throw new AppError('User is not deleted', 400, undefined, ErrorCode.VALIDATION_ERROR);

        await this.adminRepo.updateUser(userId, { isDeleted: false, deletedAt: null as any });

        await this.adminRepo.logAdminAction(adminId, 'USER_RESTORED', 'user', userId);
        await this.cache.delete(`user:${userId}`);
        await this.clearUsersListCache();
    }

    async bulkAction(
        data: { userIds: string[]; action: string; reason?: string; newRole?: string; newSubscriptionPlan?: string },
        adminId: string
    ) {
        const results = { success: 0, failed: 0, errors: [] as string[] };

        for (const uid of data.userIds) {
            try {
                switch (data.action) {
                    case 'ban':
                        await this.banUser(uid, { reason: data.reason }, adminId);
                        break;
                    case 'unban':
                        await this.unbanUser(uid, adminId);
                        break;
                    case 'delete':
                        await this.deleteUser(uid, adminId, true);
                        break;
                    case 'restore':
                        await this.restoreUser(uid, adminId);
                        break;
                    case 'change-role':
                        if (!data.newRole) throw new AppError('New role required', 400, undefined, ErrorCode.VALIDATION_ERROR);
                        await this.updateUser(uid, { role: data.newRole as any }, adminId);
                        break;
                    case 'change-subscription':
                        if (!data.newSubscriptionPlan) throw new AppError('New plan required', 400, undefined, ErrorCode.VALIDATION_ERROR);
                        await this.updateUser(uid, { subscription: { plan: data.newSubscriptionPlan as any } } as any, adminId);
                        break;
                    default:
                        throw new AppError('Unknown bulk action', 400, undefined, ErrorCode.VALIDATION_ERROR);
                }
                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push(`User ${uid}: ${err.message}`);
                logger.error(`Bulk action failed for user ${uid}`, err);
            }
        }

        await this.adminRepo.logAdminAction(adminId, 'BULK_USER_ACTION', 'user', undefined, {
            action: data.action,
            userCount: data.userIds.length,
            ...results,
        });

        return results;
    }

    /* =========================================================
       Statistics
    ========================================================= */

    async getUserStats(adminId: string): Promise<UserStats> {
        await this.adminRepo.logAdminAction(adminId, 'USER_STATS_VIEWED', 'system');
        const cacheKey = 'admin:user-stats';
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const stats = await this.adminRepo.getUserStats();
        await this.cache.set(cacheKey, stats, { ttl: 900 }); // 15 min
        return stats;
    }

    async getSystemStats(adminId: string): Promise<SystemStats> {
        await this.adminRepo.logAdminAction(adminId, 'SYSTEM_STATS_VIEWED', 'system');
        const cacheKey = 'admin:system-stats';
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const stats = await this.adminRepo.getSystemStats();
        await this.cache.set(cacheKey, stats, { ttl: 600 }); // 10 min
        return stats;
    }

    /* =========================================================
       Health / Metrics
    ========================================================= */

    async getSystemHealth() {
        // no audit log – called too frequently
        return this.adminRepo.getSystemHealth();
    }

    async getPerformanceMetrics(filters: any) {
        // no audit log – called too frequently
        return this.adminRepo.getPerformanceMetrics(filters);
    }

    /* =========================================================
       Audit & Config
    ========================================================= */

    async getAdminLogs(adminId: string, limit = 100): Promise<AdminAuditLog[]> {
        return this.adminRepo.getAdminLogs(adminId, limit);
    }

    async getSystemConfig(adminId: string): Promise<SystemConfig> {
        await this.adminRepo.logAdminAction(adminId, 'SYSTEM_CONFIG_VIEWED', 'system');
        const cacheKey = 'admin:system-config';
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const config = await this.adminRepo.getSystemConfig();
        await this.cache.set(cacheKey, config, { ttl: 300 }); // 5 min
        return config;
    }

    async updateSystemConfig(adminId: string, updates: Partial<SystemConfig>): Promise<SystemConfig> {
        await this.adminRepo.updateSystemConfig(updates);
        await this.adminRepo.logAdminAction(adminId, 'SYSTEM_CONFIG_UPDATED', 'system', undefined, updates);
        await this.cache.delete('admin:system-config');

        return this.adminRepo.getSystemConfig(); // fresh
    }

    /* =========================================================
       Backups
    ========================================================= */

    async initiateBackup(type: string, adminId: string): Promise<BackupRecord> {
        const record = await this.adminRepo.insertBackupRecord({
            type: type as any,
            size: 0,
            status: 'processing',
            createdBy: adminId,
            createdAt: Timestamp.now(),
        });

        await this.adminRepo.logAdminAction(adminId, 'BACKUP_CREATED', 'data', record.id, { type });
        return record;
    }

    async listBackups(): Promise<BackupRecord[]> {
        return this.adminRepo.listBackups();
    }

    async initiateRestore(backupId: string, adminId: string): Promise<BackupRecord> {
        const backup = await this.adminRepo.getBackupById(backupId);
        if (!backup) throw new AppError('Backup not found', 404, undefined, ErrorCode.NOT_FOUND);

        // mark as restore-in-progress (or queue a job)
        await this.adminRepo.logAdminAction(adminId, 'BACKUP_RESTORED', 'data', backupId);
        return backup;
    }

    /* =========================================================
       Maintenance
    ========================================================= */

    async setMaintenanceMode(enable: boolean, adminId: string): Promise<SystemConfig> {
        const config = await this.updateSystemConfig(adminId, { maintenanceMode: enable });
        await this.cache.delete('admin:system-config');
        return config;
    }

    /* =========================================================
       Helpers
    ========================================================= */

    private async clearUsersListCache(): Promise<void> {
        await this.cache.deleteByPattern('admin:users:*');
    }
}