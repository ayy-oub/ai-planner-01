// src/modules/section/section.repository.ts
import { Timestamp } from 'firebase-admin/firestore';
import firebaseConnection from '../../infrastructure/database/firebase';
import { CacheService } from '../../shared/services/cache.service';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import {
    Section,
    SectionStatistics,
} from './section.types';

const firestore = firebaseConnection.getDatabase();

export class SectionRepository {
    private readonly sectionColl = firestore.collection('sections');
    private readonly activityColl = firestore.collection('activities');

    constructor(private readonly cacheService: CacheService) { }

    /* ------------------------------------------------------------------ */
    /*  Core CRUD                                                         */
    /* ------------------------------------------------------------------ */

    async createSection(section: Section): Promise<Section> {
        try {
            const now = Timestamp.now().toDate(); // or keep as Timestamp if type allows

            const data = {
                ...section,
                createdAt: now,
                updatedAt: now
            };

            await this.sectionColl.doc(section.id).set(data);
            await this.cacheService.set(`section:${section.id}`, data, { ttl: 300 });
            await this.cacheService.delete(`planner-sections:${section.plannerId}`);

            logger.info(`Section created: ${section.id}`);
            return data;
        } catch (err) {
            logger.error('createSection error', { section, err });
            throw new AppError('Failed to create section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findById(sectionId: string): Promise<Section | null> {
        try {
            const cached = await this.cacheService.get(`section:${sectionId}`);
            if (cached) return cached as Section;

            const snap = await this.sectionColl.doc(sectionId).get();
            if (!snap.exists) return null;

            const data = { id: snap.id, ...snap.data() } as Section;
            await this.cacheService.set(`section:${sectionId}`, data, { ttl: 300 });

            return data;
        } catch (err) {
            logger.error('findById error', { sectionId, err });
            throw new AppError('Failed to fetch section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateSection(sectionId: string, updates: Partial<Section>): Promise<Section> {
        try {
            updates.updatedAt = Timestamp.now() as any;
            await this.sectionColl.doc(sectionId).update(updates);

            await this.cacheService.delete(`section:${sectionId}`);
            const updated = await this.findById(sectionId);
            if (!updated) throw new AppError('Section not found after update', 404);

            await this.cacheService.delete(`planner-sections:${updated.plannerId}`);
            await this.cacheService.delete(`section-stats:${sectionId}`);

            logger.info(`Section updated: ${sectionId}`);
            return updated;
        } catch (err) {
            logger.error('updateSection error', { sectionId, updates, err });
            throw new AppError('Failed to update section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async deleteSection(sectionId: string): Promise<void> {
        try {
            const section = await this.findById(sectionId);
            await this.sectionColl.doc(sectionId).delete();

            await this.cacheService.delete(`section:${sectionId}`);
            await this.cacheService.delete(`section-stats:${sectionId}`);
            if (section) await this.cacheService.delete(`planner-sections:${section.plannerId}`);

            logger.info(`Section deleted: ${sectionId}`);
        } catch (err) {
            logger.error('deleteSection error', { sectionId, err });
            throw new AppError('Failed to delete section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Queries                                                           */
    /* ------------------------------------------------------------------ */

    async findByPlannerId(plannerId: string): Promise<Section[]> {
        try {
            const cacheKey = `planner-sections:${plannerId}`;
            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached as Section[];

            const snap = await this.sectionColl.where('plannerId', '==', plannerId).orderBy('order', 'asc').get();
            const sections = snap.docs.map(d => ({ id: d.id, ...d.data() } as Section));

            await this.cacheService.set(cacheKey, sections, { ttl: 300 });
            return sections;
        } catch (err) {
            logger.error('findByPlannerId error', { plannerId, err });
            throw new AppError('Failed to fetch sections', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findByIds(sectionIds: string[]): Promise<Section[]> {
        try {
            if (!sectionIds.length) return [];

            const snap = await this.sectionColl.where('__name__', 'in', sectionIds).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Section));
        } catch (err) {
            logger.error('findByIds error', { sectionIds, err });
            throw new AppError('Failed to fetch sections by IDs', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Reordering & Stats                                                */
    /* ------------------------------------------------------------------ */

    async reorderSections(reorderData: Array<{ id: string; order: number }>): Promise<void> {
        try {
            const batch = firestore.batch();

            reorderData.forEach(item => {
                const ref = this.sectionColl.doc(item.id);
                batch.update(ref, { order: item.order, updatedAt: Timestamp.now() });
            });

            await batch.commit();
            for (const item of reorderData) await this.cacheService.delete(`section:${item.id}`);

            const sample = await this.findById(reorderData[0].id);
            if (sample) await this.cacheService.delete(`planner-sections:${sample.plannerId}`);

            logger.info(`Sections reordered: ${reorderData.length} items`);
        } catch (err) {
            logger.error('reorderSections error', { reorderData, err });
            throw new AppError('Failed to reorder sections', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getMaxOrder(plannerId: string): Promise<number | null> {
        try {
            const snap = await this.sectionColl
                .where('plannerId', '==', plannerId)
                .orderBy('order', 'desc')
                .limit(1)
                .get();

            if (snap.empty) return null;
            return snap.docs[0].data().order;
        } catch (err) {
            logger.error('getMaxOrder error', { plannerId, err });
            throw new AppError('Failed to get max order', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async countByPlannerId(plannerId: string): Promise<number> {
        try {
            const countSnap = await this.sectionColl.where('plannerId', '==', plannerId).count().get();
            return countSnap.data().count;
        } catch (err) {
            logger.error('countByPlannerId error', { plannerId, err });
            throw new AppError('Failed to count sections', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getSectionStatistics(sectionId: string): Promise<SectionStatistics> {
        try {
            const cacheKey = `section-stats:${sectionId}`;
            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached as SectionStatistics;

            const section = await this.findById(sectionId);
            if (!section) throw new AppError('Section not found', 404);

            const activitiesSnap = await this.activityColl.where('sectionId', '==', sectionId).get();

            let total = 0, completed = 0, pending = 0, overdue = 0;
            const byStatus: Record<string, number> = {};
            const byPriority: Record<string, number> = {};
            const now = new Date();

            activitiesSnap.forEach(doc => {
                const a = doc.data();
                total++;
                byStatus[a.status] = (byStatus[a.status] || 0) + 1;
                byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;

                if (a.status === 'completed') completed++;
                else if (['pending', 'in-progress'].includes(a.status)) {
                    pending++;
                    if (a.dueDate && a.dueDate.toDate() < now) overdue++;
                }
            });

            const stats: SectionStatistics = {
                totalActivities: total,
                completedActivities: completed,
                pendingActivities: pending,
                overdueActivities: overdue,
                activitiesByStatus: byStatus,
                activitiesByPriority: byPriority,
                lastActivityAt: section.metadata?.lastActivityAt || null
            };

            await this.cacheService.set(cacheKey, stats, { ttl: 300 });
            return stats;
        } catch (err) {
            logger.error('getSectionStatistics error', { sectionId, err });
            throw new AppError('Failed to get section statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Activity Cleanup                                                   */
    /* ------------------------------------------------------------------ */

    async deleteActivitiesBySection(sectionId: string): Promise<void> {
        try {
            const snap = await this.activityColl.where('sectionId', '==', sectionId).get();
            const batch = firestore.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            logger.info(`Activities deleted for section: ${sectionId}`);
        } catch (err) {
            logger.error('deleteActivitiesBySection error', { sectionId, err });
            throw new AppError('Failed to delete activities for section', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }
}
