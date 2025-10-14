// src/modules/planner/planner.repository.ts
import { injectable } from 'tsyringe';
import { Timestamp } from 'firebase-admin/firestore';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { CacheService } from '../../shared/services/cache.service';
import {
    Planner,
    PlannerFilterRequest,
    PlannerListResponse,
    Activity,
    Section,
    Collaborator,
} from './planner.types';

const firestore = firebaseConnection.getDatabase();

@injectable()
export class PlannerRepository {
    private readonly plannerColl = firestore.collection('planners');
    private readonly sectionColl = firestore.collection('sections');
    private readonly activityColl = firestore.collection('activities');

    constructor(private readonly cacheService: CacheService) { }

    /* ------------------------------------------------------------------ */
    /*  Core CRUD                                                         */
    /* ------------------------------------------------------------------ */

    async createPlanner(p: Planner): Promise<Planner> {
        try {
            await this.plannerColl.doc(p.id).set({ ...p, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
            await this.cacheService.set(`planner:${p.id}`, p, { ttl: 300 }); // 5 min
            await this.updateUserPlannerCounter(p.userId, 'add');
            logger.info(`Planner created: ${p.id}`);
            return p;
        } catch (err) {
            logger.error('createPlanner error', err);
            throw new AppError('Failed to create planner', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findById(plannerId: string): Promise<Planner | null> {
        try {
            const cached = await this.cacheService.get(`planner:${plannerId}`);
            if (cached) return cached as Planner;

            const snap = await this.plannerColl.doc(plannerId).get();
            if (!snap.exists) return null;

            const data = { id: snap.id, ...snap.data() } as Planner;
            await this.cacheService.set(`planner:${plannerId}`, data, { ttl: 300 });
            return data;
        } catch (err) {
            logger.error('findById error', { plannerId, err });
            throw new AppError('Failed to fetch planner', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updatePlanner(plannerId: string, updates: Partial<Planner>): Promise<Planner> {
        try {
            updates.updatedAt = Timestamp.now() as any;
            await this.plannerColl.doc(plannerId).update(updates);
            await this.cacheService.delete(`planner:${plannerId}`); // invalidate
            const updated = (await this.findById(plannerId))!;
            logger.info(`Planner updated: ${plannerId}`);
            return updated;
        } catch (err) {
            logger.error('updatePlanner error', { plannerId, updates, err });
            throw new AppError('Failed to update planner', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async deletePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            await this.plannerColl.doc(plannerId).delete();
            await this.cacheService.delete(`planner:${plannerId}`);
            await this.updateUserPlannerCounter(userId, 'remove');
            await this.batchDeleteContents(plannerId);
            logger.info(`Planner deleted: ${plannerId}`);
        } catch (err) {
            logger.error('deletePlanner error', { plannerId, userId, err });
            throw new AppError('Failed to delete planner', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  List & Shared
    /* ------------------------------------------------------------------ */

    async findByUserId(userId: string, filters: PlannerFilterRequest): Promise<PlannerListResponse> {
        try {
            const { search, tags, isArchived, isPublic, sortBy = 'updatedAt', sortOrder = 'desc', page = 1, limit = 20 } = filters;
            let q: FirebaseFirestore.Query = this.plannerColl.where('userId', '==', userId);

            if (search) q = q.where('title', '>=', search).where('title', '<=', search + '\uf8ff');
            if (tags?.length) q = q.where('tags', 'array-contains-any', tags);
            if (isArchived !== undefined) q = isArchived ? q.where('archivedAt', '!=', null) : q.where('archivedAt', '==', null);
            if (isPublic !== undefined) q = q.where('settings.isPublic', '==', isPublic);

            q = q.orderBy(sortBy, sortOrder === 'asc' ? 'asc' : 'desc');

            const totalSnap = await q.count().get();
            const total = totalSnap.data().count;
            const offset = (page - 1) * limit;

            const snap = await q.limit(limit).offset(offset).get();
            const planners = snap.docs.map(d => ({ id: d.id, ...d.data() } as Planner));

            return {
                planners,
                total,
                page,
                limit,
                hasNext: offset + limit < total,
                hasPrev: page > 1,
            };
        } catch (err) {
            logger.error('findByUserId error', { userId, filters, err });
            throw new AppError('Failed to fetch planners', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findSharedPlanners(userId: string, filters: PlannerFilterRequest): Promise<PlannerListResponse> {
        try {
            const { sortBy = 'updatedAt', sortOrder = 'desc', page = 1, limit = 20 } = filters;
            let q: FirebaseFirestore.Query = this.plannerColl.where('collaborators', 'array-contains', { userId });

            q = q.orderBy(sortBy, sortOrder === 'asc' ? 'asc' : 'desc');

            const totalSnap = await q.count().get();
            const total = totalSnap.data().count;
            const offset = (page - 1) * limit;

            const snap = await q.limit(limit).offset(offset).get();
            const planners = snap.docs.map(d => ({ id: d.id, ...d.data() } as Planner));

            return { planners, total, page, limit, hasNext: offset + limit < total, hasPrev: page > 1 };
        } catch (err) {
            logger.error('findSharedPlanners error', { userId, filters, err });
            throw new AppError('Failed to fetch shared planners', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Collaborators
    /* ------------------------------------------------------------------ */

    async addCollaborator(plannerId: string, collaborator: Collaborator): Promise<void> {
        try {
            const p = await this.findById(plannerId);
            if (!p) throw new AppError('Planner not found', 404);

            const exists = p.collaborators.find(c => c.userId === collaborator.userId);
            if (exists) Object.assign(exists, collaborator);
            else p.collaborators.push(collaborator);

            await this.updatePlanner(plannerId, { collaborators: p.collaborators });
            logger.info(`Collaborator added to planner ${plannerId}: ${collaborator.userId}`);
        } catch (err) {
            logger.error('addCollaborator error', { plannerId, collaborator, err });
            throw err instanceof AppError ? err : new AppError('Failed to add collaborator', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async removeCollaborator(plannerId: string, userId: string): Promise<void> {
        try {
            const p = await this.findById(plannerId);
            if (!p) throw new AppError('Planner not found', 404);

            p.collaborators = p.collaborators.filter(c => c.userId !== userId);
            await this.updatePlanner(plannerId, { collaborators: p.collaborators });
            logger.info(`Collaborator removed from planner ${plannerId}: ${userId}`);
        } catch (err) {
            logger.error('removeCollaborator error', { plannerId, userId, err });
            throw err instanceof AppError ? err : new AppError('Failed to remove collaborator', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Archive / Unarchive
    /* ------------------------------------------------------------------ */

    async archivePlanner(plannerId: string): Promise<void> {
        await this.updatePlanner(plannerId, { archivedAt: Timestamp.now() } as any);
        logger.info(`Planner archived: ${plannerId}`);
    }

    async unarchivePlanner(plannerId: string): Promise<void> {
        await this.updatePlanner(plannerId, { archivedAt: null } as any);
        logger.info(`Planner unarchived: ${plannerId}`);
    }

    /* ------------------------------------------------------------------ */
    /*  Statistics
    /* ------------------------------------------------------------------ */

    async getPlannerStatistics(plannerId: string) {
        try {
            const sections = await this.getSections(plannerId);
            const activities = await Promise.all(sections.map(s => this.getActivities(s.id)));

            const flat = activities.flat();
            const now = new Date();

            const stats = {
                totalSections: sections.length,
                totalActivities: flat.length,
                completedActivities: flat.filter(a => a.status === 'completed').length,
                pendingActivities: flat.filter(a => ['pending', 'in-progress'].includes(a.status)).length,
                overdueActivities: flat.filter(
                    a => a.dueDate && a.dueDate < now && !['completed', 'cancelled', 'archived'].includes(a.status)
                ).length, activitiesByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
                activitiesByStatus: { pending: 0, 'in-progress': 0, completed: 0, cancelled: 0, archived: 0 },
            };

            flat.forEach(a => {
                stats.activitiesByPriority[a.priority]++;
                stats.activitiesByStatus[a.status]++;
            });

            return stats;
        } catch (err) {
            logger.error('getPlannerStatistics error', { plannerId, err });
            throw new AppError('Failed to compute statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers
    /* ------------------------------------------------------------------ */

    private async getSections(plannerId: string): Promise<Section[]> {
        const snap = await this.sectionColl.where('plannerId', '==', plannerId).orderBy('order', 'asc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Section));
    }

    private async getActivities(sectionId: string): Promise<Activity[]> {
        const snap = await this.activityColl.where('sectionId', '==', sectionId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
    }

    private async batchDeleteContents(plannerId: string): Promise<void> {
        const batch = firestore.batch();

        // sections
        const secSnap = await this.sectionColl.where('plannerId', '==', plannerId).get();
        secSnap.docs.forEach(d => batch.delete(d.ref));

        // activities
        const actSnap = await this.activityColl.where('plannerId', '==', plannerId).get();
        actSnap.docs.forEach(d => batch.delete(d.ref));

        await batch.commit();
    }

    private async updateUserPlannerCounter(userId: string, action: 'add' | 'remove'): Promise<void> {
        const delta = action === 'add' ? 1 : -1;
        await firestore.collection('users').doc(userId).update({
            'statistics.totalPlanners': FieldValue.increment(delta),
            updatedAt: Timestamp.now(),
        });
    }
}