// src/modules/export/export.repository.ts
import { injectable } from 'tsyringe';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import { CacheService } from '../../shared/services/cache.service';
import {
    ExportResult,
    ExportStatus,
    ExportTemplate,
    ExportStats,
} from './export.types';

const firestore = firebaseConnection.getDatabase();

@injectable()
export class ExportRepository {
    private readonly exportColl = firestore.collection('exports');
    private readonly templateColl = firestore.collection('exportTemplates');

    constructor(private readonly cacheService: CacheService) {}

    /* ------------------------------------------------------------------ */
    /*  Core CRUD                                                         */
    /* ------------------------------------------------------------------ */

    async create(exportResult: ExportResult): Promise<ExportResult> {
        try {
            await this.exportColl
                .doc(exportResult.id)
                .set({ ...exportResult, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });

            await this.cacheService.set(`export:${exportResult.id}`, exportResult, { ttl: 3600 });
            logger.info(`Export created: ${exportResult.id}`);
            return exportResult;
        } catch (err) {
            logger.error('create export error', err);
            throw new AppError('Failed to create export', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findById(exportId: string): Promise<ExportResult | null> {
        try {
            const cached = await this.cacheService.get(`export:${exportId}`) as ExportResult;
            if (cached) return cached;

            const snap = await this.exportColl.doc(exportId).get();
            if (!snap.exists) return null;

            const data = this.mapExportDoc(snap);
            await this.cacheService.set(`export:${exportId}`, data, { ttl: 3600 });
            return data;
        } catch (err) {
            logger.error('findById error', { exportId, err });
            throw new AppError('Failed to fetch export', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async update(exportId: string, updates: Partial<ExportResult>): Promise<ExportResult> {
        try {
            updates.updatedAt = new Date();
            await this.exportColl.doc(exportId).update(updates);
            await this.cacheService.delete(`export:${exportId}`);

            const updated = (await this.findById(exportId))!;
            logger.info(`Export updated: ${exportId}`);
            return updated;
        } catch (err) {
            logger.error('update error', { exportId, updates, err });
            throw new AppError('Failed to update export', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async delete(exportId: string): Promise<void> {
        try {
            await this.exportColl.doc(exportId).delete();
            await this.cacheService.delete(`export:${exportId}`);
            logger.info(`Export deleted: ${exportId}`);
        } catch (err) {
            logger.error('delete error', { exportId, err });
            throw new AppError('Failed to delete export', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Queries                                                           */
    /* ------------------------------------------------------------------ */

    async findByUser(
        userId: string,
        limit = 20,
        offset = 0,
        status?: ExportStatus
    ): Promise<ExportResult[]> {
        try {
            let q: FirebaseFirestore.Query = this.exportColl
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            if (status) q = q.where('status', '==', status);

            const snap = await q.get();
            return snap.docs.map(d => this.mapExportDoc(d));
        } catch (err) {
            logger.error('findByUser error', { userId, limit, offset, status, err });
            throw new AppError('Failed to fetch user exports', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findExpired(): Promise<ExportResult[]> {
        try {
            const now = new Date();
            const snap = await this.exportColl
                .where('expiresAt', '<', now)
                .where('status', '==', 'completed')
                .get();

            return snap.docs.map(d => this.mapExportDoc(d));
        } catch (err) {
            logger.error('findExpired error', err);
            throw new AppError('Failed to fetch expired exports', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async countMonthlyUsage(userId: string, referenceDate: Date): Promise<{ count: number; resetsAt: Date }> {
        try {
            const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
            const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);

            const snap = await this.exportColl
                .where('userId', '==', userId)
                .where('createdAt', '>=', start)
                .where('createdAt', '<=', end)
                .where('status', 'in', ['completed', 'processing'])
                .count()
                .get();

            return { count: snap.data().count, resetsAt: end };
        } catch (err) {
            logger.error('countMonthlyUsage error', { userId, referenceDate, err });
            throw new AppError('Failed to count usage', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Templates                                                         */
    /* ------------------------------------------------------------------ */

    async listTemplates(type?: string): Promise<ExportTemplate[]> {
        try {
            let q: FirebaseFirestore.Query = this.templateColl
                .where('isPublic', '==', true)
                .orderBy('name');

            if (type) q = q.where('type', '==', type);

            const snap = await q.get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExportTemplate));
        } catch (err) {
            logger.error('listTemplates error', { type, err });
            throw new AppError('Failed to fetch templates', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async createTemplate(data: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExportTemplate> {
        try {
            const ref = this.templateColl.doc();
            const template: ExportTemplate = {
                id: ref.id,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await ref.set(template);
            logger.info(`Template created: ${ref.id}`);
            return template;
        } catch (err) {
            logger.error('createTemplate error', data, err);
            throw new AppError('Failed to create template', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Statistics & Cleanup                                              */
    /* ------------------------------------------------------------------ */

    async getStats(startDate: Date, endDate: Date): Promise<ExportStats> {
        try {
            const snap = await this.exportColl
                .where('createdAt', '>=', startDate)
                .where('createdAt', '<=', endDate)
                .get();

            const stats: ExportStats = {
                total: 0,
                byStatus: {},
                byFormat: {},
                byType: {},
                averageProcessingTime: 0,
                successRate: 0,
            };

            let totalTime = 0;
            let completed = 0;

            snap.docs.forEach(d => {
                const data = d.data();
                stats.total++;

                stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
                stats.byFormat[data.format] = (stats.byFormat[data.format] || 0) + 1;
                stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

                if (data.metadata?.processingTime && data.status === 'completed') {
                    totalTime += data.metadata.processingTime;
                    completed++;
                }
            });

            if (completed) stats.averageProcessingTime = Math.round(totalTime / completed);
            if (stats.total) stats.successRate = Math.round((stats.byStatus['completed'] || 0) / stats.total * 100);

            return stats;
        } catch (err) {
            logger.error('getStats error', { startDate, endDate, err });
            throw new AppError('Failed to compute stats', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async cleanup(olderThanDays = 30): Promise<number> {
        try {
            const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
            const snap = await this.exportColl
                .where('createdAt', '<', cutoff)
                .where('status', 'in', ['completed', 'failed', 'expired'])
                .limit(500)
                .get();

            const batch = firestore.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            logger.info(`Cleaned up ${snap.size} old exports`);
            return snap.size;
        } catch (err) {
            logger.error('cleanup error', { olderThanDays, err });
            throw new AppError('Failed to cleanup exports', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                           */
    /* ------------------------------------------------------------------ */

    private mapExportDoc(snap: FirebaseFirestore.DocumentSnapshot): ExportResult {
        const data = snap.data()!;
        return {
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            expiresAt: data.expiresAt?.toDate(),
        } as ExportResult;
    }
}