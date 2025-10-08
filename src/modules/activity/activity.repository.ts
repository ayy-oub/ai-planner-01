// src/modules/activity/activity.repository.ts
import { injectable } from 'tsyringe';
import { FirebaseRepository } from '../../shared/repository/firebase.repository';
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
    ActivityComment,
    ActivityHistory
} from './activity.types';
import { logger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

@injectable()
export class ActivityRepository extends FirebaseRepository<Activity> {
    constructor(cacheService: CacheService) {
        super('activities', cacheService);
    }

    /**
     * Create activity
     */
    async createActivity(activity: Activity): Promise<Activity> {
        try {
            const docRef = this.collection.doc(activity.id);
            await docRef.set({
                ...activity,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Cache the activity
            await this.cacheService.set(
                `activity:${activity.id}`,
                activity,
                config.cache.ttl.activity
            );

            // Update section's activity list cache
            await this.cacheService.delete(`section-activities:${activity.sectionId}`);

            logger.info(`Activity created: ${activity.id}`);
            return activity;

        } catch (error) {
            logger.error('Create activity failed:', error);
            throw error;
        }
    }

    /**
     * Find activity by ID
     */
    async findById(activityId: string): Promise<Activity | null> {
        try {
            // Check cache first
            const cached = await this.cacheService.get<Activity>(`activity:${activityId}`);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const doc = await this.collection.doc(activityId).get();
            if (!doc.exists) {
                return null;
            }

            const activity = doc.data() as Activity;

            // Cache the result
            await this.cacheService.set(
                `activity:${activityId}`,
                activity,
                config.cache.ttl.activity
            );

            return activity;

        } catch (error) {
            logger.error(`Find activity by ID failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Find activities by section ID
     */
    async findBySectionId(sectionId: string): Promise<Activity[]> {
        try {
            // Check cache first
            const cacheKey = `section-activities:${sectionId}`;
            const cached = await this.cacheService.get<Activity[]>(cacheKey);
            if (cached) {
                return cached;
            }

            // Fetch from database
            const snapshot = await this.collection
                .where('sectionId', '==', sectionId)
                .orderBy('order', 'asc')
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            // Cache the result
            await this.cacheService.set(
                cacheKey,
                activities,
                config.cache.ttl.activityList
            );

            return activities;

        } catch (error) {
            logger.error(`Find activities by section ID failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Find activities by planner ID
     */
    async findByPlannerId(plannerId: string): Promise<Activity[]> {
        try {
            const snapshot = await this.collection
                .where('plannerId', '==', plannerId)
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Find activities by planner ID failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Find activities by IDs
     */
    async findByIds(activityIds: string[]): Promise<Activity[]> {
        try {
            if (activityIds.length === 0) {
                return [];
            }

            // Fetch from database
            const snapshot = await this.collection
                .where('__name__', 'in', activityIds)
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Find activities by IDs failed: ${activityIds.join(', ')}`, error);
            throw error;
        }
    }

    /**
     * Find activities with filters
     */
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
                limit = 20
            } = filters;

            const offset = (page - 1) * limit;

            // Build query
            let query: any = this.collection;

            // Apply filters
            if (sectionId) {
                query = query.where('sectionId', '==', sectionId);
            }

            if (plannerId) {
                query = query.where('plannerId', '==', plannerId);
            }

            if (status && status.length > 0) {
                query = query.where('status', 'in', status);
            }

            if (priority && priority.length > 0) {
                query = query.where('priority', 'in', priority);
            }

            if (type && type.length > 0) {
                query = query.where('type', 'in', type);
            }

            if (tags && tags.length > 0) {
                query = query.where('tags', 'array-contains-any', tags);
            }

            if (assignee && assignee.length > 0) {
                query = query.where('assignee', 'in', assignee);
            }

            if (dueDateFrom) {
                query = query.where('dueDate', '>=', dueDateFrom);
            }

            if (dueDateTo) {
                query = query.where('dueDate', '<=', dueDateTo);
            }

            if (completedFrom) {
                query = query.where('completedAt', '>=', completedFrom);
            }

            if (completedTo) {
                query = query.where('completedAt', '<=', completedTo);
            }

            if (search) {
                // For text search, we need to use a different approach
                // This is a simplified version - in production, consider using Algolia or Elasticsearch
                query = query.where('title', '>=', search).where('title', '<=', search + '\uf8ff');
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
            const activities: Activity[] = [];

            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return {
                activities,
                total,
                page,
                limit,
                hasNext: offset + limit < total,
                hasPrev: page > 1,
                filters
            };

        } catch (error) {
            logger.error('Find activities with filters failed:', error);
            throw error;
        }
    }

    /**
     * Update activity
     */
    async updateActivity(activityId: string, updates: Partial<Activity>): Promise<Activity> {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };

            // Update document
            await this.collection.doc(activityId).update(updateData);

            // Get updated activity
            const updatedActivity = await this.findById(activityId);
            if (!updatedActivity) {
                throw new Error('Activity not found after update');
            }

            // Update cache
            await this.cacheService.set(
                `activity:${activityId}`,
                updatedActivity,
                config.cache.ttl.activity
            );

            // Invalidate related caches
            await this.cacheService.delete(`section-activities:${updatedActivity.sectionId}`);
            await this.cacheService.delete(`section-stats:${updatedActivity.sectionId}`);

            logger.info(`Activity updated: ${activityId}`);
            return updatedActivity;

        } catch (error) {
            logger.error(`Update activity failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Bulk update activities
     */
    async bulkUpdate(activityIds: string[], updates: Partial<Activity>): Promise<void> {
        try {
            const batch = this.db.batch();
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };

            for (const activityId of activityIds) {
                const docRef = this.collection.doc(activityId);
                batch.update(docRef, updateData);
            }

            await batch.commit();

            // Invalidate caches
            for (const activityId of activityIds) {
                await this.cacheService.delete(`activity:${activityId}`);

                // Get activity to find section ID
                const activity = await this.findById(activityId);
                if (activity) {
                    await this.cacheService.delete(`section-activities:${activity.sectionId}`);
                    await this.cacheService.delete(`section-stats:${activity.sectionId}`);
                }
            }

            logger.info(`Bulk update completed: ${activityIds.length} activities`);

        } catch (error) {
            logger.error('Bulk update activities failed:', error);
            throw error;
        }
    }

    /**
     * Delete activity
     */
    async deleteActivity(activityId: string): Promise<void> {
        try {
            // Get activity first to know which caches to invalidate
            const activity = await this.findById(activityId);

            // Delete document
            await this.collection.doc(activityId).delete();

            // Remove from cache
            await this.cacheService.delete(`activity:${activityId}`);

            // Update related caches
            if (activity) {
                await this.cacheService.delete(`section-activities:${activity.sectionId}`);
                await this.cacheService.delete(`section-stats:${activity.sectionId}`);
            }

            logger.info(`Activity deleted: ${activityId}`);

        } catch (error) {
            logger.error(`Delete activity failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Bulk delete activities
     */
    async bulkDelete(activityIds: string[]): Promise<void> {
        try {
            const batch = this.db.batch();

            for (const activityId of activityIds) {
                const docRef = this.collection.doc(activityId);
                batch.delete(docRef);
            }

            await batch.commit();

            // Invalidate caches
            const sectionIds = new Set<string>();

            for (const activityId of activityIds) {
                await this.cacheService.delete(`activity:${activityId}`);

                // Get activity to find section ID
                const activity = await this.findById(activityId);
                if (activity) {
                    sectionIds.add(activity.sectionId);
                }
            }

            // Invalidate section caches
            for (const sectionId of sectionIds) {
                await this.cacheService.delete(`section-activities:${sectionId}`);
                await this.cacheService.delete(`section-stats:${sectionId}`);
            }

            logger.info(`Bulk delete completed: ${activityIds.length} activities`);

        } catch (error) {
            logger.error('Bulk delete activities failed:', error);
            throw error;
        }
    }

    /**
     * Reorder activities
     */
    async reorderActivities(reorderData: Array<{ id: string; order: number }>): Promise<void> {
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

            // Invalidate caches for affected activities
            const sectionIds = new Set<string>();

            for (const item of reorderData) {
                await this.cacheService.delete(`activity:${item.id}`);

                // Get activity to find section ID
                const activity = await this.findById(item.id);
                if (activity) {
                    sectionIds.add(activity.sectionId);
                }
            }

            // Invalidate section caches
            for (const sectionId of sectionIds) {
                await this.cacheService.delete(`section-activities:${sectionId}`);
            }

            logger.info(`Activities reordered: ${reorderData.length} activities`);

        } catch (error) {
            logger.error('Reorder activities failed:', error);
            throw error;
        }
    }

    /**
     * Delete activities by section ID
     */
    async deleteBySectionId(sectionId: string): Promise<void> {
        try {
            const snapshot = await this.collection
                .where('sectionId', '==', sectionId)
                .get();

            const batch = this.db.batch();
            const activityIds: string[] = [];

            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
                activityIds.push(doc.id);
            });

            await batch.commit();

            // Invalidate caches
            for (const activityId of activityIds) {
                await this.cacheService.delete(`activity:${activityId}`);
            }
            await this.cacheService.delete(`section-activities:${sectionId}`);

            logger.info(`Activities deleted for section: ${sectionId}`);

        } catch (error) {
            logger.error(`Delete activities by section ID failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Get activity statistics
     */
    async getActivityStatistics(filters: ActivityFilterRequest): Promise<ActivityStatistics> {
        try {
            const activities = await this.findWithFilters({
                ...filters,
                page: 1,
                limit: 10000 // Get all activities for statistics
            });

            const { activities: activityList } = activities;

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
                archived: 0
            };

            const activitiesByPriority: Record<ActivityPriority, number> = {
                low: 0,
                medium: 0,
                high: 0,
                urgent: 0
            };

            const activitiesByType: Record<ActivityType, number> = {
                task: 0,
                event: 0,
                note: 0,
                goal: 0,
                habit: 0,
                milestone: 0
            };

            const now = new Date();

            for (const activity of activityList) {
                // Count by status
                activitiesByStatus[activity.status]++;

                // Count by priority
                if (activity.priority) {
                    activitiesByPriority[activity.priority]++;
                }

                // Count by type
                if (activity.type) {
                    activitiesByType[activity.type]++;
                }

                // Count completed
                if (activity.status === 'completed') {
                    completedCount++;
                    if (activity.metadata?.actualDuration) {
                        totalTimeSpent += activity.metadata.actualDuration;
                    }
                    if (activity.metadata?.estimatedDuration && activity.metadata?.actualDuration) {
                        completionTimes.push(activity.metadata.actualDuration);
                    }
                }

                // Count overdue
                if (activity.dueDate && activity.dueDate < now &&
                    (activity.status === 'pending' || activity.status === 'in-progress')) {
                    overdueCount++;
                }

                // Count upcoming (due within next 7 days)
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                if (activity.dueDate && activity.dueDate > now && activity.dueDate <= sevenDaysFromNow &&
                    (activity.status === 'pending' || activity.status === 'in-progress')) {
                    upcomingCount++;
                }
            }

            const completionRate = activityList.length > 0 ? (completedCount / activityList.length) * 100 : 0;
            const averageCompletionTime = completionTimes.length > 0
                ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
                : undefined;

            return {
                completionRate,
                averageCompletionTime,
                totalTimeSpent: totalTimeSpent > 0 ? totalTimeSpent : undefined,
                overdueCount,
                upcomingCount,
                activitiesByStatus,
                activitiesByPriority,
                activitiesByType
            };

        } catch (error) {
            logger.error('Get activity statistics failed:', error);
            throw error;
        }
    }

    /**
     * Get activities due soon
     */
    async getDueSoon(userId: string, daysAhead: number = 7): Promise<Activity[]> {
        try {
            const now = new Date();
            const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

            const snapshot = await this.collection
                .where('assignee', '==', userId)
                .where('dueDate', '>=', now)
                .where('dueDate', '<=', futureDate)
                .where('status', 'in', ['pending', 'in-progress'])
                .orderBy('dueDate', 'asc')
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Get due soon activities failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Get overdue activities
     */
    async getOverdue(userId: string): Promise<Activity[]> {
        try {
            const now = new Date();

            const snapshot = await this.collection
                .where('assignee', '==', userId)
                .where('dueDate', '<', now)
                .where('status', 'in', ['pending', 'in-progress'])
                .orderBy('dueDate', 'asc')
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Get overdue activities failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Search activities
     */
    async searchActivities(userId: string, query: string, limit: number = 20): Promise<Activity[]> {
        try {
            // This is a simplified implementation
            // In production, consider using Algolia or Elasticsearch for full-text search
            const snapshot = await this.collection
                .where('createdBy', '==', userId)
                .where('title', '>=', query)
                .where('title', '<=', query + '\uf8ff')
                .limit(limit)
                .get();

            const activities: Activity[] = [];
            snapshot.forEach((doc) => {
                activities.push(doc.data() as Activity);
            });

            return activities;

        } catch (error) {
            logger.error(`Search activities failed for user: ${userId}, query: ${query}`, error);
            throw error;
        }
    }
}