// src/modules/activity/activity.repository.ts
import { Timestamp } from 'firebase-admin/firestore';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import { CacheService } from '../../shared/services/cache.service';
import {
    Activity,
    ActivityFilterRequest,
    ActivityListResponse,
    ActivityStatistics,
    ActivityStatus,
    ActivityPriority,
    ActivityType,
    TimeEntry,
} from './activity.types';

const firestore = firebaseConnection.getDatabase();

export class ActivityRepository {
    private readonly activityColl = firestore.collection('activities');

    constructor(private readonly cacheService: CacheService) { }

    /* ------------------------------------------------------------------ */
    /*  Core CRUD                                                         */
    /* ------------------------------------------------------------------ */

    async createActivity(a: Activity): Promise<Activity> {
        try {
            const payload = { ...a, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as any;
            await this.activityColl.doc(a.id).set(payload);

            await this.cacheService.set(`activity:${a.id}`, payload, { ttl: 300 });
            await this.cacheService.delete(`section-activities:${a.sectionId}`);

            logger.info(`Activity created: ${a.id}`);
            return a;
        } catch (err) {
            logger.error('createActivity error', err);
            throw new AppError('Failed to create activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findById(activityId: string): Promise<Activity | null> {
        try {
            const cached = await this.cacheService.get(`activity:${activityId}`);
            if (cached) return cached as Activity;

            const snap = await this.activityColl.doc(activityId).get();
            if (!snap.exists) return null;

            const data = { id: snap.id, ...snap.data() } as Activity;
            await this.cacheService.set(`activity:${activityId}`, data, { ttl: 300 });
            return data;
        } catch (err) {
            logger.error('findById error', { activityId, err });
            throw new AppError('Failed to fetch activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateActivity(activityId: string, updates: Partial<Activity>): Promise<Activity> {
        try {
            const updateData = { ...updates, updatedAt: Timestamp.now() } as any;
            await this.activityColl.doc(activityId).update(updateData);

            // Invalidate cache and refresh
            await this.cacheService.delete(`activity:${activityId}`);
            const updated = (await this.findById(activityId))!;
            if (!updated) throw new AppError('Activity not found after update', 404);

            await this.cacheService.set(`activity:${activityId}`, updated, { ttl: 300 });
            await this.cacheService.delete(`section-activities:${updated.sectionId}`);
            await this.cacheService.delete(`section-stats:${updated.sectionId}`);

            logger.info(`Activity updated: ${activityId}`);
            return updated;
        } catch (err) {
            logger.error('updateActivity error', { activityId, updates, err });
            throw new AppError('Failed to update activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async deleteActivity(activityId: string): Promise<void> {
        try {
            const activity = await this.findById(activityId);
            await this.activityColl.doc(activityId).delete();

            await this.cacheService.delete(`activity:${activityId}`);
            if (activity) {
                await this.cacheService.delete(`section-activities:${activity.sectionId}`);
                await this.cacheService.delete(`section-stats:${activity.sectionId}`);
            }

            logger.info(`Activity deleted: ${activityId}`);
        } catch (err) {
            logger.error('deleteActivity error', { activityId, err });
            throw new AppError('Failed to delete activity', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Finders / Lists                                                    */
    /* ------------------------------------------------------------------ */

    async findBySectionId(sectionId: string): Promise<Activity[]> {
        try {
            const cacheKey = `section-activities:${sectionId}`;
            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached as Activity[];

            const snap = await this.activityColl.where('sectionId', '==', sectionId).orderBy('order', 'asc').get();
            const activities = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));

            await this.cacheService.set(cacheKey, activities, { ttl: 300 });
            return activities;
        } catch (err) {
            logger.error('findBySectionId error', { sectionId, err });
            throw new AppError('Failed to fetch activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findByPlannerId(plannerId: string): Promise<Activity[]> {
        try {
            const snap = await this.activityColl.where('plannerId', '==', plannerId).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        } catch (err) {
            logger.error('findByPlannerId error', { plannerId, err });
            throw new AppError('Failed to fetch activities by planner', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findByIds(activityIds: string[]): Promise<Activity[]> {
        try {
            if (!activityIds.length) return [];
            const snap = await this.activityColl.where('__name__', 'in', activityIds).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        } catch (err) {
            logger.error('findByIds error', { activityIds, err });
            throw new AppError('Failed to fetch activities by ids', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findWithFilters(filters: ActivityFilterRequest): Promise<ActivityListResponse> {
        try {
            const {
                sectionId,
                plannerId,
                status,
                priority,
                type,
                tags,
                assignee,
                dueDateFrom,
                dueDateTo,
                completedFrom,
                completedTo,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                page = 1,
                limit = 20,
            } = filters;

            const offset = (page - 1) * limit;
            let q: FirebaseFirestore.Query = this.activityColl as any;

            if (sectionId) q = q.where('sectionId', '==', sectionId);
            if (plannerId) q = q.where('plannerId', '==', plannerId);
            if (status && status.length) q = q.where('status', 'in', status);
            if (priority && priority.length) q = q.where('priority', 'in', priority);
            if (type && type.length) q = q.where('type', 'in', type);
            if (tags && tags.length) q = q.where('tags', 'array-contains-any', tags);
            if (assignee && assignee.length) q = q.where('assignee', 'in', assignee);
            if (dueDateFrom) q = q.where('dueDate', '>=', dueDateFrom);
            if (dueDateTo) q = q.where('dueDate', '<=', dueDateTo);
            if (completedFrom) q = q.where('completedAt', '>=', completedFrom);
            if (completedTo) q = q.where('completedAt', '<=', completedTo);

            if (search) q = q.where('title', '>=', search).where('title', '<=', search + '\uf8ff');

            q = q.orderBy(sortBy, sortOrder === 'asc' ? 'asc' : 'desc');

            const totalSnap = await q.count().get();
            const total = totalSnap.data().count;
            const snap = await q.limit(limit).offset(offset).get();

            const activities = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));

            return {
                activities,
                total,
                page,
                limit,
                hasNext: offset + limit < total,
                hasPrev: page > 1,
                filters,
            };
        } catch (err) {
            logger.error('findWithFilters error', { filters, err });
            throw new AppError('Failed to fetch activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Bulk operations                                                    */
    /* ------------------------------------------------------------------ */

    async bulkUpdate(activityIds: string[], updates: Partial<Activity>): Promise<void> {
        try {
            const batch = firestore.batch();
            const updateData = { ...updates, updatedAt: Timestamp.now() } as any;

            for (const id of activityIds) {
                batch.update(this.activityColl.doc(id), updateData);
            }

            await batch.commit();

            for (const id of activityIds) {
                await this.cacheService.delete(`activity:${id}`);
                const act = await this.findById(id);
                if (act) {
                    await this.cacheService.delete(`section-activities:${act.sectionId}`);
                    await this.cacheService.delete(`section-stats:${act.sectionId}`);
                }
            }

            logger.info(`Bulk update completed: ${activityIds.length} activities`);
        } catch (err) {
            logger.error('bulkUpdate error', { activityIds, updates, err });
            throw new AppError('Failed to bulk update activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async bulkDelete(activityIds: string[]): Promise<void> {
        try {
            const batch = firestore.batch();

            for (const id of activityIds) {
                batch.delete(this.activityColl.doc(id));
            }

            await batch.commit();

            const sectionIds = new Set<string>();
            for (const id of activityIds) {
                await this.cacheService.delete(`activity:${id}`);
                const act = await this.findById(id);
                if (act) sectionIds.add(act.sectionId);
            }

            for (const secId of sectionIds) {
                await this.cacheService.delete(`section-activities:${secId}`);
                await this.cacheService.delete(`section-stats:${secId}`);
            }

            logger.info(`Bulk delete completed: ${activityIds.length} activities`);
        } catch (err) {
            logger.error('bulkDelete error', { activityIds, err });
            throw new AppError('Failed to bulk delete activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Reorder & section cleanup                                          */
    /* ------------------------------------------------------------------ */

    async reorderActivities(reorderData: Array<{ id: string; order: number }>): Promise<void> {
        try {
            const batch = firestore.batch();
            for (const item of reorderData) {
                batch.update(this.activityColl.doc(item.id), { order: item.order, updatedAt: Timestamp.now() } as any);
            }
            await batch.commit();

            const sectionIds = new Set<string>();
            for (const item of reorderData) {
                await this.cacheService.delete(`activity:${item.id}`);
                const act = await this.findById(item.id);
                if (act) sectionIds.add(act.sectionId);
            }
            for (const secId of sectionIds) {
                await this.cacheService.delete(`section-activities:${secId}`);
            }

            logger.info(`Activities reordered: ${reorderData.length} items`);
        } catch (err) {
            logger.error('reorderActivities error', { reorderData, err });
            throw new AppError('Failed to reorder activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async deleteBySectionId(sectionId: string): Promise<void> {
        try {
            const snap = await this.activityColl.where('sectionId', '==', sectionId).get();
            const batch = firestore.batch();
            const ids: string[] = [];

            snap.docs.forEach(d => {
                batch.delete(d.ref);
                ids.push(d.id);
            });

            await batch.commit();

            for (const id of ids) {
                await this.cacheService.delete(`activity:${id}`);
            }
            await this.cacheService.delete(`section-activities:${sectionId}`);

            logger.info(`Activities deleted for section: ${sectionId}`);
        } catch (err) {
            logger.error('deleteBySectionId error', { sectionId, err });
            throw new AppError('Failed to delete activities by section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Statistics & helpers                                                */
    /* ------------------------------------------------------------------ */

    async getActivityStatistics(filters: ActivityFilterRequest): Promise<ActivityStatistics> {
        try {
            const listResp = await this.findWithFilters({ ...filters, page: 1, limit: 10000 });
            const items = listResp.activities;

            const now = new Date();
            let completedCount = 0;
            let overdueCount = 0;
            let upcomingCount = 0;
            let totalTimeSpent = 0;
            const completionTimes: number[] = [];

            const activitiesByStatus: Record<ActivityStatus, number> = {
                pending: 0,
                'in-progress': 0,
                completed: 0,
                cancelled: 0,
                archived: 0,
            };

            const activitiesByPriority: Record<ActivityPriority, number> = {
                low: 0,
                medium: 0,
                high: 0,
                urgent: 0,
            };

            const activitiesByType: Record<ActivityType, number> = {
                task: 0,
                event: 0,
                note: 0,
                goal: 0,
                habit: 0,
                milestone: 0,
            };

            for (const a of items) {
                activitiesByStatus[a.status]++;
                if (a.priority) activitiesByPriority[a.priority]++;
                if (a.type) activitiesByType[a.type]++;

                if (a.status === 'completed') {
                    completedCount++;
                    if (a.metadata?.actualDuration) totalTimeSpent += a.metadata.actualDuration;
                    if (a.metadata?.actualDuration) completionTimes.push(a.metadata.actualDuration);
                }

                if (a.dueDate && a.dueDate < now && ['pending', 'in-progress'].includes(a.status)) overdueCount++;

                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                if (a.dueDate && a.dueDate > now && a.dueDate <= sevenDaysFromNow && ['pending', 'in-progress'].includes(a.status)) {
                    upcomingCount++;
                }
            }

            const completionRate = items.length > 0 ? (completedCount / items.length) * 100 : 0;
            const averageCompletionTime = completionTimes.length > 0 ? completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length : undefined;

            return {
                completionRate,
                averageCompletionTime,
                totalTimeSpent: totalTimeSpent > 0 ? totalTimeSpent : undefined,
                overdueCount,
                upcomingCount,
                activitiesByStatus,
                activitiesByPriority,
                activitiesByType,
            };
        } catch (err) {
            logger.error('getActivityStatistics error', { filters, err });
            throw new AppError('Failed to compute activity statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getDueSoon(userId: string, daysAhead = 7): Promise<Activity[]> {
        try {
            const now = new Date();
            const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

            const snap = await this.activityColl
                .where('assignee', '==', userId)
                .where('dueDate', '>=', now)
                .where('dueDate', '<=', future)
                .where('status', 'in', ['pending', 'in-progress'])
                .orderBy('dueDate', 'asc')
                .get();

            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        } catch (err) {
            logger.error('getDueSoon error', { userId, daysAhead, err });
            throw new AppError('Failed to fetch due soon activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getOverdue(userId: string): Promise<Activity[]> {
        try {
            const now = new Date();

            const snap = await this.activityColl
                .where('assignee', '==', userId)
                .where('dueDate', '<', now)
                .where('status', 'in', ['pending', 'in-progress'])
                .orderBy('dueDate', 'asc')
                .get();

            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        } catch (err) {
            logger.error('getOverdue error', { userId, err });
            throw new AppError('Failed to fetch overdue activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async searchActivities(userId: string, q: string, limit = 20): Promise<Activity[]> {
        try {
            const snap = await this.activityColl
                .where('createdBy', '==', userId)
                .where('title', '>=', q)
                .where('title', '<=', q + '\uf8ff')
                .limit(limit)
                .get();

            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        } catch (err) {
            logger.error('searchActivities error', { userId, q, err });
            throw new AppError('Failed to search activities', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }


    async saveTimeEntry(entry: TimeEntry): Promise<void> {
        await firestore.collection('timeEntries').doc(entry.id).set({ ...entry, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    }

    async getActiveTimeEntry(userId: string): Promise<TimeEntry | null> {
        const snap = await firestore.collection('timeEntries')
            .where('userId', '==', userId)
            .where('endTime', '==', null)
            .limit(1)
            .get();
        if (snap.empty) return null;
        const doc = snap.docs[0];
        return { id: doc.id, ...doc.data() } as TimeEntry;
    }

    async getTimeEntry(timeEntryId: string): Promise<TimeEntry | null> {
        const doc = await firestore.collection('timeEntries').doc(timeEntryId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as TimeEntry;
    }

    async getUserTimeEntries(userId: string): Promise<TimeEntry[]> {
        const snap = await firestore.collection('timeEntries')
            .where('userId', '==', userId)
            .orderBy('startTime', 'desc')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
    }

}
