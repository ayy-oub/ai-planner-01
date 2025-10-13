import { injectable } from 'tsyringe';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import { Timestamp } from 'firebase-admin/firestore';

import {
    AdminUser,
    UserFilter,
    SystemStats,
    UserStats,
    SystemConfig,
    AdminAuditLog,
    BackupRecord,
} from './admin.types';
import { UserRole } from '../user/user.types';

const firestore = firebaseConnection.getDatabase();

@injectable()
export class AdminRepository {
    private readonly userColl = firestore.collection('users');
    private readonly configDoc = firestore.collection('system_config').doc('main');
    private readonly auditColl = firestore.collection('admin_audit_logs');
    private readonly backupColl = firestore.collection('backups');

    /* ------------------------------------------------------------------ */
    /*  User CRUD                                                         */
    /* ------------------------------------------------------------------ */

    async getAllUsers(filter: UserFilter = {}): Promise<{ users: AdminUser[]; total: number }> {
        try {
            let query: FirebaseFirestore.Query = this.userColl;

            if (filter.search) {
                query = query
                    .where('email', '>=', filter.search)
                    .where('email', '<=', filter.search + '\uf8ff');
            }
            if (filter.role) query = query.where('role', '==', filter.role);
            if (filter.subscriptionPlan) query = query.where('subscription.plan', '==', filter.subscriptionPlan);

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

            if (filter.dateFrom) query = query.where('createdAt', '>=', Timestamp.fromDate(filter.dateFrom));
            if (filter.dateTo) query = query.where('createdAt', '<=', Timestamp.fromDate(filter.dateTo));

            const sortBy = filter.sortBy || 'createdAt';
            const sortOrder = filter.sortOrder || 'desc';
            query = query.orderBy(sortBy, sortOrder);

            const page = filter.page || 1;
            const limit = filter.limit || 20;
            const offset = (page - 1) * limit;

            if (offset > 0) {
                const snap = await query.limit(offset).get();
                if (!snap.empty) query = query.startAfter(snap.docs[snap.docs.length - 1]);
            }

            const snapshot = await query.limit(limit + 1).get();
            const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser));
            const hasMore = users.length > limit;
            if (hasMore) users.pop();

