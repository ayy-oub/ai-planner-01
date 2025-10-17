// src/modules/planner/planner.controller.ts
import { Response, NextFunction } from 'express';
import { PlannerService } from './planner.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../auth/auth.types';
import { logger } from '../../shared/utils/logger';

export class PlannerController {
    constructor(private readonly plannerService: PlannerService) { }

    /* =========================================================
        CRUD
    ========================================================= */
    createPlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.plannerService.createPlanner(req.user!.uid, req.body);
            res.status(201).json(new ApiResponse(req).success(result, 'Planner created successfully'));
        } catch (err) {
            logger.error('Create planner controller error:', err);
            next(err);
        }
    });

    getPlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.plannerService.getPlanner(req.params.id, req.user!.uid);
            res.json(new ApiResponse(req).success(result, 'Planner retrieved successfully'));
        } catch (err) {
            logger.error('Get planner controller error:', err);
            next(err);
        }
    });

    listPlanners = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const filters = {
                search: req.query.search as string,
                tags: req.query.tags as string[],
                isArchived: req.query.isArchived === 'true',
                isPublic: req.query.isPublic === 'true',
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            };
            const result = await this.plannerService.listPlanners(req.user!.uid, filters);
            res.json(new ApiResponse(req).success(result, 'Planners retrieved successfully'));
        } catch (err) {
            logger.error('List planners controller error:', err);
            next(err);
        }
    });

    updatePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.plannerService.updatePlanner(req.params.id, req.user!.uid, req.body);
            res.json(new ApiResponse(req).success(result, 'Planner updated successfully'));
        } catch (err) {
            logger.error('Update planner controller error:', err);
            next(err);
        }
    });

    deletePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.plannerService.deletePlanner(req.params.id, req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Planner deleted successfully'));
        } catch (err) {
            logger.error('Delete planner controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       COLLABORATION
    ========================================================= */
    sharePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.plannerService.sharePlanner(req.params.id, req.user!.uid, req.body);
            res.json(new ApiResponse(req).success(null, 'Planner shared successfully'));
        } catch (err) {
            logger.error('Share planner controller error:', err);
            next(err);
        }
    });

    removeCollaborator = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.plannerService.removeCollaborator(req.params.id, req.user!.uid, req.params.userId);
            res.json(new ApiResponse(req).success(null, 'Collaborator removed successfully'));
        } catch (err) {
            logger.error('Remove collaborator controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       ACTIONS
    ========================================================= */
    duplicatePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.plannerService.duplicatePlanner(req.params.id, req.user!.uid, req.body);
            res.status(201).json(new ApiResponse(req).success(result, 'Planner duplicated successfully'));
        } catch (err) {
            logger.error('Duplicate planner controller error:', err);
            next(err);
        }
    });

    exportPlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.plannerService.exportPlanner(req.params.id, req.user!.uid, req.body);
            res.setHeader('Content-Type', result.format);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.buffer);
        } catch (err) {
            logger.error('Export planner controller error:', err);
            next(err);
        }
    });

    archivePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.plannerService.archivePlanner(req.params.id, req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Planner archived successfully'));
        } catch (err) {
            logger.error('Archive planner controller error:', err);
            next(err);
        }
    });

    unarchivePlanner = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.plannerService.unarchivePlanner(req.params.id, req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Planner unarchived successfully'));
        } catch (err) {
            logger.error('Unarchive planner controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       ANALYTICS / AI
    ========================================================= */
    getPlannerStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const stats = await this.plannerService.getPlannerStatistics(req.params.id);
            res.json(new ApiResponse(req).success(stats, 'Planner statistics retrieved successfully'));
        } catch (err) {
            logger.error('Get planner statistics controller error:', err);
            next(err);
        }
    });

    getAISuggestions = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const suggestions = await this.plannerService.getAISuggestions(req.params.id, req.user!.uid);
            res.json(new ApiResponse(req).success(suggestions, 'AI suggestions retrieved successfully'));
        } catch (err) {
            logger.error('Get AI suggestions controller error:', err);
            next(err);
        }
    });
}