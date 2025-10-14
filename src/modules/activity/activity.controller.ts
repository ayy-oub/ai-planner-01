import { Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { ActivityService } from './activity.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../auth/auth.types';
import { logger } from '../../shared/utils/logger';
import { ActivityFilterRequest, ActivityStatus, ActivityPriority, ActivityType } from './activity.types';

@injectable()
export class ActivityController {
    constructor(
        @inject('ActivityService') private readonly activityService: ActivityService
    ) { }

    /* =========================================================
       CRUD
    ========================================================= */

    createActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const sectionId = req.params.sectionId;
            const userId = req.user!.uid;

            // ✅ No DTOs — body is already validated in the router
            const createData = { ...req.body };

            const result = await this.activityService.createActivity(sectionId, userId, createData);
            res.status(201).json(new ApiResponse(req).success(result, 'Activity created successfully'));
        } catch (err) {
            logger.error('Create activity controller error:', err);
            next(err);
        }
    });

    getActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.uid;
            const activityId = req.params.id;

            const result = await this.activityService.getActivity(activityId, userId);
            res.json(new ApiResponse(req).success(result, 'Activity retrieved successfully'));
        } catch (err) {
            logger.error('Get activity controller error:', err);
            next(err);
        }
    });

    listActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.uid;

            const filters: ActivityFilterRequest = {
                sectionId: req.query.sectionId as string,
                plannerId: req.query.plannerId as string,
                status: req.query.status
                    ? (Array.isArray(req.query.status)
                        ? (req.query.status as string[]).map(s => s as ActivityStatus)
                        : [(req.query.status as string) as ActivityStatus])
                    : undefined,
                priority: req.query.priority
                    ? (Array.isArray(req.query.priority)
                        ? (req.query.priority as string[]).map(p => p as ActivityPriority)
                        : [(req.query.priority as string) as ActivityPriority])
                    : undefined,
                type: req.query.type
                    ? (Array.isArray(req.query.type)
                        ? (req.query.type as string[]).map(t => t as ActivityType)
                        : [(req.query.type as string) as ActivityType])
                    : undefined,
                tags: req.query.tags ? (Array.isArray(req.query.tags) ? (req.query.tags as string[]) : [(req.query.tags as string)]) : undefined,
                assignee: req.query.assignee ? (Array.isArray(req.query.assignee) ? (req.query.assignee as string[]) : [(req.query.assignee as string)]) : undefined,
                search: req.query.search as string,
                sortBy: req.query.sortBy as ActivityFilterRequest['sortBy'],
                sortOrder: req.query.sortOrder as ActivityFilterRequest['sortOrder'],
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
                dueDateFrom: req.query.dueDateFrom ? new Date(req.query.dueDateFrom as string) : undefined,
                dueDateTo: req.query.dueDateTo ? new Date(req.query.dueDateTo as string) : undefined,
                completedFrom: req.query.completedFrom ? new Date(req.query.completedFrom as string) : undefined,
                completedTo: req.query.completedTo ? new Date(req.query.completedTo as string) : undefined,
            };


            const result = await this.activityService.listActivities(filters, userId);
            res.json(new ApiResponse(req).success(result, 'Activities retrieved successfully'));
        } catch (err) {
            logger.error('List activities controller error:', err);
            next(err);
        }
    });

    updateActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.uid;
            const activityId = req.params.id;

            const updateData = { ...req.body }; // ✅ Already validated

            const result = await this.activityService.updateActivity(activityId, userId, updateData);
            res.json(new ApiResponse(req).success(result, 'Activity updated successfully'));
        } catch (err) {
            logger.error('Update activity controller error:', err);
            next(err);
        }
    });

    deleteActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.uid;
            const activityId = req.params.id;

            await this.activityService.deleteActivity(activityId, userId);
            res.json(new ApiResponse(req).success(null, 'Activity deleted successfully'));
        } catch (err) {
            logger.error('Delete activity controller error:', err);
            next(err);
        }
    });
}
