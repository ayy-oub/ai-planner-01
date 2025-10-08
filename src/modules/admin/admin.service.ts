// src/modules/admin/admin.service.ts

import { injectable, inject } from 'inversify';
import { AdminRepository } from './admin.repository';
import { AdminUser, SystemStats, UserActivityLog, AdminAuditLog, UserFilter, UserStats, SystemConfig } from './admin.types';
import logger from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { UserResponseDto, UpdateUserDto, BanUserDto, BulkActionDto } from './dto/user-management.dto';
import { ConfigUpdateDto } from './dto/system-stats.dto';

@injectable()
export class AdminService {
    constructor(
        @inject(AdminRepository) private adminRepository: AdminRepository,
        @inject(CacheService) private cacheService: CacheService,
        @inject(EmailService) private emailService: EmailService
    ) { }

    async getAllUsers(filter: UserFilter, adminId: string): Promise<{ users: UserResponseDto[]; total: number; page: number; limit: number }> {
        try {
            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_LIST_VIEWED', 'user', undefined, { filter });

            const cacheKey = `admin_users_${JSON.stringify(filter)}`;
            const cached = await this.cacheService.get(cacheKey);

            if (cached) {
                return cached;
            }

            const { users, total } = await this.adminRepository.getAllUsers(filter);
            const userDtos = users.map(user => new UserResponseDto(user));

            const result = {
                users: userDtos,
                total,
                page: filter.page || 1,
                limit: filter.limit || 20
            };

            // Cache for 5 minutes
            await this.cacheService.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            logger.error('Error in getAllUsers service:', error);
            throw new AppError('Failed to fetch users', 500);
        }
    }

    async getUserById(userId: string, adminId: string): Promise<UserResponseDto> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_VIEWED', 'user', userId);

