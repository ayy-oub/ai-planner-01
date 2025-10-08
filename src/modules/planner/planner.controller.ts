// src/modules/planner/planner.controller.ts
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { PlannerService } from './planner.service';
import { PlannerValidation } from './planner.validation';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { CreatePlannerDto, UpdatePlannerDto, PlannerFilterDto } from './dto';
import { logger } from '../../shared/utils/logger';

@injectable()
export class PlannerController {
    constructor(
        @inject('PlannerService') private plannerService: PlannerService,
        @inject('PlannerValidation') private plannerValidation: PlannerValidation
    ) { }

    /**
     * @swagger
     * /planners:
     *   post:
     *     summary: Create a new planner
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreatePlannerDto'
     *     responses:
     *       201:
     *         description: Planner created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PlannerResponse'
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Plan limit exceeded
     */
    createPlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const createData: CreatePlannerDto = {
                title: req.body.title,
                description: req.body.description,
                color: req.body.color,
                icon: req.body.icon,
                settings: req.body.settings,
                tags: req.body.tags,
                sections: req.body.sections
            };

            const result = await this.plannerService.createPlanner(userId, createData);

            ApiResponse.success(res, {
                data: result,
                message: 'Planner created successfully',
                statusCode: 201
            });

        } catch (error) {
            logger.error('Create planner controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{id}:
     *   get:
     *     summary: Get planner by ID
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     responses:
     *       200:
     *         description: Planner retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PlannerResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Planner not found
     */
    getPlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            const result = await this.plannerService.getPlanner(plannerId, userId);

            ApiResponse.success(res, {
                data: result,
                message: 'Planner retrieved successfully'
            });

        } catch (error) {
            logger.error('Get planner controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners:
     *   get:
     *     summary: List user's planners
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search query for planner title
     *       - in: query
     *         name: tags
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Filter by tags
     *       - in: query
     *         name: isArchived
     *         schema:
     *           type: boolean
     *         description: Filter by archived status
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *         description: Page number
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *         description: Number of items per page
     *     responses:
     *       200:
     *         description: Planners retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 own:
     *                   $ref: '#/components/schemas/PlannerListResponse'
     *                 shared:
     *                   $ref: '#/components/schemas/PlannerListResponse'
     */
    listPlanners = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const filters: PlannerFilterDto = {
                search: req.query.search as string,
                tags: req.query.tags as string[],
                isArchived: req.query.isArchived === 'true',
                isPublic: req.query.isPublic === 'true',
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20
            };

            const result = await this.plannerService.listPlanners(userId, filters);

            ApiResponse.success(res, {
                data: result,
                message: 'Planners retrieved successfully'
            });

        } catch (error) {
            logger.error('List planners controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{id}:
     *   patch:
     *     summary: Update planner
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdatePlannerDto'
     *     responses:
     *       200:
     *         description: Planner updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PlannerResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Planner not found
     */
    updatePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;
            const updateData: UpdatePlannerDto = {
                title: req.body.title,
                description: req.body.description,
                color: req.body.color,
                icon: req.body.icon,
                settings: req.body.settings,
                tags: req.body.tags
            };

            const result = await this.plannerService.updatePlanner(plannerId, userId, updateData);

            ApiResponse.success(res, {
                data: result,
                message: 'Planner updated successfully'
            });

        } catch (error) {
            logger.error('Update planner controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{id}:
     *   delete:
     *     summary: Delete planner
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     responses:
     *       200:
     *         description: Planner deleted successfully
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Only owner can delete
     *       404:
     *         description: Planner not found
     */
    deletePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            await this.plannerService.deletePlanner(plannerId, userId);

            ApiResponse.success(res, {
                message: 'Planner deleted successfully'
            });

        } catch (error) {
            logger.error('Delete planner controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{id}/share:
     *   post:
     *     summary: Share planner with another user
     *     tags: [Planners]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - role
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 description: Email of the user to share with
     *               role:
     *                 type: string
     *                 enum: [viewer, editor, admin]
     *                 description: Role to assign to the collaborator
     *               message:
     *                 type: string
     *                 description: Optional message to include in the invitation
     *     responses:
     *       200:
     *         description: Planner shared successfully
     *       400:
     *         description: Bad request - User already collaborator
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No share permission
     *       404:
     *         description: Planner or user not found
     */
    sharePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;
            const shareData = {
                email: req.body.email,
                role: req.body.role,
                message: req.body.message
            };

            await this.plannerService.sharePlanner(plannerId, userId, shareData);

            ApiResponse.success(res, {
                message: 'Planner shared successfully'
            });

        } catch (error) {
            logger.error('Share planner controller error:', error);
            next(error);
        }
    });

    /**
     * Remove collaborator
     * DELETE /planners/:id/collaborators/:userId
     */
    removeCollaborator = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;
            const collaboratorId = req.params.userId;

            await this.plannerService.removeCollaborator(plannerId, userId, collaboratorId);

            ApiResponse.success(res, {
                message: 'Collaborator removed successfully'
            });

        } catch (error) {
            logger.error('Remove collaborator controller error:', error);
            next(error);
        }
    });

    /**
     * Duplicate planner
     * POST /planners/:id/duplicate
     */
    duplicatePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;
            const duplicateData: DuplicatePlannerRequest = {
                title: req.body.title,
                includeActivities: req.body.includeActivities,
                includeSections: req.body.includeSections
            };

            const result = await this.plannerService.duplicatePlanner(plannerId, userId, duplicateData);

            ApiResponse.success(res, {
                data: result,
                message: 'Planner duplicated successfully',
                statusCode: 201
            });

        } catch (error) {
            logger.error('Duplicate planner controller error:', error);
            next(error);
        }
    });

    /**
     * Export planner
     * POST /planners/:id/export
     */
    exportPlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;
            const exportData: ExportPlannerRequest = {
                format: req.body.format,
                includeSections: req.body.includeSections,
                includeActivities: req.body.includeActivities,
                dateRange: req.body.dateRange,
                template: req.body.template
            };

            const result = await this.plannerService.exportPlanner(plannerId, userId, exportData);

            // Set appropriate headers for file download
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

            res.send(result.data);

        } catch (error) {
            logger.error('Export planner controller error:', error);
            next(error);
        }
    });

    /**
     * Get planner statistics
     * GET /planners/:id/statistics
     */
    getPlannerStatistics = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            const statistics = await this.plannerService.getPlannerStatistics(plannerId);

            ApiResponse.success(res, {
                data: statistics,
                message: 'Planner statistics retrieved successfully'
            });

        } catch (error) {
            logger.error('Get planner statistics controller error:', error);
            next(error);
        }
    });

    /**
     * Get AI suggestions for planner
     * GET /planners/:id/ai-suggestions
     */
    getAISuggestions = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            const suggestions = await this.plannerService.getAISuggestions(plannerId, userId);

            ApiResponse.success(res, {
                data: suggestions,
                message: 'AI suggestions retrieved successfully'
            });

        } catch (error) {
            logger.error('Get AI suggestions controller error:', error);
            next(error);
        }
    });

    /**
     * Archive planner
     * POST /planners/:id/archive
     */
    archivePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            await this.plannerService.archivePlanner(plannerId, userId);

            ApiResponse.success(res, {
                message: 'Planner archived successfully'
            });

        } catch (error) {
            logger.error('Archive planner controller error:', error);
            next(error);
        }
    });

    /**
     * Unarchive planner
     * POST /planners/:id/unarchive
     */
    unarchivePlanner = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.id;

            await this.plannerService.unarchivePlanner(plannerId, userId);

            ApiResponse.success(res, {
                message: 'Planner unarchived successfully'
            });

        } catch (error) {
            logger.error('Unarchive planner controller error:', error);
            next(error);
        }
    });

    /**
     * Setup routes
     */
    setupRoutes() {
        const router = require('express').Router();

        // All routes require authentication
        router.use(authMiddleware());

        // Planner CRUD routes
        router.post('/',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 planners per 15 minutes
            validationMiddleware(this.plannerValidation.createPlanner),
            this.createPlanner
        );

        router.get('/',
            validationMiddleware(this.plannerValidation.listPlanners),
            this.listPlanners
        );

        router.get('/:id',
            validationMiddleware(this.plannerValidation.getPlanner),
            this.getPlanner
        );

        router.patch('/:id',
            validationMiddleware(this.plannerValidation.updatePlanner),
            this.updatePlanner
        );

        router.delete('/:id',
            validationMiddleware(this.plannerValidation.deletePlanner),
            this.deletePlanner
        );

        // Sharing routes
        router.post('/:id/share',
            validationMiddleware(this.plannerValidation.sharePlanner),
            this.sharePlanner
        );

        router.delete('/:id/collaborators/:userId',
            this.removeCollaborator
        );

        // Utility routes
        router.post('/:id/duplicate',
            validationMiddleware(this.plannerValidation.duplicatePlanner),
            this.duplicatePlanner
        );

        router.post('/:id/export',
            validationMiddleware(this.plannerValidation.exportPlanner),
            this.exportPlanner
        );

        router.get('/:id/statistics',
            this.getPlannerStatistics
        );

        router.get('/:id/ai-suggestions',
            this.getAISuggestions
        );

        router.post('/:id/archive',
            this.archivePlanner
        );

        router.post('/:id/unarchive',
            this.unarchivePlanner
        );

        return router;
    }
}