// src/modules/section/section.repository.ts
import { injectable } from 'tsyringe';
import { FirebaseRepository } from '../../shared/repository/firebase.repository';
import { CacheService } from '../../shared/services/cache.service';
import { Section, SectionStatistics, ActivityStatus, ActivityPriority } from './section.types';
import { logger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

@injectable()
export class SectionRepository extends FirebaseRepository<Section> {
    constructor(cacheService: CacheService) {
        super('sections', cacheService);
    }

    /**
     * Create section
     */
    async createSection(section: Section): Promise<Section> {
        try {
            const docRef = this.collection.doc(section.id);
            await docRef.set({
                ...section,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Cache the section
            await this.cacheService.set(
                `section:${section.id}`,
                section,
                config.cache.ttl.section
            );

            // Update planner's section list cache
            await this.cacheService.delete(`planner-sections:${section.plannerId}`);

            logger.info(`Section created: ${section.id}`);
            return section;

        } catch (error) {
            logger.error('Create section failed:', error);
            throw error;
        }
    }

    /**
     * Find section by ID
     */
    async findById(sectionId: string): Promise<Section | null> {
        try {
            // Check cache first
            const cached = await this.cacheService.get<Section>(`section:${sectionId}`);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const doc = await this.collection.doc(sectionId).get();
            if (!doc.exists) {
                return null;
            }

            const section = doc.data() as Section;

            // Cache the result
            await this.cacheService.set(
                `section:${sectionId}`,
                section,
                config.cache.ttl.section
            );

            return section;

        } catch (error) {
            logger.error(`Find section by ID failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Find sections by planner ID
     */
    async findByPlannerId(plannerId: string): Promise<Section[]> {
        try {
            // Check cache first
            const cacheKey = `planner-sections:${plannerId}`;
            const cached = await this.cacheService.get<Section[]>(cacheKey);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const snapshot = await this.collection
                .where('plannerId', '==', plannerId)
                .orderBy('order', 'asc')
                .get();

            const sections: Section[] = [];
            snapshot.forEach((doc) => {
                sections.push(doc.data() as Section);
            });

            // Cache the result
            await this.cacheService.set(
                cacheKey,
                sections,
                config.cache.ttl.sectionList
            );

            return sections;

        } catch (error) {
            logger.error(`Find sections by planner ID failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Find sections by IDs
     */
    async findByIds(sectionIds: string[]): Promise<Section[]> {
        try {
            if (sectionIds.length === 0) {
                return [];
            }

            // Fetch from database
            const snapshot = await this.collection
                .where('__name__', 'in', sectionIds)
                .get();

            const sections: Section[] = [];
            snapshot.forEach((doc) => {
                sections.push(doc.data() as Section);
            });

            return sections;

        } catch (error) {
            logger.error(`Find sections by IDs failed: ${sectionIds.join(', ')}`, error);
            throw error;
        }
    }

    /**
     * Update section
     */
    async updateSection(sectionId: string, updates: Partial<Section>): Promise<Section> {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };

            // Update document
            await this.collection.doc(sectionId).update(updateData);

            // Get updated section
            const updatedSection = await this.findById(sectionId);
            if (!updatedSection) {
                throw new Error('Section not found after update');
            }

            // Update cache
            await this.cacheService.set(
                `section:${sectionId}`,
                updatedSection,
                config.cache.ttl.section
            );

            // Invalidate related caches
            await this.cacheService.delete(`planner-sections:${updatedSection.plannerId}`);
            await this.cacheService.delete(`section-stats:${sectionId}`);

            logger.info(`Section updated: ${sectionId}`);
            return updatedSection;

        } catch (error) {
            logger.error(`Update section failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Delete section
     */
    async deleteSection(sectionId: string): Promise<void> {
        try {
            // Get section first to know which caches to invalidate
            const section = await this.findById(sectionId);

            // Delete document
            await this.collection.doc(sectionId).delete();

            // Remove from cache
            await this.cacheService.delete(`section:${sectionId}`);
            await this.cacheService.delete(`section-stats:${sectionId}`);

            // Update planner's section list cache
            if (section) {
                await this.cacheService.delete(`planner-sections:${section.plannerId}`);
            }

            logger.info(`Section deleted: ${sectionId}`);

        } catch (error) {
            logger.error(`Delete section failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Reorder sections
     */
    async reorderSections(reorderData: Array<{ id: string; order: number }>): Promise<void> {
        try {
            const batch = this.db.batch();

            for (const item of reorderData) {
                const docRef = this.collection.doc(item.id);
                batch.update(docRef, {
                    order: item.order,
                    updatedAt: new Date()
                });
            }

            await batch.commit();

            // Invalidate caches for affected sections
            for (const item of reorderData) {
                await this.cacheService.delete(`section:${item.id}`);
            }

            // Get one section to find the planner ID
            const sampleSection = await this.findById(reorderData[0].id);
            if (sampleSection) {
                await this.cacheService.delete(`planner-sections:${sampleSection.plannerId}`);
            }

            logger.info(`Sections reordered: ${reorderData.length} sections`);

        } catch (error) {
            logger.error('Reorder sections failed:', error);
            throw error;
        }
    }

    /**
     * Count sections by planner ID
     */
    async countByPlannerId(plannerId: string): Promise<number> {
        try {
            const snapshot = await this.collection
                .where('plannerId', '==', plannerId)
                .count()
                .get();

            return snapshot.data().count;

        } catch (error) {
            logger.error(`Count sections by planner ID failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get max order for sections in a planner
     */
    async getMaxOrder(plannerId: string): Promise<number | null> {
        try {
            const snapshot = await this.collection
                .where('plannerId', '==', plannerId)
                .orderBy('order', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            return snapshot.docs[0].data().order;

        } catch (error) {
            logger.error(`Get max order failed for planner: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get section statistics
     */
    async getSectionStatistics(sectionId: string): Promise<SectionStatistics> {
        try {
            // Check cache first
            const cacheKey = `section-stats:${sectionId}`;
            const cached = await this.cacheService.get<SectionStatistics>(cacheKey);
            if (cached) {
                return cached;
            }

            // Get section
            const section = await this.findById(sectionId);
            if (!section) {
                throw new Error('Section not found');
            }

            // Get activities for this section
            const activities = await this.db.collection('activities')
                .where('sectionId', '==', sectionId)
                .get();

            let totalActivities = 0;
            let completedActivities = 0;
            let pendingActivities = 0;
            let overdueActivities = 0;
            const activitiesByStatus: Record<string, number> = {};
            const activitiesByPriority: Record<string, number> = {};

            activities.forEach((doc) => {
                const activity = doc.data();
                totalActivities++;

                // Count by status
                activitiesByStatus[activity.status] = (activitiesByStatus[activity.status] || 0) + 1;

                // Count by priority
                activitiesByPriority[activity.priority] = (activitiesByPriority[activity.priority] || 0) + 1;

                if (activity.status === 'completed') {
                    completedActivities++;
                } else if (activity.status === 'pending' || activity.status === 'in-progress') {
                    pendingActivities++;

                    // Check if overdue
                    if (activity.dueDate && activity.dueDate.toDate() < new Date()) {
                        overdueActivities++;
                    }
                }
            });

            const statistics: SectionStatistics = {
                totalActivities,
                completedActivities,
                pendingActivities,
                overdueActivities,
                activitiesByStatus,
                activitiesByPriority,
                lastActivityAt: section.metadata.lastActivityAt
            };

            // Cache the result
            await this.cacheService.set(
                cacheKey,
                statistics,
                config.cache.ttl.sectionStats
            );

            return statistics;

        } catch (error) {
            logger.error(`Get section statistics failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Delete activities by section ID
     */
    async deleteBySectionId(sectionId: string): Promise<void> {
        try {
            const snapshot = await this.db.collection('activities')
                .where('sectionId', '==', sectionId)
                .get();

            const batch = this.db.batch();
            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            logger.info(`Activities deleted for section: ${sectionId}`);

        } catch (error) {
            logger.error(`Delete activities by section ID failed: ${sectionId}`, error);
            throw error;
        }
    }
}