            return new UserResponseDto(user);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in getUserById service for user ${userId}:`, error);
            throw new AppError('Failed to fetch user', 500);
        }
    }

    async updateUser(userId: string, updates: UpdateUserDto, adminId: string): Promise<UserResponseDto> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            // Prepare updates
            const updateData: Partial<AdminUser> = {
                ...updates,
                updatedAt: new Date() as any
            };

            // Handle role change
            if (updates.role && updates.role !== user.role) {
                await this.adminRepository.logAdminAction(adminId, 'USER_ROLE_CHANGED', 'user', userId, {
                    oldRole: user.role,
                    newRole: updates.role
                });
            }

            // Handle email verification
            if (updates.emailVerified !== undefined && updates.emailVerified !== user.emailVerified) {
                if (updates.emailVerified) {
                    // Send verification success email
                    await this.emailService.sendEmail({
                        to: user.email,
                        subject: 'Email Verified - AI Planner',
                        template: 'email-verified',
                        data: { userName: user.displayName }
                    });
                }
            }

            await this.adminRepository.updateUser(userId, updateData);

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Fetch updated user
            const updatedUser = await this.adminRepository.getUserById(userId);
            return new UserResponseDto(updatedUser!);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in updateUser service for user ${userId}:`, error);
            throw new AppError('Failed to update user', 500);
        }
    }

    async banUser(userId: string, banData: BanUserDto, adminId: string): Promise<void> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            const lockedUntil = banData.durationDays
                ? new Date(Date.now() + banData.durationDays * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default

            await this.adminRepository.updateUser(userId, {
                security: {
                    ...user.security,
                    lockedUntil: lockedUntil as any,
                    failedLoginAttempts: 0
                }
            });

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_BANNED', 'user', userId, {
                reason: banData.reason,
                durationDays: banData.durationDays,
                lockedUntil: lockedUntil.toISOString()
            });

            // Send ban notification email
            await this.emailService.sendEmail({
                to: user.email,
                subject: 'Account Suspended - AI Planner',
                template: 'account-banned',
                data: {
                    userName: user.displayName,
                    reason: banData.reason,
                    duration: banData.durationDays ? `${banData.durationDays} days` : 'permanently'
                }
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in banUser service for user ${userId}:`, error);
            throw new AppError('Failed to ban user', 500);
        }
    }

    async unbanUser(userId: string, adminId: string): Promise<void> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            await this.adminRepository.updateUser(userId, {
                security: {
                    ...user.security,
                    lockedUntil: null as any,
                    failedLoginAttempts: 0
                }
            });

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_UNBANNED', 'user', userId);

            // Send unban notification email
            await this.emailService.sendEmail({
                to: user.email,
                subject: 'Account Restored - AI Planner',
                template: 'account-unbanned',
                data: { userName: user.displayName }
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in unbanUser service for user ${userId}:`, error);
            throw new AppError('Failed to unban user', 500);
        }
    }

    async deleteUser(userId: string, adminId: string, softDelete: boolean = true): Promise<void> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            await this.adminRepository.deleteUser(userId, softDelete);

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_DELETED', 'user', userId, {
                softDelete,
                userEmail: user.email
            });

            if (softDelete) {
                // Send account deletion email
                await this.emailService.sendEmail({
                    to: user.email,
                    subject: 'Account Deleted - AI Planner',
                    template: 'account-deleted',
                    data: { userName: user.displayName }
                });
            }

            // Invalidate cache
            await this.invalidateUserCache(userId);

        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in deleteUser service for user ${userId}:`, error);
            throw new AppError('Failed to delete user', 500);
        }
    }

    async bulkAction(actionData: BulkActionDto, adminId: string): Promise<{ success: number; failed: number; errors: string[] }> {
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const userId of actionData.userIds) {
            try {
                switch (actionData.action) {
                    case 'ban':
                        await this.banUser(userId, { reason: actionData.reason }, adminId);
                        break;
                    case 'unban':
                        await this.unbanUser(userId, adminId);
                        break;
                    case 'delete':
                        await this.deleteUser(userId, adminId, true);
                        break;
                    case 'restore':
                        await this.restoreUser(userId, adminId);
                        break;
                    case 'change-role':
                        if (!actionData.newRole) {
                            throw new AppError('New role is required for role change', 400);
                        }
                        await this.updateUser(userId, { role: actionData.newRole }, adminId);
                        break;
                    case 'change-subscription':
                        if (!actionData.newSubscriptionPlan) {
                            throw new AppError('New subscription plan is required for subscription change', 400);
                        }
                        await this.updateUser(userId, { subscriptionPlan: actionData.newSubscriptionPlan }, adminId);
                        break;
                }
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`User ${userId}: ${error.message}`);
                logger.error(`Bulk action failed for user ${userId}:`, error);
            }
        }

        // Log bulk action
        await this.adminRepository.logAdminAction(adminId, 'BULK_USER_ACTION', 'user', undefined, {
            action: actionData.action,
            userCount: actionData.userIds.length,
            success: results.success,
            failed: results.failed
        });

        return results;
    }

    async restoreUser(userId: string, adminId: string): Promise<void> {
        try {
            const user = await this.adminRepository.getUserById(userId);

            if (!user) {
                throw new AppError('User not found', 404);
            }

            if (!user.isDeleted) {
                throw new AppError('User is not deleted', 400);
            }

            await this.adminRepository.updateUser(userId, {
                isDeleted: false,
                deletedAt: null as any
            });

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_RESTORED', 'user', userId);

            // Invalidate cache
            await this.invalidateUserCache(userId);

        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error in restoreUser service for user ${userId}:`, error);
            throw new AppError('Failed to restore user', 500);
        }
    }

    async getSystemStats(adminId: string): Promise<SystemStats> {
        try {
            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'SYSTEM_STATS_VIEWED', 'system');

            const cacheKey = 'admin_system_stats';
            const cached = await this.cacheService.get(cacheKey);

            if (cached) {
                return cached;
            }

            const stats = await this.adminRepository.getSystemStats();

            // Cache for 10 minutes
            await this.cacheService.set(cacheKey, stats, 600);

            return stats;
        } catch (error) {
            logger.error('Error in getSystemStats service:', error);
            throw new AppError('Failed to fetch system statistics', 500);
        }
    }

    async getUserStats(adminId: string): Promise<UserStats> {
        try {
            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'USER_STATS_VIEWED', 'system');

            const cacheKey = 'admin_user_stats';
            const cached = await this.cacheService.get(cacheKey);

            if (cached) {
                return cached;
            }

            const stats = await this.adminRepository.getUserStats();

            // Cache for 15 minutes
            await this.cacheService.set(cacheKey, stats, 900);

            return stats;
        } catch (error) {
            logger.error('Error in getUserStats service:', error);
            throw new AppError('Failed to fetch user statistics', 500);
        }
    }

    async getAdminLogs(adminId: string, limit: number = 100): Promise<AdminAuditLog[]> {
        try {
            return await this.adminRepository.getAdminLogs(adminId, limit);
        } catch (error) {
            logger.error('Error in getAdminLogs service:', error);
            throw new AppError('Failed to fetch admin logs', 500);
        }
    }

    async getSystemConfig(adminId: string): Promise<SystemConfig> {
        try {
            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'SYSTEM_CONFIG_VIEWED', 'system');

            return await this.adminRepository.getSystemConfig();
        } catch (error) {
            logger.error('Error in getSystemConfig service:', error);
            throw new AppError('Failed to fetch system configuration', 500);
        }
    }

    async updateSystemConfig(adminId: string, config: ConfigUpdateDto): Promise<SystemConfig> {
        try {
            await this.adminRepository.updateSystemConfig(config);

            // Log admin action
            await this.adminRepository.logAdminAction(adminId, 'SYSTEM_CONFIG_UPDATED', 'system', undefined, config);

            // Invalidate cache
            await this.cacheService.del('system_config');

            return await this.adminRepository.getSystemConfig();
        } catch (error) {
            logger.error('Error in updateSystemConfig service:', error);
            throw new AppError('Failed to update system configuration', 500);
        }
    }

    private async invalidateUserCache(userId: string): Promise<void> {
        // Invalidate user-specific cache
        await this.cacheService.del(`user_${userId}`);

        // Invalidate user lists cache
        const userListKeys = await this.cacheService.keys('admin_users_*');
        if (userListKeys.length > 0) {
            await this.cacheService.del(userListKeys);
        }
    }
}