            // total count (cheap firestore v1+)
            const totalSnap = await this.userColl.count().get();
            return { users, total: totalSnap.data().count };
        } catch (err) {
            logger.error('getAllUsers error', err);
            throw new AppError('Failed to fetch users', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getUserById(uid: string): Promise<AdminUser | null> {
        try {
            const snap = await this.userColl.doc(uid).get();
            return snap.exists ? ({ uid: snap.id, ...snap.data() } as AdminUser) : null;
        } catch (err) {
            logger.error('getUserById error', err);
            throw new AppError('Failed to fetch user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateUser(uid: string, updates: Partial<AdminUser>): Promise<void> {
        try {
            updates.updatedAt = Timestamp.now();
            await this.userColl.doc(uid).update(updates);
        } catch (err) {
            logger.error('updateUser error', { uid, updates, err });
            throw new AppError('Failed to update user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async deleteUser(uid: string, soft = true): Promise<void> {
        try {
            if (soft) {
                await this.userColl.doc(uid).update({
                    isDeleted: true,
                    deletedAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            } else {
                await this.userColl.doc(uid).delete();
            }
        } catch (err) {
            logger.error('deleteUser error', { uid, soft, err });
            throw new AppError('Failed to delete user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Statistics                                                        */
    /* ------------------------------------------------------------------ */

    async getSystemStats(): Promise<SystemStats> {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const [
                totalUsersSnap,
                activeMonthSnap,
                newTodaySnap,
                newWeekSnap,
                newMonthSnap,
                plannersSnap,
                activePlannersSnap,
            ] = await Promise.all([
                this.userColl.count().get(),
                this.userColl.where('lastLogin', '>=', Timestamp.fromDate(monthAgo)).count().get(),
                this.userColl.where('createdAt', '>=', Timestamp.fromDate(today)).count().get(),
                this.userColl.where('createdAt', '>=', Timestamp.fromDate(weekAgo)).count().get(),
                this.userColl.where('createdAt', '>=', Timestamp.fromDate(monthAgo)).count().get(),
                firestore.collection('planners').count().get(),
                firestore.collection('planners').where('updatedAt', '>=', Timestamp.fromDate(weekAgo)).count().get(),
            ]);

            const subscriptionAgg: Record<string, number> = { free: 0, premium: 0, enterprise: 0, trial: 0 };
            (await this.userColl.select('subscription.plan').get()).docs
                .forEach(d => {
                    const plan = d.get('subscription.plan') || 'free';
                    subscriptionAgg[plan] = (subscriptionAgg[plan] || 0) + 1;
                });

            return {
                totalUsers: totalUsersSnap.data().count,
                activeUsers: activeMonthSnap.data().count,
                newUsersToday: newTodaySnap.data().count,
                newUsersThisWeek: newWeekSnap.data().count,
                newUsersThisMonth: newMonthSnap.data().count,
                totalPlanners: plannersSnap.data().count,
                activePlanners: activePlannersSnap.data().count,
                subscriptionStats: subscriptionAgg,
                generatedAt: Timestamp.now(),
            } as SystemStats;
        } catch (err) {
            logger.error('getSystemStats error', err);
            throw new AppError('Failed to fetch system statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getUserStats(): Promise<UserStats> {
        try {
            const snap = await this.userColl.select('role', 'subscription.plan', 'isDeleted', 'security.lockedUntil').get();

            let active = 0, inactive = 0, banned = 0, deleted = 0;
            const byPlan: Record<string, number> = {};
            const byRole: Record<string, number> = {};

            snap.docs.forEach(d => {
                const data = d.data();
                const plan = data.subscription?.plan || 'free';
                const role = data.role || 'user';

                byPlan[plan] = (byPlan[plan] || 0) + 1;
                byRole[role] = (byRole[role] || 0) + 1;

                if (data.isDeleted) deleted++;
                else if (data.security?.lockedUntil?.toDate() > new Date()) banned++;
                else active++;
            });
            inactive = snap.size - active - banned - deleted;

            return { total: snap.size, active, inactive, banned, deleted, byPlan, byRole };
        } catch (err) {
            logger.error('getUserStats error', err);
            throw new AppError('Failed to fetch user statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Audit logs                                                        */
    /* ------------------------------------------------------------------ */

    async logAdminAction(adminId: string, action: string, targetType: string, targetId?: string, details: Record<string, any> = {}): Promise<void> {
        try {
            const entry: AdminAuditLog = {
                id: this.auditColl.doc().id,
                adminId,
                action: action as any,
                targetType: targetType as any,
                targetId,
                details,
                timestamp: Timestamp.now(),
            };
            await this.auditColl.doc(entry.id).set(entry);
        } catch (err) {
            logger.error('logAdminAction error', err);
            // swallow – do not break the call chain because of logging
        }
    }

    async getAdminLogs(adminId?: string, limit = 100): Promise<AdminAuditLog[]> {
        try {
            let q = this.auditColl.orderBy('timestamp', 'desc').limit(limit);
            if (adminId) q = q.where('adminId', '==', adminId);
            const snap = await q.get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminAuditLog));
        } catch (err) {
            logger.error('getAdminLogs error', err);
            throw new AppError('Failed to fetch audit logs', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  System configuration                                              */
    /* ------------------------------------------------------------------ */

    async getSystemConfig(): Promise<SystemConfig> {
        try {
            const snap = await this.configDoc.get();
            return (snap.exists ? snap.data() : this.getDefaultConfig()) as SystemConfig;
        } catch (err) {
            logger.error('getSystemConfig error', err);
            return this.getDefaultConfig();
        }
    }

    async updateSystemConfig(updates: Partial<SystemConfig>): Promise<void> {
        try {
            await this.configDoc.set({ ...updates, updatedAt: Timestamp.now() }, { merge: true });
        } catch (err) {
            logger.error('updateSystemConfig error', err);
            throw new AppError('Failed to update system configuration', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    private getDefaultConfig(): SystemConfig {
        return {
            maintenanceMode: false,
            allowRegistration: true,
            requireEmailVerification: true,
            defaultUserRole: UserRole.USER,
            rateLimits: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
            fileUpload: {
                maxSize: 10 * 1024 * 1024, // 10 MB
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
            },
            email: { smtpEnabled: false, fromAddress: 'noreply@aiplanner.com' },
            ai: { enabled: true, dailyLimit: 100 },
        };
    }

    async getSystemHealth(): Promise<SystemStats['systemHealth']> {
        // TODO: ping DB, Redis, external APIs, etc.
        return {
            database: 'healthy',
            redis: 'healthy',
            externalServices: { firebase: 'healthy', sendGrid: 'healthy' },
        };
    }

    async getPerformanceMetrics(filters: any): Promise<any> {
        // TODO: pull from your metrics provider (Prometheus, CloudWatch, …)
        return {
            component: filters.component ?? 'api',
            metric: filters.metric ?? 'response_time',
            data: [],
            average: 0,
            trend: 'stable',
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Backups                                                           */
    /* ------------------------------------------------------------------ */

    async insertBackupRecord(record: Omit<BackupRecord, 'id'>): Promise<BackupRecord> {
        const id = this.backupColl.doc().id;
        const full: BackupRecord = { id, ...record, createdAt: Timestamp.now() };
        await this.backupColl.doc(id).set(full);
        return full;
    }

    async listBackups(limit = 50): Promise<BackupRecord[]> {
        const snap = await this.backupColl.orderBy('createdAt', 'desc').limit(limit).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as BackupRecord));
    }

    async getBackupById(id: string): Promise<BackupRecord | null> {
        const snap = await this.backupColl.doc(id).get();
        return snap.exists ? ({ id: snap.id, ...snap.data() } as BackupRecord) : null;
    }
}