// src/modules/admin/admin.repository.ts

import { injectable } from 'inversify';
import { FirebaseRepository } from '../../shared/repository/firebase.repository';
import { AdminUser, SystemStats, UserActivityLog, AdminAuditLog, UserFilter, UserStats, SystemConfig } from './admin.types';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../../shared/utils/logger';

@injectable()
export class AdminRepository extends FirebaseRepository {
    constructor() {
        super();
    }

    async getAllUsers(filter: UserFilter = {}): Promise<{ users: AdminUser[]; total: number }> {
        try {
            let query = this.db.collection('users') as any;

            // Apply filters
            if (filter.search) {
                // Note: Firestore doesn't support full-text search
                // This is a basic implementation - consider using Algolia or similar for production
                query = query.where('email', '>=', filter.search).where('email', '<=', filter.search + '\uf8ff');
            }

            if (filter.role) {
                query = query.where('role', '==', filter.role);
            }

            if (filter.subscriptionPlan) {
                query = query.where('subscription.plan', '==', filter.subscriptionPlan);
            }

            if (filter.status) {
                switch (filter.status) {
                    case 'active':
                        query = query.where('isDeleted', '==', false);
                        break;
                    case 'deleted':
                        query = query.where('isDeleted', '==', true);
                        break;
                    case 'banned':
                        query = query.where('security.lockedUntil', '>', new Date());
                        break;
                }
            }

            if (filter.dateFrom) {
                query = query.where('createdAt', '>=', Timestamp.fromDate(filter.dateFrom));
            }

            if (filter.dateTo) {
                query = query.where('createdAt', '<=', Timestamp.fromDate(filter.dateTo));
            }

            // Apply sorting
            const sortBy = filter.sortBy || 'createdAt';
            const sortOrder = filter.sortOrder || 'desc';
            query = query.orderBy(sortBy, sortOrder);

            // Apply pagination
            const page = filter.page || 1;
            const limit = filter.limit || 20;
            const offset = (page - 1) * limit;

            if (offset > 0) {
                const snapshot = await query.limit(offset).get();
                if (!snapshot.empty) {
                    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
                    query = query.startAfter(lastDoc);
                }
            }

            const snapshot = await query.limit(limit + 1).get();
            const users = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as AdminUser));

            const hasMore = users.length > limit;
            if (hasMore) {
                users.pop();
            }

            // Get total count for pagination
            const totalSnapshot = await this.db.collection('users').get();
            const total = totalSnapshot.size;

