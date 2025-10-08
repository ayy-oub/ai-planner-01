// src/modules/planner/planner.repository.ts
import { injectable } from 'tsyringe';
import { FirebaseRepository } from '../../shared/repository/firebase.repository';
import { CacheService } from '../../shared/services/cache.service';
import {
    Planner,
    PlannerFilterRequest,
    PlannerListResponse,
    Activity,
    Section
} from './planner.types';
import { logger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

@injectable()
export class PlannerRepository extends FirebaseRepository<Planner> {
    constructor(cacheService: CacheService) {
        super('planners', cacheService);
    }

    /**
     * Create planner
     */
    async createPlanner(planner: Planner): Promise<Planner> {
        try {
            // Create planner document
            const docRef = this.collection.doc(planner.id);
            await docRef.set({
                ...planner,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Cache the planner
            await this.cacheService.set(
                `planner:${planner.id}`,
                planner,
                config.cache.ttl.planner
            );

            // Update user's planner list
            await this.updateUserPlanners(planner.userId, planner.id, 'add');

            logger.info(`Planner created: ${planner.id}`);
            return planner;

        } catch (error) {
            logger.error('Create planner failed:', error);
            throw error;
        }
    }

    /**
     * Find planner by ID
     */
    async findById(plannerId: string): Promise<Planner | null> {
        try {
            // Check cache first
            const cached = await this.cacheService.get<Planner>(`planner:${plannerId}`);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const doc = await this.collection.doc(plannerId).get();
            if (!doc.exists) {
                return null;
            }

            const planner = doc.data() as Planner;

            // Cache the result
            await this.cacheService.set(
                `planner:${plannerId}`,
                planner,
                config.cache.ttl.planner
            );

            return planner;

        } catch (error) {
            logger.error(`Find planner by ID failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Find planners by user ID
     */
    async findByUserId(userId: string, filters: PlannerFilterRequest): Promise<PlannerListResponse> {
        try {
            const {
                search,
                tags,
                isArchived,
                isPublic,
                sortBy = 'updatedAt',
                sortOrder = 'desc',
                page = 1,
                limit = 20
            } = filters;

            const offset = (page - 1) * limit;

            // Build query
            let query: any = this.collection.where('userId', '==', userId);

            // Apply filters
            if (search) {
                // For search, we need to use a different approach since Firestore doesn't support text search
                // This is a simplified version - in production, consider using Algolia or Elasticsearch
                query = query.where('title', '>=', search).where('title', '<=', search + '\uf8ff');
            }

            if (tags && tags.length > 0) {
                query = query.where('tags', 'array-contains-any', tags);
            }

            if (isArchived !== undefined) {
                if (isArchived) {
                    query = query.where('archivedAt', '!=', null);
                } else {
                    query = query.where('archivedAt', '==', null);
                }
            }

            if (isPublic !== undefined) {
                query = query.where('settings.isPublic', '==', isPublic);
            }

            // Apply sorting
            query = query.orderBy(sortBy, sortOrder);

            // Get total count
            const countSnapshot = await query.count().get();
            const total = countSnapshot.data().count;

            // Apply pagination
            query = query.limit(limit).offset(offset);

            // Execute query
            const snapshot = await query.get();
            const planners: Planner[] = [];

            snapshot.forEach((doc) => {
                planners.push(doc.data() as Planner);
            });

            return {
                planners,
                total,
                page,
                limit,
                hasNext: offset + limit < total,
                hasPrev: page > 1
            };

        } catch (error) {
            logger.error(`Find planners by user ID failed: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Find shared planners for user
     */
    async findSharedPlanners(userId: string, filters: PlannerFilterRequest): Promise<PlannerListResponse> {
        try {
            const { sortBy = 'updatedAt', sortOrder = 'desc', page = 1, limit = 20 } = filters;
            const offset = (page - 1) * limit;

            // Find planners where user is a collaborator
            let query: any = this.collection.where('collaborators', 'array-contains', {
                userId,
                role: ['viewer', 'editor', 'admin']
            });

            // Apply sorting
            query = query.orderBy(sortBy, sortOrder);

            // Get total count
            const countSnapshot = await query.count().get();
            const total = countSnapshot.data().count;

            // Apply pagination
            query = query.limit(limit).offset(offset);

            // Execute query
            const snapshot = await query.get();
            const planners: Planner[] = [];

            snapshot.forEach((doc) => {
                planners.push(doc.data() as Planner);
            });

            return {
                planners,
                total,
                page,
                limit,
                hasNext: offset + limit < total,
                hasPrev: page > 1
            };

        } catch (error) {
            logger.error(`Find shared planners failed: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Update planner
     */
    async updatePlanner(plannerId: string, updates: Partial<Planner>): Promise<Planner> {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };

            // Update document
            await this.collection.doc(plannerId).update(updateData);

            // Get updated planner
            const updatedPlanner = await this.findById(plannerId);
            if (!updatedPlanner) {
                throw new Error('Planner not found after update');
            }

            // Update cache
            await this.cacheService.set(
                `planner:${plannerId}`,
                updatedPlanner,
                config.cache.ttl.planner
            );

            // Invalidate related caches
            await this.invalidateRelatedCaches(plannerId);

            logger.info(`Planner updated: ${plannerId}`);
            return updatedPlanner;

        } catch (error) {
            logger.error(`Update planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Delete planner
     */
    async deletePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            // Delete document
            await this.collection.doc(plannerId).delete();

            // Remove from cache
            await this.cacheService.delete(`planner:${plannerId}`);

            // Update user's planner list
            await this.updateUserPlanners(userId, plannerId, 'remove');

            // Delete all related sections and activities
            await this.deletePlannerContents(plannerId);

            // Invalidate related caches
            await this.invalidateRelatedCaches(plannerId);

            logger.info(`Planner deleted: ${plannerId}`);

        } catch (error) {
            logger.error(`Delete planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Add collaborator
     */
    async addCollaborator(plannerId: string, collaborator: Collaborator): Promise<void> {
        try {
            const planner = await this.findById(plannerId);
            if (!planner) {
                throw new Error('Planner not found');
            }

            // Check if collaborator already exists
            const existingIndex = planner.collaborators.findIndex(
                c => c.userId === collaborator.userId
            );

            if (existingIndex >= 0) {
                // Update existing collaborator
                planner.collaborators[existingIndex] = collaborator;
            } else {
                // Add new collaborator
                planner.collaborators.push(collaborator);
            }

            // Update planner
            await this.updatePlanner(plannerId, {
                collaborators: planner.collaborators
            });

            logger.info(`Collaborator added to planner ${plannerId}: ${collaborator.userId}`);

        } catch (error) {
            logger.error(`Add collaborator failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Remove collaborator
     */
    async removeCollaborator(plannerId: string, userId: string): Promise<void> {
        try {
            const planner = await this.findById(plannerId);
            if (!planner) {
                throw new Error('Planner not found');
            }

            // Remove collaborator
            planner.collaborators = planner.collaborators.filter(
                c => c.userId !== userId
            );

            // Update planner
            await this.updatePlanner(plannerId, {
                collaborators: planner.collaborators
            });

            logger.info(`Collaborator removed from planner ${plannerId}: ${userId}`);

        } catch (error) {
            logger.error(`Remove collaborator failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Archive planner
     */
    async archivePlanner(plannerId: string): Promise<void> {
        try {
            await this.updatePlanner(plannerId, {
                archivedAt: new Date()
            });

            logger.info(`Planner archived: ${plannerId}`);

        } catch (error) {
            logger.error(`Archive planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Unarchive planner
     */
    async unarchivePlanner(plannerId: string): Promise<void> {
        try {
            await this.updatePlanner(plannerId, {
                archivedAt: null
            });

            logger.info(`Planner unarchived: ${plannerId}`);

        } catch (error) {
            logger.error(`Unarchive planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get planner statistics
     */
    async getPlannerStatistics(plannerId: string): Promise<any> {
        try {
            // This would typically aggregate data from sections and activities
            // For now, returning placeholder statistics
            const sections = await this.getSections(plannerId);

            let totalActivities = 0;
            let completedActivities = 0;
            let pendingActivities = 0;
            let overdueActivities = 0;
            const activitiesByPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
            const activitiesByStatus = {
                pending: 0,
                'in-progress': 0,
                completed: 0,
                cancelled: 0,
                archived: 0
            };

            for (const section of sections) {
                const activities = await this.getActivities(section.id);
                totalActivities += activities.length;

                for (const activity of activities) {
                    activitiesByPriority[activity.priority]++;
                    activitiesByStatus[activity.status]++;

                    if (activity.status === 'completed') {
                        completedActivities++;
                    } else if (activity.status === 'pending' || activity.status === 'in-progress') {
                        pendingActivities++;

                        // Check if overdue
                        if (activity.dueDate && activity.dueDate < new Date()) {
                            overdueActivities++;
                        }
                    }
                }
            }

            return {
                totalSections: sections.length,
                totalActivities,
                completedActivities,
                pendingActivities,
                overdueActivities,
                activitiesByPriority,
                activitiesByStatus
            };

        } catch (error) {
            logger.error(`Get planner statistics failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get sections for planner
     */
    private async getSections(plannerId: string): Promise<Section[]> {
        try {
            const snapshot = await this.db.collection('sections')
                .where('plannerId', '==', plannerId)
                .orderBy('order', 'asc')
                .get();

            const sections: Section[] = [];
            snapshot.forEach((doc) => {
                sections.push(doc.data() as Section);
            });

            return sections;

        } catch (error) {
            logger.error(`Get sections failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get activities for section
     */
    private async getActivities(sectionId: string): Promise<Activity[]> {
        try {
            const snapshot = await this.db.collection('activities')
                .where('sectionId', '==', sectionId)
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Get activities failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Update user's planner list
     */
    private async updateUserPlanners(userId: string, plannerId: string, action: 'add' | 'remove'): Promise<void> {
        try {
            const userRef = this.db.collection('users').doc(userId);

            if (action === 'add') {
                await userRef.update({
                    'statistics.totalPlanners': this.db.FieldValue.increment(1),
                    updatedAt: new Date()
                });
            } else {
                await userRef.update({
                    'statistics.totalPlanners': this.db.FieldValue.increment(-1),
                    updatedAt: new Date()
                });
            }

        } catch (error) {
            logger.error(`Update user planners failed: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Delete planner contents (sections and activities)
     */
    private async deletePlannerContents(plannerId: string): Promise<void> {
        try {
            // Delete sections
            const sectionsSnapshot = await this.db.collection('sections')
                .where('plannerId', '==', plannerId)
                .get();

            const batch = this.db.batch();

            sectionsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Delete activities
            const activitiesSnapshot = await this.db.collection('activities')
                .where('plannerId', '==', plannerId)
                .get();

            activitiesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();

        } catch (error) {
            logger.error(`Delete planner contents failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Invalidate related caches
     */
    private async invalidateRelatedCaches(plannerId: string): Promise<void> {
        try {
            // Invalidate user planners cache
            const planner = await this.findById(plannerId);
            if (planner) {
                await this.cacheService.delete(`user-planners:${planner.userId}`);
            }

            // Invalidate shared planners caches for collaborators
            for (const collaborator of planner.collaborators) {
                await this.cacheService.delete(`shared-planners:${collaborator.userId}`);
            }

        } catch (error) {
            logger.error(`Invalidate caches failed: ${plannerId}`, error);
            // Don't throw - cache invalidation failure shouldn't break the main flow
        }
    }
}