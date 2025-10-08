// src/modules/activity/activity.service.ts
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { ActivityRepository } from './activity.repository';
import { SectionRepository } from '../section/section.repository';
import { PlannerRepository } from '../planner/planner.repository';
import { UserRepository } from '../user/user.repository';
import { CacheService } from '../../shared/services/cache.service';
import { QueueService } from '../../shared/services/queue.service';
import { EmailService } from '../../shared/services/email.service';
import { AIService } from '../ai/ai.service';
import { AuditService } from '../../shared/services/audit.service';
import {
    Activity,
    CreateActivityRequest,
    UpdateActivityRequest,
    ActivityFilterRequest,
    ActivityResponse,
    ActivityStatistics,
    AIActivityAnalysis,
    ActivityInsights,
    TimeEntry,
    TimeTrackingSummary
} from './activity.types';
import {
    BadRequestError,
    NotFoundError,
    ForbiddenError
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

@injectable()
export class ActivityService {
    constructor(
        @inject('ActivityRepository') private activityRepository: ActivityRepository,
        @inject('SectionRepository') private sectionRepository: SectionRepository,
        @inject('PlannerRepository') private plannerRepository: PlannerRepository,
        @inject('UserRepository') private userRepository: UserRepository,
        @inject('CacheService') private cacheService: CacheService,
        @inject('QueueService') private queueService: QueueService,
        @inject('EmailService') private emailService: EmailService,
        @inject('AIService') private aiService: AIService,
        @inject('AuditService') private auditService: AuditService
    ) { }

    /**
     * Create new activity
     */
    async createActivity(sectionId: string, userId: string, data: CreateActivityRequest): Promise<ActivityResponse> {
        try {
            // Verify section exists and user has access
            const section = await this.sectionRepository.findById(sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Check activity limits based on user plan
            await this.checkActivityLimits(sectionId);

            // Validate dependencies
            if (data.dependencies && data.dependencies.length > 0) {
                await this.validateDependencies(data.dependencies, sectionId);
            }

            // Create activity
            const activity: Activity = {
                id: uuidv4(),
                sectionId,
                plannerId: section.plannerId,
                title: data.title,
                description: data.description,
                type: data.type || 'task',
                status: data.status || 'pending',
                priority: data.priority || 'medium',
                dueDate: data.dueDate,
                completedAt: data.status === 'completed' ? new Date() : undefined,
                tags: data.tags || [],
                attachments: [],
                aiSuggestions: [],
                metadata: {
                    estimatedDuration: data.metadata?.estimatedDuration,
                    difficulty: data.metadata?.difficulty,
                    energyLevel: data.metadata?.energyLevel,
                    location: data.metadata?.location,
                    cost: data.metadata?.cost,
                    customFields: data.metadata?.customFields
                },
                recurring: data.recurring,
                assignee: data.assignee,
                dependencies: data.dependencies || [],
                reminders: data.reminders || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userId
            };

            // Set default order (max + 1)
            const maxOrder = await this.activityRepository.getMaxOrder(sectionId);
            (activity as any).order = maxOrder !== null ? maxOrder + 1 : 0;

            // Save activity
            const createdActivity = await this.activityRepository.createActivity(activity);

            // Update section statistics
            await this.updateSectionStatistics(sectionId);

            // Queue AI analysis for suggestions
            if (config.ai.enabled) {
                await this.queueService.addJob('analyzeActivity', {
                    activityId: activity.id,
                    userId
                });
            }

            // Schedule reminders
            if (data.reminders && data.reminders.length > 0) {
                await this.scheduleReminders(activity);
            }

            // Handle recurring activities
            if (data.recurring) {
                await this.handleRecurringActivity(activity);
            }

            // Log activity
            await this.logActivity(userId, 'ACTIVITY_CREATED', {
                sectionId,
                activityId: activity.id,
                title: activity.title,
                type: activity.type
            });

            // Send notifications
            if (data.assignee && data.assignee !== userId) {
                await this.notifyAssignee(activity, data.assignee);
            }

            logger.info(`Activity created: ${activity.id} by user: ${userId}`);

            return await this.buildActivityResponse(createdActivity);

        } catch (error) {
            logger.error('Create activity failed:', error);
            throw error;
        }
    }

    /**
     * Get activity by ID
     */
    async getActivity(activityId: string, userId: string): Promise<ActivityResponse> {
        try {
            // Get activity
            const activity = await this.activityRepository.findById(activityId);
            if (!activity) {
                throw new NotFoundError('Activity not found');
            }

            // Verify access
            const section = await this.sectionRepository.findById(activity.sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this activity');
            }

            return await this.buildActivityResponse(activity);

        } catch (error) {
            logger.error(`Get activity failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * List activities with filters
     */
    async listActivities(filters: ActivityFilterRequest, userId: string): Promise<ActivityListResponse> {
        try {
            // If filtering by section, verify access
            if (filters.sectionId) {
                const section = await this.sectionRepository.findById(filters.sectionId);
                if (!section) {
                    throw new NotFoundError('Section not found');
                }

                const planner = await this.plannerRepository.findById(section.plannerId);
                if (!planner || !this.hasAccess(planner, userId)) {
                    throw new ForbiddenError('Access denied to this section');
                }
            }

            // If filtering by planner, verify access
            if (filters.plannerId) {
                const planner = await this.plannerRepository.findById(filters.plannerId);
                if (!planner || !this.hasAccess(planner, userId)) {
                    throw new ForbiddenError('Access denied to this planner');
                }
            }

            return await this.activityRepository.findWithFilters(filters);

        } catch (error) {
            logger.error('List activities failed:', error);
            throw error;
        }
    }

    /**
     * Update activity
     */
    async updateActivity(activityId: string, userId: string, data: UpdateActivityRequest): Promise<ActivityResponse> {
        try {
            // Get existing activity
            const existingActivity = await this.activityRepository.findById(activityId);
            if (!existingActivity) {
                throw new NotFoundError('Activity not found');
            }

            // Verify access
            const section = await this.sectionRepository.findById(existingActivity.sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to edit this activity');
            }

            // Validate dependencies
            if (data.dependencies && data.dependencies.length > 0) {
                await this.validateDependencies(data.dependencies, existingActivity.sectionId, activityId);
            }

            // Handle status change to completed
            let completedAt = existingActivity.completedAt;
            if (data.status === 'completed' && existingActivity.status !== 'completed') {
                completedAt = new Date();

                // Update actual duration if not set
                if (!data.metadata?.actualDuration && existingActivity.metadata.estimatedDuration) {
                    if (!data.metadata) data.metadata = {};
                    data.metadata.actualDuration = existingActivity.metadata.estimatedDuration;
                }
            } else if (data.status && data.status !== 'completed') {
                completedAt = undefined;
            }

            // Update activity
            const updatedActivity = await this.activityRepository.updateActivity(activityId, {
                ...data,
                completedAt,
                updatedAt: new Date()
            });

            // Update section statistics
            await this.updateSectionStatistics(existingActivity.sectionId);

            // Handle assignee change
            if (data.assignee && data.assignee !== existingActivity.assignee) {
                await this.handleAssigneeChange(updatedActivity, data.assignee, existingActivity.assignee);
            }

            // Log activity
            await this.logActivity(userId, 'ACTIVITY_UPDATED', {
                activityId,
                sectionId: existingActivity.sectionId,
                updatedFields: Object.keys(data)
            });

            logger.info(`Activity updated: ${activityId}`);

            return await this.buildActivityResponse(updatedActivity);

        } catch (error) {
            logger.error(`Update activity failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Delete activity
     */
    async deleteActivity(activityId: string, userId: string): Promise<void> {
        try {
            // Get existing activity
            const activity = await this.activityRepository.findById(activityId);
            if (!activity) {
                throw new NotFoundError('Activity not found');
            }

            // Verify access
            const section = await this.sectionRepository.findById(activity.sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to delete this activity');
            }

            // Delete activity
            await this.activityRepository.deleteActivity(activityId);

            // Update section statistics
            await this.updateSectionStatistics(activity.sectionId);

            // Log activity
            await this.logActivity(userId, 'ACTIVITY_DELETED', {
                activityId,
                sectionId: activity.sectionId,
                title: activity.title
            });

            logger.info(`Activity deleted: ${activityId}`);

        } catch (error) {
            logger.error(`Delete activity failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Bulk update activities
     */
    async bulkUpdateActivities(activityIds: string[], userId: string, updates: Partial<Activity>): Promise<void> {
        try {
            // Verify all activities exist and user has access
            const activities = await this.activityRepository.findByIds(activityIds);

            if (activities.length !== activityIds.length) {
                throw new BadRequestError('Some activities not found');
            }

            // Group activities by section to check permissions
            const sectionsById: Record<string, any> = {};

            for (const activity of activities) {
                if (!sectionsById[activity.sectionId]) {
                    const section = await this.sectionRepository.findById(activity.sectionId);
                    if (!section) {
                        throw new NotFoundError('Section not found');
                    }

                    const planner = await this.plannerRepository.findById(section.plannerId);
                    if (!planner || !this.canEdit(planner, userId)) {
                        throw new ForbiddenError('You do not have permission to edit some activities');
                    }

                    sectionsById[activity.sectionId] = section;
                }
            }

            // Perform bulk update
            await this.activityRepository.bulkUpdate(activityIds, updates);

            // Update section statistics for affected sections
            const affectedSectionIds = new Set(activities.map(a => a.sectionId));
            for (const sectionId of affectedSectionIds) {
                await this.updateSectionStatistics(sectionId);
            }

            // Log activity
            await this.logActivity(userId, 'ACTIVITIES_BULK_UPDATED', {
                activityIds,
                updatedFields: Object.keys(updates)
            });

            logger.info(`Bulk update completed: ${activityIds.length} activities`);

        } catch (error) {
            logger.error('Bulk update activities failed:', error);
            throw error;
        }
    }

    /**
     * Bulk delete activities
     */
    async bulkDeleteActivities(activityIds: string[], userId: string): Promise<void> {
        try {
            // Verify all activities exist and user has access
            const activities = await this.activityRepository.findByIds(activityIds);

            if (activities.length !== activityIds.length) {
                throw new BadRequestError('Some activities not found');
            }

            // Group activities by section to check permissions
            const sectionsById: Record<string, any> = {};

            for (const activity of activities) {
                if (!sectionsById[activity.sectionId]) {
                    const section = await this.sectionRepository.findById(activity.sectionId);
                    if (!section) {
                        throw new NotFoundError('Section not found');
                    }

                    const planner = await this.plannerRepository.findById(section.plannerId);
                    if (!planner || !this.canEdit(planner, userId)) {
                        throw new ForbiddenError('You do not have permission to delete some activities');
                    }

                    sectionsById[activity.sectionId] = section;
                }
            }

            // Perform bulk delete
            await this.activityRepository.bulkDelete(activityIds);

            // Update section statistics for affected sections
            const affectedSectionIds = new Set(activities.map(a => a.sectionId));
            for (const sectionId of affectedSectionIds) {
                await this.updateSectionStatistics(sectionId);
            }

            // Log activity
            await this.logActivity(userId, 'ACTIVITIES_BULK_DELETED', {
                activityIds,
                count: activityIds.length
            });

            logger.info(`Bulk delete completed: ${activityIds.length} activities`);

        } catch (error) {
            logger.error('Bulk delete activities failed:', error);
            throw error;
        }
    }

    /**
     * Reorder activities
     */
    async reorderActivities(sectionId: string, userId: string, reorderData: Array<{ id: string; order: number }>): Promise<void> {
        try {
            // Verify section access
            const section = await this.sectionRepository.findById(sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to reorder activities');
            }

            // Validate all activities exist and belong to this section
            const activityIds = reorderData.map(a => a.id);
            const activities = await this.activityRepository.findByIds(activityIds);

            if (activities.length !== activityIds.length) {
                throw new BadRequestError('Some activities not found');
            }

            for (const activity of activities) {
                if (activity.sectionId !== sectionId) {
                    throw new BadRequestError(`Activity ${activity.id} does not belong to this section`);
                }
            }

            // Perform reorder
            await this.activityRepository.reorderActivities(reorderData);

            // Log activity
            await this.logActivity(userId, 'ACTIVITIES_REORDERED', {
                sectionId,
                activityCount: reorderData.length
            });

            logger.info(`Activities reordered for section: ${sectionId}`);

        } catch (error) {
            logger.error(`Reorder activities failed for section: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Get activity statistics
     */
    async getActivityStatistics(filters: ActivityFilterRequest): Promise<ActivityStatistics> {
        try {
            return await this.activityRepository.getActivityStatistics(filters);
        } catch (error) {
            logger.error('Get activity statistics failed:', error);
            throw error;
        }
    }

    /**
     * Get AI analysis for activity
     */
    async getAIAnalysis(activityId: string, userId: string): Promise<AIActivityAnalysis> {
        try {
            // Get activity
            const activity = await this.activityRepository.findById(activityId);
            if (!activity) {
                throw new NotFoundError('Activity not found');
            }

            // Verify access
            const section = await this.sectionRepository.findById(activity.sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this activity');
            }

            // Get AI analysis
            const analysis = await this.aiService.analyzeActivity(activity);

            // Log activity
            await this.logActivity(userId, 'AI_ANALYSIS_REQUESTED', {
                activityId,
                analysisType: 'activity'
            });

            return analysis;

        } catch (error) {
            logger.error(`Get AI analysis failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Get activity insights
     */
    async getActivityInsights(userId: string): Promise<ActivityInsights> {
        try {
            // Get user's recent activities
            const filters: ActivityFilterRequest = {
                createdBy: userId,
                createdFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                page: 1,
                limit: 1000
            };

            const activities = await this.activityRepository.findWithFilters(filters);

            // Get insights from AI service
            const insights = await this.aiService.generateActivityInsights(activities.activities);

            // Log activity
            await this.logActivity(userId, 'ACTIVITY_INSIGHTS_REQUESTED', {});

            return insights;

        } catch (error) {
            logger.error(`Get activity insights failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Get activities due soon
     */
    async getDueSoon(userId: string, daysAhead: number = 7): Promise<ActivityResponse[]> {
        try {
            const activities = await this.activityRepository.getDueSoon(userId, daysAhead);

            return Promise.all(
                activities.map(activity => this.buildActivityResponse(activity))
            );

        } catch (error) {
            logger.error(`Get due soon activities failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Get overdue activities
     */
    async getOverdue(userId: string): Promise<ActivityResponse[]> {
        try {
            const activities = await this.activityRepository.getOverdue(userId);

            return Promise.all(
                activities.map(activity => this.buildActivityResponse(activity))
            );

        } catch (error) {
            logger.error(`Get overdue activities failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Search activities
     */
    async searchActivities(userId: string, query: string, limit: number = 20): Promise<ActivityResponse[]> {
        try {
            const activities = await this.activityRepository.searchActivities(userId, query, limit);

            return Promise.all(
                activities.map(activity => this.buildActivityResponse(activity))
            );

        } catch (error) {
            logger.error(`Search activities failed for user: ${userId}, query: ${query}`, error);
            throw error;
        }
    }

    // Time Tracking Methods
    /**
     * Start time tracking for activity
     */
    async startTimeTracking(activityId: string, userId: string): Promise<TimeEntry> {
        try {
            // Get activity
            const activity = await this.activityRepository.findById(activityId);
            if (!activity) {
                throw new NotFoundError('Activity not found');
            }

            // Verify access
            const section = await this.sectionRepository.findById(activity.sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to track time for this activity');
            }

            // Check if there's already an active time entry
            const activeEntry = await this.getActiveTimeEntry(userId);
            if (activeEntry) {
                throw new BadRequestError('You already have an active time tracking session');
            }

            // Create time entry
            const timeEntry: TimeEntry = {
                id: uuidv4(),
                activityId,
                startTime: new Date(),
                isActive: true,
                createdAt: new Date()
            };

            // Save time entry
            await this.saveTimeEntry(timeEntry);

            // Update activity status to in-progress
            if (activity.status === 'pending') {
                await this.activityRepository.updateActivity(activityId, {
                    status: 'in-progress',
                    updatedAt: new Date()
                });
            }

            // Log activity
            await this.logActivity(userId, 'TIME_TRACKING_STARTED', {
                activityId,
                timeEntryId: timeEntry.id
            });

            logger.info(`Time tracking started for activity: ${activityId}`);

            return timeEntry;

        } catch (error) {
            logger.error(`Start time tracking failed: ${activityId}`, error);
            throw error;
        }
    }

    /**
     * Stop time tracking
     */
    async stopTimeTracking(timeEntryId: string, userId: string): Promise<TimeEntry> {
        try {
            // Get time entry
            const timeEntry = await this.getTimeEntry(timeEntryId);
            if (!timeEntry) {
                throw new NotFoundError('Time entry not found');
            }

            if (!timeEntry.isActive) {
                throw new BadRequestError('Time entry is not active');
            }

            // Verify ownership
            const activity = await this.activityRepository.findById(timeEntry.activityId);
            if (!activity) {
                throw new NotFoundError('Activity not found');
            }

            // Update time entry
            const endTime = new Date();
            const duration = Math.round((endTime.getTime() - timeEntry.startTime.getTime()) / (1000 * 60)); // minutes

            const updatedEntry: TimeEntry = {
                ...timeEntry,
                endTime,
                duration,
                isActive: false
            };

            await this.saveTimeEntry(updatedEntry);

            // Update activity's actual duration
            const currentDuration = activity.metadata?.actualDuration || 0;
            const newDuration = currentDuration + duration;

            await this.activityRepository.updateActivity(activity.id, {
                metadata: {
                    ...activity.metadata,
                    actualDuration: newDuration
                },
                updatedAt: new Date()
            });

            // Log activity
            await this.logActivity(userId, 'TIME_TRACKING_STOPPED', {
                activityId: activity.id,
                timeEntryId,
                duration
            });

            logger.info(`Time tracking stopped for activity: ${activity.id}, duration: ${duration} minutes`);

            return updatedEntry;

        } catch (error) {
            logger.error(`Stop time tracking failed: ${timeEntryId}`, error);
            throw error;
        }
    }

    /**
     * Get time tracking summary
     */
    async getTimeTrackingSummary(userId: string): Promise<TimeTrackingSummary> {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // Get time entries
            const entries = await this.getUserTimeEntries(userId);

            let todayTime = 0;
            let thisWeekTime = 0;
            let thisMonthTime = 0;
            const sessionDurations: number[] = [];

            for (const entry of entries) {
                if (entry.duration) {
                    // Today
                    if (entry.startTime >= todayStart) {
                        todayTime += entry.duration;
                    }

                    // This week
                    if (entry.startTime >= weekStart) {
                        thisWeekTime += entry.duration;
                    }

                    // This month
                    if (entry.startTime >= monthStart) {
                        thisMonthTime += entry.duration;
                    }

                    sessionDurations.push(entry.duration);
                }
            }

            const averageSessionDuration = sessionDurations.length > 0
                ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
                : 0;

            const activeEntries = entries.filter(e => e.isActive);

            return {
                totalTime: entries.reduce((sum, e) => sum + (e.duration || 0), 0),
                activeEntries,
                todayTime,
                thisWeekTime,
                thisMonthTime,
                averageSessionDuration
            };

        } catch (error) {
            logger.error(`Get time tracking summary failed for user: ${userId}`, error);
            throw error;
        }
    }

    // Helper methods
    private hasAccess(planner: any, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some((c: any) => c.userId === userId) ||
            planner.settings.isPublic;
    }

    private canEdit(planner: any, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some((c: any) => c.userId === userId &&
                (c.role === 'editor' || c.role === 'admin'));
    }

    private async checkActivityLimits(sectionId: string): Promise<void> {
        const count = await this.activityRepository.countBySectionId(sectionId);
        if (count >= 1000) { // Max 1000 activities per section
            throw new BadRequestError('Maximum number of activities reached for this section');
        }
    }

    private async validateDependencies(dependencyIds: string[], sectionId: string, excludeActivityId?: string): Promise<void> {
        const dependencies = await this.activityRepository.findByIds(dependencyIds);

        for (const dep of dependencies) {
            if (dep.sectionId !== sectionId) {
                throw new BadRequestError(`Dependency ${dep.id} is not in the same section`);
            }

            if (dep.id === excludeActivityId) {
                throw new BadRequestError('Activity cannot depend on itself');
            }

            if (dep.status === 'completed') {
                throw new BadRequestError(`Cannot depend on completed activity ${dep.id}`);
            }
        }
    }

    private async updateSectionStatistics(sectionId: string): Promise<void> {
        try {
            const statistics = await this.activityRepository.getSectionStatistics(sectionId);
            const section = await this.sectionRepository.findById(sectionId);

            if (section) {
                await this.sectionRepository.updateSection(sectionId, {
                    metadata: {
                        ...section.metadata,
                        totalActivities: statistics.totalActivities,
                        completedActivities: statistics.completedActivities,
                        lastActivityAt: new Date()
                    }
                });
            }
        } catch (error) {
            logger.error(`Update section statistics failed: ${sectionId}`, error);
            // Don't throw - this is a background operation
        }
    }

    private async buildActivityResponse(activity: Activity): Promise<ActivityResponse> {
        const response: ActivityResponse = {
            activity,
            statistics: await this.getActivityStatistics({
                sectionId: activity.sectionId,
                createdBy: activity.createdBy
            })
        };

        // Get dependencies if any
        if (activity.dependencies && activity.dependencies.length > 0) {
            response.dependencies = await this.activityRepository.findByIds(activity.dependencies);
        }

        // Get assignee info if assigned
        if (activity.assignee) {
            const assignee = await this.userRepository.findById(activity.assignee);
            if (assignee) {
                response.assigneeInfo = {
                    userId: assignee.uid,
                    displayName: assignee.displayName,
                    photoURL: assignee.photoURL
                };
            }
        }

        return response;
    }

    private async scheduleReminders(activity: Activity): Promise<void> {
        if (!activity.dueDate || !activity.reminders) return;

        for (const reminder of activity.reminders) {
            if (!reminder.isActive) continue;

            const reminderTime = new Date(activity.dueDate.getTime() - reminder.timeBefore * 60 * 1000);
            const now = new Date();

            if (reminderTime > now) {
                await this.queueService.scheduleJob(
                    `sendReminder:${activity.id}:${reminder.id}`,
                    reminderTime,
                    {
                        activityId: activity.id,
                        reminderId: reminder.id,
                        type: reminder.type,
                        userId: activity.createdBy
                    }
                );
            }
        }
    }

    private async handleRecurringActivity(activity: Activity): Promise<void> {
        if (!activity.recurring) return;

        // Schedule creation of next occurrence
        await this.queueService.addJob('createRecurringActivity', {
            activityId: activity.id,
            userId: activity.createdBy
        });
    }

    private async handleAssigneeChange(activity: Activity, newAssignee: string, oldAssignee?: string): Promise<void> {
        // Notify new assignee
        const newAssigneeUser = await this.userRepository.findById(newAssignee);
        if (newAssigneeUser) {
            await this.emailService.sendActivityAssignmentNotification(
                newAssigneeUser.email,
                newAssigneeUser.displayName,
                activity.title,
                activity.id
            );
        }

        // Notify old assignee if different
        if (oldAssignee && oldAssignee !== newAssignee) {
            const oldAssigneeUser = await this.userRepository.findById(oldAssignee);
            if (oldAssigneeUser) {
                await this.emailService.sendActivityUnassignmentNotification(
                    oldAssigneeUser.email,
                    oldAssigneeUser.displayName,
                    activity.title,
                    activity.id
                );
            }
        }
    }

    private async notifyAssignee(activity: Activity, assigneeId: string): Promise<void> {
        const assignee = await this.userRepository.findById(assigneeId);
        if (assignee) {
            await this.emailService.sendActivityAssignmentNotification(
                assignee.email,
                assignee.displayName,
                activity.title,
                activity.id
            );
        }
    }

    private async getActiveTimeEntry(userId: string): Promise<TimeEntry | null> {
        // This would typically query a time_entries collection
        // For now, returning null as placeholder
        return null;
    }

    private async getTimeEntry(timeEntryId: string): Promise<TimeEntry | null> {
        // This would typically query a time_entries collection
        // For now, returning null as placeholder
        return null;
    }

    private async saveTimeEntry(timeEntry: TimeEntry): Promise<void> {
        // This would typically save to a time_entries collection
        // For now, just logging
        logger.info(`Time entry saved: ${timeEntry.id}`);
    }

    private async getUserTimeEntries(userId: string): Promise<TimeEntry[]> {
        // This would typically query a time_entries collection
        // For now, returning empty array as placeholder
        return [];
    }

    private async logActivity(userId: string, action: string, metadata: any): Promise<void> {
        try {
            await this.auditService.logActivity({
                userId,
                action,
                metadata,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to log activity:', error);
            // Don't throw - logging failure shouldn't break the main flow
        }
    }
}