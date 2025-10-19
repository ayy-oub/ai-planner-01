// src/modules/section/section.service.ts
let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();
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
import { AppError } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

import { auditService, plannerRepository, activityRepository } from '../../shared/container'; // singletons

export class SectionService {
    constructor(private readonly sectionRepository: SectionRepository) { }

    /* ---- getters for the singletons we still need ---- */
    private get plannerRepository(): PlannerRepository { return plannerRepository } // if you cached repos
    private get activityRepository(): ActivityRepository { return activityRepository }
    private get auditService(): AuditService { return auditService; }

    /* =========================================================
        CRUD
    ========================================================= */

    async createSection(plannerId: string, userId: string, data: CreateSectionRequest): Promise<SectionResponse> {
        const planner = await this.getPlannerWithAccess(plannerId, userId);

        await this.checkSectionLimits(plannerId);

        const maxOrder = await this.sectionRepository.getMaxOrder(plannerId) ?? -1;

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
                defaultActivityType: data.settings?.defaultActivityType || (data.type === 'tasks' ? 'task' : 'note')
            },
            metadata: { totalActivities: 0, completedActivities: 0, lastActivityAt: new Date() },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId
        };

        const createdSection = await this.sectionRepository.createSection(section);

        // ✅ Type-safe metadata update
        await this.plannerRepository.updatePlanner(plannerId, {
            metadata: {
                ...planner.metadata,
                lastActivityAt: new Date()
            }
        });

        await this.logActivity(userId, 'SECTION_CREATED', { plannerId, sectionId: section.id, title: section.title });

        return {
            section: createdSection,
            statistics: await this.sectionRepository.getSectionStatistics(section.id),
            activities: []
        };
    }

    async getSection(sectionId: string, userId: string): Promise<SectionResponse> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) throw new AppError('Section not found', 404);

        await this.getPlannerWithAccess(section.plannerId, userId);

        const activities = await this.activityRepository.findBySectionId(sectionId);

        return {
            section,
            statistics: await this.sectionRepository.getSectionStatistics(sectionId),
            activities: activities.map(a => a.id)
        };
    }

    async listSections(plannerId: string, userId: string, filters?: any): Promise<any> {
        await this.getPlannerWithAccess(plannerId, userId);

        const sections = await this.sectionRepository.findByPlannerId(plannerId);

        return { sections, total: sections.length, plannerId };
    }

    async updateSection(sectionId: string, userId: string, data: UpdateSectionRequest): Promise<SectionResponse> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) throw new AppError('Section not found', 404);

        const planner = await this.checkEditAccess(section.plannerId, userId);

        const updatedSection = await this.sectionRepository.updateSection(sectionId, {
            ...data,
            updatedAt: new Date(),
            settings: data.settings ? { ...section.settings, ...data.settings } : section.settings
        });

        await this.plannerRepository.updatePlanner(section.plannerId, {
            metadata: {
                ...planner.metadata,
                lastActivityAt: new Date()
            }
        });

        await this.logActivity(userId, 'SECTION_UPDATED', { plannerId: section.plannerId, sectionId, updatedFields: Object.keys(data) });

        return {
            section: updatedSection,
            statistics: await this.sectionRepository.getSectionStatistics(sectionId),
            activities: await this.getActivityIds(sectionId)
        };
    }


    async deleteSection(sectionId: string, userId: string): Promise<void> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) throw new AppError('Section not found', 404);

        const planner = await this.checkEditAccess(section.plannerId, userId);

        const remaining = await this.sectionRepository.countByPlannerId(section.plannerId);
        if (remaining <= 1) throw new AppError('Cannot delete the last section', 400);

        await this.sectionRepository.deleteSection(sectionId);
        await this.activityRepository.deleteBySectionId(sectionId);

        await this.plannerRepository.updatePlanner(section.plannerId, {
            metadata: {
                ...planner.metadata,
                lastActivityAt: new Date()
            }
        });

        await this.logActivity(userId, 'SECTION_DELETED', { plannerId: section.plannerId, sectionId, title: section.title });

        logger.info(`Section deleted: ${sectionId}`);
    }

    /* =========================================================
       ACTIONS
    ========================================================= */

    async reorderSections(plannerId: string, userId: string, reorderData: ReorderSectionRequest): Promise<void> {
        const planner = await this.checkEditAccess(plannerId, userId);

        const sectionIds = reorderData.sections.map(s => s.id);
        const sections = await this.sectionRepository.findByIds(sectionIds);

        if (sections.length !== sectionIds.length) throw new AppError('Some sections not found', 400);
        sections.forEach(s => {
            if (s.plannerId !== plannerId) throw new AppError(`Section ${s.id} does not belong to this planner`, 400);
        });

        await this.sectionRepository.reorderSections(reorderData.sections);

        await this.plannerRepository.updatePlanner(plannerId, {
            metadata: {
                ...planner.metadata,
                lastActivityAt: new Date()
            }
        });

        await this.logActivity(userId, 'SECTIONS_REORDERED', { plannerId, sectionCount: reorderData.sections.length });

        logger.info(`Sections reordered for planner: ${plannerId}`);
    }

    async getSectionStatistics(sectionId: string): Promise<SectionStatistics> {
        return this.sectionRepository.getSectionStatistics(sectionId);
    }

    /* =========================================================
       HELPERS
    ========================================================= */

    private async getPlannerWithAccess(plannerId: string, userId: string): Promise<any> {
        const planner = await this.plannerRepository.findById(plannerId);
        if (!planner) throw new AppError('Planner not found', 404);
        if (!this.hasAccess(planner, userId)) throw new AppError('Access denied', 403);
        return planner;
    }

    private async checkEditAccess(plannerId: string, userId: string): Promise<any> {
        const planner = await this.plannerRepository.findById(plannerId);
        if (!planner || !this.canEdit(planner, userId)) throw new AppError('You do not have permission', 403);
        return planner;
    }

    private hasAccess(planner: any, userId: string): boolean {
        return planner.userId === userId || planner.collaborators.some((c: any) => c.userId === userId) || planner.settings?.isPublic;
    }

    private canEdit(planner: any, userId: string): boolean {
        return planner.userId === userId || planner.collaborators.some((c: any) => c.userId === userId && (c.role === 'editor' || c.role === 'admin'));
    }

    private async checkSectionLimits(plannerId: string): Promise<void> {
        const count = await this.sectionRepository.countByPlannerId(plannerId);
        if (count >= 50) throw new AppError('Maximum sections reached', 400);
    }

    private generateRandomColor(): string {
        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private getDefaultIcon(type: string): string {
        const icons: Record<string, string> = { tasks: 'list', notes: 'note', goals: 'target', habits: 'repeat', milestones: 'flag' };
        return icons[type] || 'folder';
    }

    private async getActivityIds(sectionId: string): Promise<string[]> {
        const activities = await this.activityRepository.findBySectionId(sectionId);
        return activities.map(a => a.id);
    }

    private async logActivity(userId: string, action: string, metadata: any): Promise<void> {
        try {
            await this.auditService.logActivity({ userId, action, metadata, timestamp: new Date() });
        } catch (err) {
            logger.error('Failed to log activity', err);
        }
    }
}
