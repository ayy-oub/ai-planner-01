// src/modules/section/section.service.ts
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { SectionRepository } from './section.repository';
import { PlannerRepository } from '../planner/planner.repository';
import { ActivityRepository } from '../activity/activity.repository';
import { CacheService } from '../../shared/services/cache.service';
import { AuditService } from '../../shared/services/audit.service';
import {
    Section,
    CreateSectionRequest,
    UpdateSectionRequest,
    ReorderSectionRequest,
    SectionResponse,
    SectionStatistics
} from './section.types';
import {
    BadRequestError,
    NotFoundError,
    ForbiddenError
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

@injectable()
export class SectionService {
    constructor(
        @inject('SectionRepository') private sectionRepository: SectionRepository,
        @inject('PlannerRepository') private plannerRepository: PlannerRepository,
        @inject('ActivityRepository') private activityRepository: ActivityRepository,
        @inject('CacheService') private cacheService: CacheService,
        @inject('AuditService') private auditService: AuditService
    ) { }

    /**
     * Create new section
     */
    async createSection(plannerId: string, userId: string, data: CreateSectionRequest): Promise<SectionResponse> {
        try {
            // Verify planner exists and user has access
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Check section limits based on user plan
            await this.checkSectionLimits(plannerId);

            // Get current max order
            const maxOrder = await this.getMaxOrder(plannerId);

            // Create section
            const section: Section = {
                id: uuidv4(),
                plannerId,
                title: data.title,
                description: data.description || '',
                order: data.order ?? maxOrder + 1,
                type: data.type,
                activities: [],
                settings: {
                    collapsed: data.settings?.collapsed ?? false,
                    color: data.settings?.color || this.generateRandomColor(),
                    icon: data.settings?.icon || this.getDefaultIcon(data.type),
                    visibility: data.settings?.visibility || 'visible',
                    maxActivities: data.settings?.maxActivities,
                    autoArchiveCompleted: data.settings?.autoArchiveCompleted ?? false,
                    defaultActivityType: data.settings?.defaultActivityType || data.type === 'tasks' ? 'task' : 'note'
                },
                metadata: {
                    totalActivities: 0,
                    completedActivities: 0,
                    lastActivityAt: new Date()
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: userId
            };

            // Save section
            const createdSection = await this.sectionRepository.createSection(section);

            // Update planner's last activity
            await this.plannerRepository.updatePlanner(plannerId, {
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'SECTION_CREATED', {
                plannerId,
                sectionId: section.id,
                title: section.title
            });

            return {
                section: createdSection,
                statistics: await this.getSectionStatistics(section.id),
                activities: []
            };

        } catch (error) {
            logger.error('Create section failed:', error);
            throw error;
        }
    }

    /**
     * Get section by ID
     */
    async getSection(sectionId: string, userId: string): Promise<SectionResponse> {
        try {
            // Get section
            const section = await this.sectionRepository.findById(sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            // Verify access
            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this section');
            }

            // Get activities for this section
            const activities = await this.activityRepository.findBySectionId(sectionId);

            return {
                section,
                statistics: await this.getSectionStatistics(sectionId),
                activities: activities.map(a => a.id)
            };

        } catch (error) {
            logger.error(`Get section failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * List sections for planner
     */
    async listSections(plannerId: string, userId: string): Promise<any> {
        try {
            // Verify planner access
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            if (!this.hasAccess(planner, userId)) {
                throw new ForbiddenError('Access denied to this planner');
            }

            // Get sections
            const sections = await this.sectionRepository.findByPlannerId(plannerId);

            return {
                sections,
                total: sections.length,
                plannerId
            };

        } catch (error) {
            logger.error(`List sections failed for planner: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Update section
     */
    async updateSection(sectionId: string, userId: string, data: UpdateSectionRequest): Promise<SectionResponse> {
        try {
            // Get section
            const section = await this.sectionRepository.findById(sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            // Verify access
            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to edit this section');
            }

            // Update section
            const updatedSection = await this.sectionRepository.updateSection(sectionId, {
                ...data,
                updatedAt: new Date()
            });

            // Update planner's last activity
            await this.plannerRepository.updatePlanner(section.plannerId, {
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'SECTION_UPDATED', {
                plannerId: section.plannerId,
                sectionId,
                updatedFields: Object.keys(data)
            });

            return {
                section: updatedSection,
                statistics: await this.getSectionStatistics(sectionId),
                activities: await this.getActivityIds(sectionId)
            };

        } catch (error) {
            logger.error(`Update section failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Delete section
     */
    async deleteSection(sectionId: string, userId: string): Promise<void> {
        try {
            // Get section
            const section = await this.sectionRepository.findById(sectionId);
            if (!section) {
                throw new NotFoundError('Section not found');
            }

            // Verify access
            const planner = await this.plannerRepository.findById(section.plannerId);
            if (!planner || !this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to delete this section');
            }

            // Check if this is the last section
            const remainingSections = await this.sectionRepository.countByPlannerId(section.plannerId);
            if (remainingSections <= 1) {
                throw new BadRequestError('Cannot delete the last section in a planner');
            }

            // Delete section and its activities
            await this.sectionRepository.deleteSection(sectionId);
            await this.activityRepository.deleteBySectionId(sectionId);

            // Update planner's last activity
            await this.plannerRepository.updatePlanner(section.plannerId, {
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'SECTION_DELETED', {
                plannerId: section.plannerId,
                sectionId,
                title: section.title
            });

            logger.info(`Section deleted: ${sectionId}`);

        } catch (error) {
            logger.error(`Delete section failed: ${sectionId}`, error);
            throw error;
        }
    }

    /**
     * Reorder sections
     */
    async reorderSections(plannerId: string, userId: string, reorderData: ReorderSectionRequest): Promise<void> {
        try {
            // Verify planner access
            const planner = await this.plannerRepository.findById(plannerId);
            if (!planner) {
                throw new NotFoundError('Planner not found');
            }

            if (!this.canEdit(planner, userId)) {
                throw new ForbiddenError('You do not have permission to reorder sections');
            }

            // Validate all sections exist and belong to this planner
            const sectionIds = reorderData.sections.map(s => s.id);
            const sections = await this.sectionRepository.findByIds(sectionIds);

            if (sections.length !== sectionIds.length) {
                throw new BadRequestError('Some sections not found');
            }

            for (const section of sections) {
                if (section.plannerId !== plannerId) {
                    throw new BadRequestError(`Section ${section.id} does not belong to this planner`);
                }
            }

            // Update section orders
            await this.sectionRepository.reorderSections(reorderData.sections);

            // Update planner's last activity
            await this.plannerRepository.updatePlanner(plannerId, {
                'metadata.lastActivityAt': new Date()
            });

            // Log activity
            await this.logActivity(userId, 'SECTIONS_REORDERED', {
                plannerId,
                sectionCount: reorderData.sections.length
            });

            logger.info(`Sections reordered for planner: ${plannerId}`);

        } catch (error) {
            logger.error(`Reorder sections failed for planner: ${plannerId}`, error);
            throw error;
        }
    }

    /**
     * Get section statistics
     */
    async getSectionStatistics(sectionId: string): Promise<SectionStatistics> {
        try {
            return await this.sectionRepository.getSectionStatistics(sectionId);
        } catch (error) {
            logger.error(`Get section statistics failed: ${sectionId}`, error);
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

    private async checkSectionLimits(plannerId: string): Promise<void> {
        const count = await this.sectionRepository.countByPlannerId(plannerId);
        if (count >= 50) { // Max 50 sections per planner
            throw new BadRequestError('Maximum number of sections reached for this planner');
        }
    }

    private async getMaxOrder(plannerId: string): Promise<number> {
        const maxOrder = await this.sectionRepository.getMaxOrder(plannerId);
        return maxOrder ?? -1;
    }

    private generateRandomColor(): string {
        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private getDefaultIcon(type: string): string {
        const iconMap: Record<string, string> = {
            'tasks': 'list',
            'notes': 'note',
            'goals': 'target',
            'habits': 'repeat',
            'milestones': 'flag'
        };
        return iconMap[type] || 'folder';
    }

    private async getActivityIds(sectionId: string): Promise<string[]> {
        const activities = await this.activityRepository.findBySectionId(sectionId);
        return activities.map(a => a.id);
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