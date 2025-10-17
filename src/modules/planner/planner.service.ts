// src/modules/planner/planner.service.ts
let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();
import { PlannerRepository } from './planner.repository';
import { UserRepository } from '../user/user.repository';
import { SectionRepository } from '../section/section.repository';
import { ActivityRepository } from '../activity/activity.repository';
import { EmailService } from '../../shared/services/email.service';
import { QueueService } from '../../shared/services/queue.service';
import { AuditService } from '../../shared/services/audit.service';
import { AIService } from '../ai/ai.service';
import {
    Planner,
    PlannerFilterRequest,
    PlannerResponse,
    PlannerStatistics,
    SharePlannerRequest,
    DuplicatePlannerRequest,
    ExportPlannerRequest,
    Collaborator,
} from './planner.types';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { ExportService } from '../export/export.service';
import { ExportRequest } from '../export/export.types';

export class PlannerService {
    constructor(
        private readonly plannerRepo: PlannerRepository,
        private readonly userRepo: UserRepository,
        private readonly sectionRepo: SectionRepository,
        private readonly activityRepo: ActivityRepository,
        private readonly email: EmailService,
        private readonly exportService: ExportService,
        private readonly queue: QueueService,
        private readonly audit: AuditService,
        private readonly ai: AIService,
    ) { }

    /* =========================================================
        CRUD
    ========================================================= */

    async createPlanner(userId: string, data: any): Promise<PlannerResponse> {
        try {
            const user = await this.userRepo.getProfile(userId);
            if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

            await this.checkPlanLimits(userId);

            const planner: Planner = {
                id: uuidv4(),
                userId,
                title: data.title,
                description: data.description || '',
                color: data.color || this.randomColor(),
                icon: data.icon || 'default',
                sections: [],
                settings: {
                    isPublic: data.settings?.isPublic || false,
                    allowCollaboration: data.settings?.allowCollaboration || false,
                    autoArchive: data.settings?.autoArchive || false,
                    reminderEnabled: data.settings?.reminderEnabled !== false,
                    defaultView: data.settings?.defaultView || 'grid',
                    theme: data.settings?.theme || 'auto',
                },
                collaborators: [],
                tags: data.tags || [],
                metadata: {
                    version: 1,
                    schemaVersion: '1.0',
                    lastActivityAt: new Date(),
                    totalActivities: 0,
                    completedActivities: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const created = await this.plannerRepo.createPlanner(planner);
            await this.createDefaultSections(created.id, userId);

            await this.queue.addJob(
                'planner',                       // queue name
                'analyzePlannerStructure',       // job type
                { plannerId: created.id, userId } // payload
            );
            this.logActivity(userId, 'PLANNER_CREATED', { plannerId: created.id, title: created.title });

            return {
                planner: created,
                statistics: await this.getPlannerStatistics(created.id),
                permissions: this.buildPermissions(created, userId),
            };
        } catch (err) {
            logger.error('createPlanner error', { userId, data, err });
            throw err; // already AppError or unexpected
        }
    }

    async getPlanner(plannerId: string, userId: string): Promise<PlannerResponse> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);

            if (!this.hasAccess(planner, userId))
                throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);

            await this.plannerRepo.updatePlanner(plannerId, { 'metadata.lastActivityAt': new Date() } as any);
            this.logActivity(userId, 'PLANNER_VIEWED', { plannerId });