            return { users, total };
        } catch (error) {
            logger.error('Error fetching users:', error);
            throw new Error('Failed to fetch users');
        }
    }

    async getUserById(userId: string): Promise<AdminUser | null> {
        try {
            const doc = await this.db.collection('users').doc(userId).get();
            if (!doc.exists) {
                return null;
            }
            return {
                uid: doc.id,
                ...doc.data()
            } as AdminUser;
        } catch (error) {
            logger.error(`Error fetching user ${userId}:`, error);
            throw new Error('Failed to fetch user');
        }
    }

    async updateUser(userId: string, updates: Partial<AdminUser>): Promise<void> {
        try {
            updates.updatedAt = Timestamp.now();
            await this.db.collection('users').doc(userId).update(updates);
        } catch (error) {
            logger.error(`Error updating user ${userId}:`, error);
            throw new Error('Failed to update user');
        }
    }

    async deleteUser(userId: string, softDelete: boolean = true): Promise<void> {
        try {
            if (softDelete) {
                await this.db.collection('users').doc(userId).update({
                    isDeleted: true,
                    deletedAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
            } else {
                await this.db.collection('users').doc(userId).delete();
            }
        } catch (error) {
            logger.error(`Error deleting user ${userId}:`, error);
            throw new Error('Failed to delete user');
        }
    }

    async getSystemStats(): Promise<SystemStats> {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Get user statistics
            const usersSnapshot = await this.db.collection('users').get();
            const totalUsers = usersSnapshot.size;

            const activeUsersSnapshot = await this.db
                .collection('users')
                .where('lastLogin', '>=', Timestamp.fromDate(monthAgo))
                .get();
            const activeUsers = activeUsersSnapshot.size;

            const newUsersTodaySnapshot = await this.db
                .collection('users')
                .where('createdAt', '>=', Timestamp.fromDate(today))
                .get();
            const newUsersToday = newUsersTodaySnapshot.size;

            const newUsersThisWeekSnapshot = await this.db
                .collection('users')
                .where('createdAt', '>=', Timestamp.fromDate(weekAgo))
                .get();
            const newUsersThisWeek = newUsersThisWeekSnapshot.size;

            const newUsersThisMonthSnapshot = await this.db
                .collection('users')
                .where('createdAt', '>=', Timestamp.fromDate(monthAgo))
                .get();
            const newUsersThisMonth = newUsersThisMonthSnapshot.size;

            // Get planner statistics
            const plannersSnapshot = await this.db.collection('planners').get();
            const totalPlanners = plannersSnapshot.size;

            const activePlannersSnapshot = await this.db
                .collection('planners')
                .where('updatedAt', '>=', Timestamp.fromDate(weekAgo))
                .get();
            const activePlanners = activePlannersSnapshot.size;

            // Get activity statistics
            const activitiesSnapshot = await this.db.collection('activities').get();
            const totalActivities = activitiesSnapshot.size;

            const completedActivitiesSnapshot = await this.db
                .collection('activities')
                .where('status', '==', 'completed')
                .get();
            const completedActivities = completedActivitiesSnapshot.size;

            // Get subscription statistics
            const subscriptionStats = {
                free: 0,
                premium: 0,
                enterprise: 0,
                trial: 0
            };

            usersSnapshot.docs.forEach(doc => {
                const user = doc.data();
                const plan = user.subscription?.plan || 'free';
                subscriptionStats[plan] = (subscriptionStats[plan] || 0) + 1;
            });

            return {
                totalUsers,
                activeUsers,
                newUsersToday,
                newUsersThisWeek,
                newUsersThisMonth,
                totalPlanners,
                activePlanners,
                totalActivities,
                completedActivities,
                storageUsage: {
                    totalSize: 0, // These would be calculated from file storage
                    userFiles: 0,
                    backupSize: 0
                },
                apiUsage: {
                    totalRequests: 0, // These would be fetched from monitoring service
                    requestsToday: 0,
                    requestsThisWeek: 0,
                    requestsThisMonth: 0,
                    averageResponseTime: 0
                },
                subscriptionStats,
                systemHealth: {
                    database: 'healthy',
                    redis: 'healthy',
                    externalServices: {}
                },
                generatedAt: Timestamp.now()
            };
        } catch (error) {
            logger.error('Error fetching system stats:', error);
            throw new Error('Failed to fetch system statistics');
        }
    }

    async getUserStats(): Promise<UserStats> {
        try {
            const usersSnapshot = await this.db.collection('users').get();
            const total = usersSnapshot.size;

            let active = 0;
            let inactive = 0;
            let banned = 0;
            let deleted = 0;

            const byPlan: Record<string, number> = {};
            const byRole: Record<string, number> = {};

            usersSnapshot.docs.forEach(doc => {
                const user = doc.data();

                if (user.isDeleted) {
                    deleted++;
                } else if (user.security?.lockedUntil && user.security.lockedUntil.toDate() > new Date()) {
                    banned++;
                } else if (user.lastLogin && user.lastLogin.toDate() > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
                    active++;
                } else {
                    inactive++;
                }

                const plan = user.subscription?.plan || 'free';
                byPlan[plan] = (byPlan[plan] || 0) + 1;

                const role = user.role || 'user';
                byRole[role] = (byRole[role] || 0) + 1;
            });

            return {
                total,
                active,
                inactive,
                banned,
                deleted,
                byPlan: byPlan as any,
                byRole: byRole as any
            };
        } catch (error) {
            logger.error('Error fetching user stats:', error);
            throw new Error('Failed to fetch user statistics');
        }
    }

    async logAdminAction(adminId: string, action: string, targetType: string, targetId?: string, details: Record<string, any> = {}): Promise<void> {
        try {
            const logEntry: AdminAuditLog = {
                id: this.generateId(),
                adminId,
                action: action as any,
                targetType: targetType as any,
                targetId,
                details,
                timestamp: Timestamp.now()
            };

            await this.db.collection('admin_audit_logs').doc(logEntry.id).set(logEntry);
        } catch (error) {
            logger.error('Error logging admin action:', error);
            // Don't throw error for logging failures
        }
    }

    async getAdminLogs(adminId?: string, limit: number = 100): Promise<AdminAuditLog[]> {
        try {
            let query = this.db.collection('admin_audit_logs').orderBy('timestamp', 'desc');

            if (adminId) {
                query = query.where('adminId', '==', adminId);
            }

            const snapshot = await query.limit(limit).get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AdminAuditLog));
        } catch (error) {
            logger.error('Error fetching admin logs:', error);
            throw new Error('Failed to fetch admin logs');
        }
    }

    async getSystemConfig(): Promise<SystemConfig> {
        try {
            const doc = await this.db.collection('system_config').doc('main').get();
            if (!doc.exists) {
                return this.getDefaultSystemConfig();
            }
            return doc.data() as SystemConfig;
        } catch (error) {
            logger.error('Error fetching system config:', error);
            return this.getDefaultSystemConfig();
        }
    }

    async updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
        try {
            await this.db.collection('system_config').doc('main').set(config, { merge: true });
        } catch (error) {
            logger.error('Error updating system config:', error);
            throw new Error('Failed to update system configuration');
        }
    }

    private getDefaultSystemConfig(): SystemConfig {
        return {
            maintenanceMode: false,
            allowRegistration: true,
            requireEmailVerification: true,
            defaultUserRole: 'user',
            rateLimits: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100
            },
            fileUpload: {
                maxSize: 10 * 1024 * 1024, // 10MB
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
            },
            email: {
                smtpEnabled: false,
                fromAddress: 'noreply@aiplanner.com'
            },
            ai: {
                enabled: true,
                dailyLimit: 100
            }
        };
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}