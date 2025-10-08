// src/modules/planner/planner.service.ts
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { PlannerRepository } from './planner.repository';
import { UserRepository } from '../user/user.repository';
import { SectionRepository } from '../section/section.repository';
import { ActivityRepository } from '../activity/activity.repository';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { QueueService } from '../../shared/services/queue.service';
import { AuditService } from '../../shared/services/audit.service';
import { AIService } from '../ai/ai.service';
import { ExportService } from '../export/export.service';
import {
    Planner,
    CreatePlannerRequest,
    UpdatePlannerRequest,
    PlannerFilterRequest,
    PlannerResponse,
    PlannerStatistics,
    UserPermissions,
    SharePlannerRequest,
    DuplicatePlannerRequest,
    ExportPlannerRequest,
    CollaboratorResponse
} from './planner.types';
import {
    BadRequestError,
    NotFoundError,
    ForbiddenError,
    UnauthorizedError
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

@injectable()
export class PlannerService {
    constructor(
        @inject('PlannerRepository') private plannerRepository: PlannerRepository,
        @inject('UserRepository') private userRepository: UserRepository,
        @inject('SectionRepository') private sectionRepository: SectionRepository,
        @inject('ActivityRepository') private activityRepository: ActivityRepository,
        @inject('CacheService') private cacheService: CacheService,
        @inject('EmailService') private emailService: EmailService,
        @inject('QueueService') private queueService: QueueService,
        @inject('AuditService') private auditService: AuditService,
        @inject('AIService') private aiService: AIService,
        @inject('ExportService') private exportService: ExportService
    ) { }

    /**
     * Create new planner
     */
    async createPlanner(userId: string, data: CreatePlannerRequest): Promise<PlannerResponse> {
        try {
            // Validate user exists
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            // Check user's plan limits
            await this.checkPlanLimits(userId);

            // Create planner
            const planner: Planner = {
                id: uuidv4(),
                userId,
                title: data.title,
                description: data.description || '',
                color: data.color || this.generateRandomColor(),
                icon: data.icon || 'default',
                sections: [],
                settings: {
                    isPublic: data.settings?.isPublic || false,
                    allowCollaboration: data.settings?.allowCollaboration || false,
                    autoArchive: data.settings?.autoArchive || false,
                    reminderEnabled: data.settings?.reminderEnabled || true,
                    defaultView: data.settings?.defaultView || 'grid',
                    theme: data.settings?.theme || 'auto'
                },
                collaborators: [],
                tags: data.tags || [],
                metadata: {
                    version: 1,
                    schemaVersion: '1.0',
                    lastActivityAt: new Date(),
                    totalActivities: 0,
                    completedActivities: 0
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save planner
            const createdPlanner = await this.plannerRepository.createPlanner(planner);

            // Create default sections if none specified
            if (data.sections && data.sections.length > 0) {
                for (const sectionData of data.sections) {
                    await this.sectionRepository.createSection({
                        ...sectionData,
                        plannerId: planner.id
                    });
                }
            } else {
                // Create default sections
                await this.createDefaultSections(planner.id);
            }

            // Log activity
            await this.logActivity(userId, 'PLANNER_CREATED', {
                plannerId: planner.id,
                title: planner.title
            });

            // Queue AI analysis for optimization suggestions
            await this.queueService.addJob('analyzePlannerStructure', {
                plannerId: planner.id,
                userId
            });

            logger.info(`Planner created: ${planner.id} by user: ${userId}`);

            return {
                planner: createdPlanner,
                statistics: await this.getPlannerStatistics(planner.id),
                permissions: this.getUserPermissions(createdPlanner, userId)
            };

        } catch (error) {
            logger.error('Create planner failed:', error);
            throw error;
        }
    }

    /**
     * Get planner by ID
     */
    async getPlanner(plannerId: string, userId: string): Promise<PlannerResponse> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Update last activity
            await this.plannerRepository.updatePlanner(plannerId, {
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'PLANNER_VIEWED', {
                plannerId
            });

            return {
                planner,
                statistics: await this.getPlannerStatistics(plannerId),
                permissions: this.getUserPermissions(planner, userId)
            };

        } catch (error) {
            logger.error(`Get planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * List user's planners
     */
    async listPlanners(userId: string, filters: PlannerFilterRequest): Promise<any> {
        try {
            // Get user's own planners
            const ownPlanners = await this.plannerRepository.findByUserId(userId, filters);

            // Get shared planners
            const sharedPlanners = await this.plannerRepository.findSharedPlanners(userId, filters);

            return {
                own: ownPlanners,
                shared: sharedPlanners
            };

        } catch (error) {
            logger.error(`List planners failed for user: ${userId}`, error);
            throw error;
        }
    }

    /**
     * Update planner
     */
    async updatePlanner(plannerId: string, userId: string, data: UpdatePlannerRequest): Promise<PlannerResponse> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to edit this planner');
            }

            // Update planner
            const updatedPlanner = await this.plannerRepository.updatePlanner(plannerId, {
                ...data,
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'PLANNER_UPDATED', {
                plannerId,
                updatedFields: Object.keys(data)
            });

            return {
                planner: updatedPlanner,
                statistics: await this.getPlannerStatistics(plannerId),
                permissions: this.getUserPermissions(updatedPlanner, userId)
            };

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
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions (only owner can delete)
            if (planner.userId !== userId) {
                throw new ForbiddenError('Only the owner can delete this planner');
            }

            // Delete planner
            await this.plannerRepository.deletePlanner(plannerId, userId);

            // Log activity
            await this.logActivity(userId, 'PLANNER_DELETED', {
                plannerId,
                title: planner.title
            });

            logger.info(`Planner deleted: ${plannerId} by user: ${userId}`);

        } catch (error) {
            logger.error(`Delete planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Share planner
     */
    async sharePlanner(plannerId: string, userId: string, data: SharePlannerRequest): Promise<void> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.canShare(planner, userId)) {
                throw new ForbiddenError('You do not have permission to share this planner');
            }

            // Find user to share with
            const targetUser = await this.userRepository.findByEmail(data.email);
            if (!targetUser) {
                throw new NotFoundError('User not found with this email');
            }

            // Check if already collaborator
            const existingCollaborator = planner.collaborators.find(
                c => c.userId === targetUser.uid
            );

            if (existingCollaborator) {
                throw new BadRequestError('User is already a collaborator');
            }

            // Add collaborator
            const collaborator = {
                userId: targetUser.uid,
                role: data.role,
                addedAt: new Date(),
                addedBy: userId
            };

            await this.plannerRepository.addCollaborator(plannerId, collaborator);

            // Send notification email
            await this.emailService.sendPlannerShareNotification(
                targetUser.email,
                targetUser.displayName,
                planner.title,
                data.role,
                data.message
            );

            // Log activity
            await this.logActivity(userId, 'PLANNER_SHARED', {
                plannerId,
                sharedWith: targetUser.uid,
                role: data.role
            });

            logger.info(`Planner ${plannerId} shared with ${targetUser.uid} as ${data.role}`);

        } catch (error) {
            logger.error(`Share planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Remove collaborator
     */
    async removeCollaborator(plannerId: string, userId: string, collaboratorId: string): Promise<void> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions (owner or admin can remove collaborators)
            if (!this.canManageCollaborators(planner, userId)) {
                throw new ForbiddenError('You do not have permission to manage collaborators');
            }

            // Remove collaborator
            await this.plannerRepository.removeCollaborator(plannerId, collaboratorId);

            // Log activity
            await this.logActivity(userId, 'COLLABORATOR_REMOVED', {
                plannerId,
                removedUserId: collaboratorId
            });

            logger.info(`Collaborator ${collaboratorId} removed from planner ${plannerId}`);

        } catch (error) {
            logger.error(`Remove collaborator failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Duplicate planner
     */
    async duplicatePlanner(plannerId: string, userId: string, data: DuplicatePlannerRequest): Promise<PlannerResponse> {
        try {
            // Get original planner
            const originalPlanner = await this.plannerRepository.findById(plannerId);
            if (!originalPlanner) {
                throw new NotFoundError('Original planner not found');
            }

            // Check permissions
            if (!this.hasAccess(originalPlanner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Create new planner
            const newPlanner: Planner = {
                ...originalPlanner,
                id: uuidv4(),
                userId,
                title: data.title || `${originalPlanner.title} (Copy)`,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                    ...originalPlanner.metadata,
                    lastActivityAt: new Date()
                }
            };

            // Save new planner
            const createdPlanner = await this.plannerRepository.createPlanner(newPlanner);

            // Duplicate sections and activities if requested
            if (data.includeSections !== false) {
                const sections = await this.sectionRepository.findByPlannerId(plannerId);

                for (const section of sections) {
                    const newSection = await this.sectionRepository.createSection({
                        ...section,
                        id: uuidv4(),
                        plannerId: newPlanner.id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    // Duplicate activities if requested
                    if (data.includeActivities !== false) {
                        const activities = await this.activityRepository.findBySectionId(section.id);

                        for (const activity of activities) {
                            await this.activityRepository.createActivity({
                                ...activity,
                                id: uuidv4(),
                                sectionId: newSection.id,
                                plannerId: newPlanner.id,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                        }
                    }
                }
            }

            // Log activity
            await this.logActivity(userId, 'PLANNER_DUPLICATED', {
                originalPlannerId: plannerId,
                newPlannerId: newPlanner.id
            });

            logger.info(`Planner duplicated: ${plannerId} -> ${newPlanner.id}`);

            return {
                planner: createdPlanner,
                statistics: await this.getPlannerStatistics(newPlanner.id),
                permissions: this.getUserPermissions(createdPlanner, userId)
            };

        } catch (error) {
            logger.error(`Duplicate planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Export planner
     */
    async exportPlanner(plannerId: string, userId: string, data: ExportPlannerRequest): Promise<any> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Get sections and activities
            const sections = data.includeSections && data.includeSections.length > 0
                ? await this.sectionRepository.findByIds(data.includeSections)
                : await this.sectionRepository.findByPlannerId(plannerId);

            const activities = data.includeActivities !== false
                ? await this.activityRepository.findByPlannerId(plannerId)
                : [];

            // Prepare export data
            const exportData = {
                planner: {
                    title: planner.title,
                    description: planner.description,
                    color: planner.color,
                    icon: planner.icon,
                    tags: planner.tags,
                    exportedAt: new Date()
                },
                sections: sections.map(section => ({
                    title: section.title,
                    description: section.description,
                    order: section.order,
                    type: section.type
                })),
                activities: activities.map(activity => ({
                    title: activity.title,
                    description: activity.description,
                    type: activity.type,
                    status: activity.status,
                    priority: activity.priority,
                    dueDate: activity.dueDate,
                    tags: activity.tags
                }))
            };

            // Generate export file
            const result = await this.exportService.generateExport(
                data.format,
                exportData,
                data.template
            );

            // Log activity
            await this.logActivity(userId, 'PLANNER_EXPORTED', {
                plannerId,
                format: data.format
            });

            logger.info(`Planner exported: ${plannerId} in ${data.format} format`);

            return result;

        } catch (error) {
            logger.error(`Export planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get planner statistics
     */
    async getPlannerStatistics(plannerId: string): Promise<PlannerStatistics> {
        try {
            return await this.plannerRepository.getPlannerStatistics(plannerId);
        } catch (error) {
            logger.error(`Get planner statistics failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get AI suggestions for planner
     */
    async getAISuggestions(plannerId: string, userId: string): Promise<any> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Get sections and activities
            const sections = await this.sectionRepository.findByPlannerId(plannerId);
            const activities = await this.activityRepository.findByPlannerId(plannerId);

            // Get AI suggestions
            const suggestions = await this.aiService.generatePlannerSuggestions({
                planner,
                sections,
                activities,
                userId
            });

            // Log activity
            await this.logActivity(userId, 'AI_SUGGESTIONS_REQUESTED', {
                plannerId
            });

            return suggestions;

        } catch (error) {
            logger.error(`Get AI suggestions failed: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Archive planner
     */
    async archivePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.canArchive(planner, userId)) {
                throw new ForbiddenError('You do not have permission to archive this planner');
            }

            // Archive planner
            await this.plannerRepository.archivePlanner(plannerId);

            // Log activity
            await this.logActivity(userId, 'PLANNER_ARCHIVED', {
                plannerId
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
    async unarchivePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            // Get planner
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            // Check permissions
            if (!this.canArchive(planner, userId)) {
                throw new ForbiddenError('You do not have permission to unarchive this planner');
            }

            // Unarchive planner
            await this.plannerRepository.unarchivePlanner(plannerId);

            // Log activity
            await this.logActivity(userId, 'PLANNER_UNARCHIVED', {
                plannerId
            });

            logger.info(`Planner unarchived: ${plannerId}`);

        } catch (error) {
            logger.error(`Unarchive planner failed: ${plannerId}`, error);
            throw error;
        }
    }

    // Helper methods
    private hasAccess(planner: Planner, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some(c => c.userId === userId) ||
            planner.settings.isPublic;
    }

    private canEdit(planner: Planner, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some(c => c.userId === userId &&
                (c.role === 'editor' || c.role === 'admin'));
    }

    private canShare(planner: Planner, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some(c => c.userId === userId && c.role === 'admin');
    }

    private canManageCollaborators(planner: Planner, userId: string): boolean {
        return planner.userId === userId ||
            planner.collaborators.some(c => c.userId === userId && c.role === 'admin');
    }

    private canArchive(planner: Planner, userId: string): boolean {
        return planner.userId === userId;
    }

    private getUserPermissions(planner: Planner, userId: string): UserPermissions {
        const isOwner = planner.userId === userId;
        const collaborator = planner.collaborators.find(c => c.userId === userId);

        let role: 'owner' | 'admin' | 'editor' | 'viewer' = 'viewer';
        let canEdit = false;
        let canDelete = false;
        let canShare = false;
        let canArchive = false;

        if (isOwner) {
            role = 'owner';
            canEdit = true;
            canDelete = true;
            canShare = true;
            canArchive = true;
        } else if (collaborator) {
            role = collaborator.role as any;
            canEdit = collaborator.role === 'editor' || collaborator.role === 'admin';
            canDelete = false;
            canShare = collaborator.role === 'admin';
            canArchive = false;
        }

        return {
            canEdit,
            canDelete,
            canShare,
            canArchive,
            role
        };
    }

    private async checkPlanLimits(userId: string): Promise<void> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const plan = user.subscription.plan;
        const currentPlanners = user.statistics.totalPlanners;

        const limits = {
            free: 3,
            premium: 50,
            enterprise: -1 // unlimited
        };

        const limit = limits[plan] || limits.free;
        if (limit !== -1 && currentPlanners >= limit) {
            throw new ForbiddenError(
                `You have reached the maximum number of planners for your ${plan} plan. Upgrade to create more planners.`
            );
        }
    }

    private async createDefaultSections(plannerId: string): Promise<void> {
        const defaultSections = [
            {
                title: 'To Do',
                description: 'Tasks that need to be done',
                order: 1,
                type: 'tasks' as const,
                settings: {
                    collapsed: false,
                    color: '#EF4444',
                    icon: 'list',
                    visibility: 'visible' as const
                }
            },
            {
                title: 'In Progress',
                description: 'Tasks currently being worked on',
                order: 2,
                type: 'tasks' as const,
                settings: {
                    collapsed: false,
                    color: '#F59E0B',
                    icon: 'clock',
                    visibility: 'visible' as const
                }
            },
            {
                title: 'Done',
                description: 'Completed tasks',
                order: 3,
                type: 'tasks' as const,
                settings: {
                    collapsed: false,
                    color: '#10B981',
                    icon: 'check',
                    visibility: 'visible' as const
                }
            }
        ];

        for (const sectionData of defaultSections) {
            await this.sectionRepository.createSection({
                ...sectionData,
                id: uuidv4(),
                plannerId
            });
        }
    }

    private generateRandomColor(): string {
        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
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