            return {
                planner,
                statistics: await this.getPlannerStatistics(plannerId),
                permissions: this.buildPermissions(planner, userId),
            };
        } catch (err) {
            logger.error('getPlanner error', { plannerId, userId, err });
            throw err;
        }
    }

    async listPlanners(userId: string, filters: PlannerFilterRequest) {
        try {
            const [own, shared] = await Promise.all([
                this.plannerRepo.findByUserId(userId, filters),
                this.plannerRepo.findSharedPlanners(userId, filters),
            ]);
            return { own, shared };
        } catch (err) {
            logger.error('listPlanners error', { userId, filters, err });
            throw new AppError('Failed to list planners', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updatePlanner(plannerId: string, userId: string, updates: any): Promise<PlannerResponse> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);

            if (!this.canEdit(planner, userId))
                throw new AppError('No edit permission', 403, undefined, ErrorCode.UNAUTHORIZED);

            const updated = await this.plannerRepo.updatePlanner(plannerId, {
                ...updates,
                'metadata.lastActivityAt': new Date(),
            } as any);

            this.logActivity(userId, 'PLANNER_UPDATED', { plannerId, fields: Object.keys(updates) });

            return {
                planner: updated,
                statistics: await this.getPlannerStatistics(plannerId),
                permissions: this.buildPermissions(updated, userId),
            };
        } catch (err) {
            logger.error('updatePlanner error', { plannerId, userId, updates, err });
            throw err;
        }
    }

    async deletePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);

            if (planner.userId !== userId) throw new AppError('Only owner can delete', 403, undefined, ErrorCode.UNAUTHORIZED);

            await this.plannerRepo.deletePlanner(plannerId, userId);
            this.logActivity(userId, 'PLANNER_DELETED', { plannerId, title: planner.title });
        } catch (err) {
            logger.error('deletePlanner error', { plannerId, userId, err });
            throw err;
        }
    }

    /* =========================================================
       COLLABORATION
    ========================================================= */

    async sharePlanner(plannerId: string, userId: string, data: SharePlannerRequest): Promise<void> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.canShare(planner, userId)) throw new AppError('No share permission', 403, undefined, ErrorCode.UNAUTHORIZED);

            const target = await this.userRepo.getProfileByEmail(data.email);
            if (!target) throw new AppError('User not found with this email', 404, undefined, ErrorCode.USER_NOT_FOUND);

            const exists = planner.collaborators.some(c => c.userId === target.uid);
            if (exists) throw new AppError('User is already a collaborator', 400, undefined, ErrorCode.VALIDATION_ERROR);

            const collaborator: Collaborator = {
                userId: target.uid,
                role: data.role,
                addedAt: new Date(),
                addedBy: userId,
            };

            await this.plannerRepo.addCollaborator(plannerId, collaborator);

            const recipientName = target.displayName || 'Client';
            const message = data.message || "Let's plan together"

            // fire-and-forget email
            this.email.sendPlannerSharedEmail(target.email, recipientName, planner.title, data.role, message);

            this.logActivity(userId, 'PLANNER_SHARED', { plannerId, sharedWith: target.uid, role: data.role });
        } catch (err) {
            logger.error('sharePlanner error', { plannerId, userId, data, err });
            throw err;
        }
    }

    async removeCollaborator(plannerId: string, userId: string, collaboratorId: string): Promise<void> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.canManageCollaborators(planner, userId))
                throw new AppError('No permission to manage collaborators', 403, undefined, ErrorCode.UNAUTHORIZED);

            await this.plannerRepo.removeCollaborator(plannerId, collaboratorId);
            this.logActivity(userId, 'COLLABORATOR_REMOVED', { plannerId, removedUserId: collaboratorId });
        } catch (err) {
            logger.error('removeCollaborator error', { plannerId, userId, collaboratorId, err });
            throw err;
        }
    }

    /* =========================================================
       ACTIONS
    ========================================================= */

    async duplicatePlanner(plannerId: string, userId: string, data: DuplicatePlannerRequest): Promise<PlannerResponse> {
        try {
            const original = await this.plannerRepo.findById(plannerId);
            if (!original) throw new AppError('Original planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.hasAccess(original, userId)) throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);

            const copy: Planner = {
                ...original,
                id: uuidv4(),
                userId,
                title: data.title || `${original.title} (Copy)`,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: { ...original.metadata, lastActivityAt: new Date() },
            };

            const created = await this.plannerRepo.createPlanner(copy);

            if (data.includeSections !== false) {
                const sections = await this.sectionRepo.findByPlannerId(plannerId);
                for (const s of sections) {
                    const newSection = await this.sectionRepo.createSection({ ...s, id: uuidv4(), plannerId: copy.id });
                    if (data.includeActivities !== false) {
                        const activities = await this.activityRepo.findBySectionId(s.id);
                        for (const a of activities) {
                            await this.activityRepo.createActivity({ ...a, id: uuidv4(), sectionId: newSection.id, plannerId: copy.id });
                        }
                    }
                }
            }

            this.logActivity(userId, 'PLANNER_DUPLICATED', { originalPlannerId: plannerId, newPlannerId: copy.id });

            return {
                planner: created,
                statistics: await this.getPlannerStatistics(copy.id),
                permissions: this.buildPermissions(created, userId),
            };
        } catch (err) {
            logger.error('duplicatePlanner error', { plannerId, userId, data, err });
            throw err;
        }
    }

    async exportPlanner(plannerId: string, userId: string, data: ExportPlannerRequest) {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.hasAccess(planner, userId)) throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);

            let includeSections: string[] = [];
            if (data.includeSections?.length) {
                includeSections = data.includeSections.filter(id => typeof id === 'string') as string[];
            }

            const sections = includeSections.length
                ? await this.sectionRepo.findByIds(includeSections)
                : await this.sectionRepo.findByPlannerId(plannerId);

            const activities = data.includeActivities !== false ? await this.activityRepo.findByPlannerId(plannerId) : [];

            const exportData = {
                planner: { title: planner.title, description: planner.description, color: planner.color, icon: planner.icon, tags: planner.tags, exportedAt: new Date() },
                sections: sections.map(s => ({ title: s.title, description: s.description, order: s.order, type: s.type })),
                activities: activities.map(a => ({ title: a.title, description: a.description, type: a.type, status: a.status, priority: a.priority, dueDate: a.dueDate, tags: a.tags })),
            };

            let buffer: Buffer;
            const exportReq: ExportRequest = {
                userId,
                format: data.format,
                type: 'planner',
                plannerId,
                options: data.template ? { template: data.template } : undefined,
                filters: undefined,
                dateRange: undefined,
            };
            switch (data.format) {
                case 'pdf':
                    buffer = await this.exportService.exportPdf(exportReq);
                    break;
                case 'csv':
                    buffer = await this.exportService.exportCsv(exportReq);
                    break;
                case 'json':
                    buffer = await this.exportService.exportJson(exportReq);
                    break;
                case 'ical':
                    buffer = await this.exportService.exportCalendar(exportReq);
                    break;
                default:
                    throw new AppError('Unsupported export format', 400, undefined, ErrorCode.VALIDATION_ERROR);
            }

            const result = { buffer, format: data.format, filename: `planner_${plannerId}.${data.format}` };
            this.logActivity(userId, 'PLANNER_EXPORTED', { plannerId, format: data.format });

            return result;
        } catch (err) {
            logger.error('exportPlanner error', { plannerId, userId, data, err });
            throw err;
        }
    }

    async archivePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.canArchive(planner, userId)) throw new AppError('No archive permission', 403, undefined, ErrorCode.UNAUTHORIZED);

            await this.plannerRepo.archivePlanner(plannerId);
            this.logActivity(userId, 'PLANNER_ARCHIVED', { plannerId });
        } catch (err) {
            logger.error('archivePlanner error', { plannerId, userId, err });
            throw err;
        }
    }

    async unarchivePlanner(plannerId: string, userId: string): Promise<void> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.canArchive(planner, userId)) throw new AppError('No unarchive permission', 403, undefined, ErrorCode.UNAUTHORIZED);

            await this.plannerRepo.unarchivePlanner(plannerId);
            this.logActivity(userId, 'PLANNER_UNARCHIVED', { plannerId });
        } catch (err) {
            logger.error('unarchivePlanner error', { plannerId, userId, err });
            throw err;
        }
    }

    async getPlannerStatistics(plannerId: string): Promise<PlannerStatistics> {
        try {
            return await this.plannerRepo.getPlannerStatistics(plannerId);
        } catch (err) {
            logger.error('getPlannerStatistics error', { plannerId, err });
            throw new AppError('Failed to compute statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async getAISuggestions(plannerId: string, userId: string): Promise<any> {
        try {
            const planner = await this.plannerRepo.findById(plannerId);
            if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
            if (!this.hasAccess(planner, userId)) throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);

            const [sections, activities] = await Promise.all([
                this.sectionRepo.findByPlannerId(plannerId),
                this.activityRepo.findByPlannerId(plannerId),
            ]);

            const suggestions = await this.ai.generatePlannerSuggestions({ planner, sections, activities, userId });

            this.logActivity(userId, 'AI_SUGGESTIONS_REQUESTED', { plannerId });

            return suggestions;
        } catch (err) {
            logger.error('getAISuggestions error', { plannerId, userId, err });
            throw err;
        }
    }

    /* =========================================================
       Helpers
    ========================================================= */

    private hasAccess(p: Planner, userId: string): boolean {
        return p.userId === userId || p.collaborators.some(c => c.userId === userId) || p.settings.isPublic;
    }

    private canEdit(p: Planner, userId: string): boolean {
        return p.userId === userId || p.collaborators.some(c => c.userId === userId && (c.role === 'editor' || c.role === 'admin'));
    }

    private canShare(p: Planner, userId: string): boolean {
        return p.userId === userId || p.collaborators.some(c => c.userId === userId && c.role === 'admin');
    }

    private canManageCollaborators(p: Planner, userId: string): boolean {
        return p.userId === userId || p.collaborators.some(c => c.userId === userId && c.role === 'admin');
    }

    private canArchive(p: Planner, userId: string): boolean {
        return p.userId === userId;
    }

    private buildPermissions(p: Planner, userId: string): any {
        const isOwner = p.userId === userId;
        const collab = p.collaborators.find(c => c.userId === userId);

        let role: 'owner' | 'admin' | 'editor' | 'viewer' = 'viewer';
        let canEdit = false;
        let canDelete = false;
        let canShare = false;
        let canArchive = false;

        if (isOwner) {
            role = 'owner';
            canEdit = canDelete = canShare = canArchive = true;
        } else if (collab) {
            role = collab.role as any;
            canEdit = collab.role === 'editor' || collab.role === 'admin';
            canShare = collab.role === 'admin';
        }

        return { canEdit, canDelete, canShare, canArchive, role };
    }

    private async checkPlanLimits(userId: string): Promise<void> {
        const user = await this.userRepo.getProfile(userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        const plan = user.subscription?.plan || 'free';
        const current = user.statistics?.totalPlanners || 0;

        const limits: Record<string, number> = { free: 3, premium: 50, enterprise: -1 };
        const limit = limits[plan] ?? limits.free;

        if (limit !== -1 && current >= limit)
            throw new AppError(`Plan limit reached (${plan})`, 403, undefined, ErrorCode.QUOTA_EXCEEDED);
    }

    private async createDefaultSections(plannerId: string, userId: string): Promise<void> {
        const defaults = [
            { title: 'To Do', description: 'Tasks that need to be done', order: 1, type: 'tasks' as const, settings: { collapsed: false, color: '#EF4444', icon: 'list', visibility: 'visible' as const } },
            { title: 'In Progress', description: 'Tasks currently being worked on', order: 2, type: 'tasks' as const, settings: { collapsed: false, color: '#F59E0B', icon: 'clock', visibility: 'visible' as const } },
            { title: 'Done', description: 'Completed tasks', order: 3, type: 'tasks' as const, settings: { collapsed: false, color: '#10B981', icon: 'check', visibility: 'visible' as const } },
        ];

        for (const s of defaults) {
            await this.sectionRepo.createSection({
                ...s,
                id: uuidv4(),
                plannerId,
                activities: [], // Add default activities array
                metadata: { // Add default metadata object
                    totalActivities: 0,
                    completedActivities: 0,
                    lastActivityAt: new Date(),
                },
                createdAt: new Date(), // Add default createdAt date
                updatedAt: new Date(), // Add default updatedAt date
                createdBy: userId,     // Add default createdBy user ID
            });
        }
    }

    private randomColor(): string {
        const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private logActivity(userId: string, action: string, meta: any): void {
        this.audit.logActivity({ userId, action, metadata: meta, timestamp: new Date() }).catch((e: any) => logger.error('audit log failed', e));
    }
}