import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../shared/services/firebase.service';
import { CacheService } from '../../shared/services/cache.service';
import { ExportResult, ExportStatus } from './export.types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../shared/utils/logger';

@Injectable()
export class ExportRepository {
    private readonly logger = new Logger(ExportRepository.name);
    private readonly db;
    private readonly cachePrefix = 'export:';

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly cacheService: CacheService
    ) {
        this.db = this.firebaseService.getFirestore();
    }

    /**
     * Save export record
     */
    async saveExport(exportResult: ExportResult): Promise<void> {
        try {
            const exportRef = this.db.collection('exports').doc(exportResult.id);
            await exportRef.set({
                ...exportResult,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Cache for quick access
            const cacheKey = `${this.cachePrefix}export:${exportResult.id}`;
            await this.cacheService.set(cacheKey, exportResult, 3600); // 1 hour

            logger.info(`Export saved: ${exportResult.id}`);
        } catch (error) {
            logger.error('Error saving export:', error);
            throw error;
        }
    }

    /**
     * Get export by ID
     */
    async getExport(exportId: string): Promise<ExportResult | null> {
        try {
            // Check cache first
            const cacheKey = `${this.cachePrefix}export:${exportId}`;
            const cached = await this.cacheService.get<ExportResult>(cacheKey);
            if (cached) return cached;

            // Fetch from database
            const exportRef = this.db.collection('exports').doc(exportId);
            const doc = await exportRef.get();

            if (!doc.exists) return null;

            const exportResult = {
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
                completedAt: doc.data().completedAt?.toDate(),
                expiresAt: doc.data().expiresAt?.toDate()
            } as ExportResult;

            // Cache for future requests
            await this.cacheService.set(cacheKey, exportResult, 3600);

            return exportResult;
        } catch (error) {
            logger.error('Error retrieving export:', error);
            throw error;
        }
    }

    /**
     * Update export
     */
    async updateExport(exportId: string, updates: Partial<ExportResult>): Promise<void> {
        try {
            const exportRef = this.db.collection('exports').doc(exportId);
            await exportRef.update({
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Invalidate cache
            const cacheKey = `${this.cachePrefix}export:${exportId}`;
            await this.cacheService.delete(cacheKey);

            logger.info(`Export updated: ${exportId}`);
        } catch (error) {
            logger.error('Error updating export:', error);
            throw error;
        }
    }

    /**
     * Delete export
     */
    async deleteExport(exportId: string): Promise<void> {
        try {
            const exportRef = this.db.collection('exports').doc(exportId);
            await exportRef.delete();

            // Remove from cache
            const cacheKey = `${this.cachePrefix}export:${exportId}`;
            await this.cacheService.delete(cacheKey);

            logger.info(`Export deleted: ${exportId}`);
        } catch (error) {
            logger.error('Error deleting export:', error);
            throw error;
        }
    }

    /**
     * Get user exports
     */
    async getUserExports(
        userId: string,
        limit: number = 20,
        offset: number = 0,
        status?: ExportStatus
    ): Promise<ExportResult[]> {
        try {
            let query = this.db.collection('exports')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
                completedAt: doc.data().completedAt?.toDate(),
                expiresAt: doc.data().expiresAt?.toDate()
            } as ExportResult));
        } catch (error) {
            logger.error('Error retrieving user exports:', error);
            throw error;
        }
    }

    /**
     * Get expired exports
     */
    async getExpiredExports(): Promise<ExportResult[]> {
        try {
            const now = new Date();
            const snapshot = await this.db.collection('exports')
                .where('expiresAt', '<', now)
                .where('status', '==', 'completed')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
                completedAt: doc.data().completedAt?.toDate(),
                expiresAt: doc.data().expiresAt?.toDate()
            } as ExportResult));
        } catch (error) {
            logger.error('Error retrieving expired exports:', error);
            throw error;
        }
    }

    /**
     * Get user export usage for current month
     */
    async getUserExportUsage(userId: string, referenceDate: Date): Promise<{
        count: number;
        resetsAt: Date;
    }> {
        try {
            const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
            const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);

            const snapshot = await this.db.collection('exports')
                .where('userId', '==', userId)
                .where('createdAt', '>=', startOfMonth)
                .where('createdAt', '<=', endOfMonth)
                .where('status', 'in', ['completed', 'processing'])
                .get();

            return {
                count: snapshot.size,
                resetsAt: endOfMonth
            };
        } catch (error) {
            logger.error('Error retrieving user export usage:', error);
            throw error;
        }
    }

    /**
     * Get export templates
     */
    async getExportTemplates(type?: string): Promise<any[]> {
        try {
            let query = this.db.collection('exportTemplates')
                .where('isPublic', '==', true)
                .orderBy('name');

            if (type) {
                query = query.where('type', '==', type);
            }

            const snapshot = await query.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
                updatedAt: doc.data().updatedAt?.toDate()
            }));
        } catch (error) {
            logger.error('Error retrieving export templates:', error);
            throw error;
        }
    }

    /**
     * Create export template
     */
    async createExportTemplate(templateData: any): Promise<any> {
        try {
            const templateRef = this.db.collection('exportTemplates').doc();
            const template = {
                ...templateData,
                id: templateRef.id,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await templateRef.set(template);

            logger.info(`Export template created: ${templateRef.id}`);
            return { id: templateRef.id, ...template };
        } catch (error) {
            logger.error('Error creating export template:', error);
            throw error;
        }
    }

    /**
     * Get export file from storage
     */
    async getExportFile(fileUrl: string): Promise<Buffer> {
        try {
            return await this.firebaseService.getStorageFile(fileUrl);
        } catch (error) {
            logger.error('Error retrieving export file:', error);
            throw error;
        }
    }

    /**
     * Cleanup old exports
     */
    async cleanupOldExports(daysToKeep: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            let cleanedCount = 0;

            // Get old exports
            const snapshot = await this.db.collection('exports')
                .where('createdAt', '<', cutoffDate)
                .where('status', 'in', ['completed', 'failed', 'expired'])
                .limit(500)
                .get();

            const batch = this.db.batch();

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                cleanedCount++;
            });

            await batch.commit();

            logger.info(`Cleaned up ${cleanedCount} old export records`);
            return cleanedCount;
        } catch (error) {
            logger.error('Error cleaning up old exports:', error);
            throw error;
        }
    }

    /**
     * Get export statistics
     */
    async getExportStats(startDate: Date, endDate: Date): Promise<any> {
        try {
            const snapshot = await this.db.collection('exports')
                .where('createdAt', '>=', startDate)
                .where('createdAt', '<=', endDate)
                .get();

            const stats = {
                total: 0,
                byStatus: {},
                byFormat: {},
                byType: {},
                averageProcessingTime: 0,
                successRate: 0
            };

            let totalProcessingTime = 0;
            let completedCount = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                stats.total++;

                // By status
                stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;

                // By format
                stats.byFormat[data.format] = (stats.byFormat[data.format] || 0) + 1;

                // By type
                stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

                // Processing time
                if (data.metadata?.processingTime && data.status === 'completed') {
                    totalProcessingTime += data.metadata.processingTime;
                    completedCount++;
                }
            });

            // Calculate averages
            if (completedCount > 0) {
                stats.averageProcessingTime = Math.round(totalProcessingTime / completedCount);
            }

            if (stats.total > 0) {
                stats.successRate = Math.round((stats.byStatus['completed'] || 0) / stats.total * 100);
            }

            return stats;
        } catch (error) {
            logger.error('Error retrieving export statistics:', error);
            throw error;
        }
    }
}