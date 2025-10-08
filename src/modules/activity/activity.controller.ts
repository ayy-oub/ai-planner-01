// src/modules/activity/activity.controller.ts
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { ActivityService } from './activity.service';
import { ActivityValidation } from './activity.validation';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { CreateActivityDto, UpdateActivityDto, BulkActivityUpdateDto, ActivityReorderDto } from './dto';
import { logger } from '../../shared/utils/logger';

@injectable()
export class ActivityController {
    constructor(
        @inject('ActivityService') private activityService: ActivityService,
        @inject('ActivityValidation') private activityValidation: ActivityValidation
    ) { }

    /**
     * @swagger
     * /sections/{sectionId}/activities:
     *   post:
     *     summary: Create a new activity
     *     tags: [Activities]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: sectionId
     *         required: true
     *         schema:
     *           type: string
     *         description: Section ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateActivityDto'
     *     responses:
     *       201:
     *         description: Activity created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ActivityResponse'
     *       400:
     *         description: Bad request - Activity limit exceeded or invalid dependencies
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Section not found
     */
    createActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const sectionId = req.params.sectionId;
            const createData: CreateActivityDto = {
                title: req.body.title,
                description: req.body.description,
                type: req.body.type,
                status: req.body.status,
                priority: req.body.priority,
                dueDate: req.body.dueDate,
                tags: req.body.tags,
                assignee: req.body.assignee,
                dependencies: req.body.dependencies,
                recurring: req.body.recurring,
                reminders: req.body.reminders,
                metadata: req.body.metadata
            };

            const result = await this.activityService.createActivity(sectionId, userId, createData);

            ApiResponse.success(res, {
                data: result,
                message: 'Activity created successfully',
                statusCode: 201
            });

        } catch (error) {
            logger.error('Create activity controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /activities/{id}:
     *   get:
     *     summary: Get activity by ID
     *     tags: [Activities]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Activity ID
     *     responses:
     *       200:
     *         description: Activity retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ActivityResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Activity not found
     */
    getActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const activityId = req.params.id;

            const result = await this.activityService.getActivity(activityId, userId);

            ApiResponse.success(res, {
                data: result,
                message: 'Activity retrieved successfully'
            });

        } catch (error) {
            logger.error('Get activity controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /activities:
     *   get:
     *     summary: List activities with filters
     *     tags: [Activities]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: sectionId
     *         schema:
     *           type: string
     *         description: Filter by section ID
     *       - in: query
     *         name: plannerId
     *         schema:
     *           type: string
     *         description: Filter by planner ID
     *       - in: query
     *         name: status
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *             enum: [pending, in-progress, completed, cancelled, archived]
     *         description: Filter by status
     *       - in: query
     *         name: priority
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *             enum: [low, medium, high, urgent]
     *         description: Filter by priority
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search query
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
     *         description: Activities retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ActivityListResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     */
    listActivities = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;

            const filters: any = {
                sectionId: req.query.sectionId as string,
                plannerId: req.query.plannerId as string,
                status: req.query.status as string[],
                priority: req.query.priority as string[],
                type: req.query.type as string[],
                tags: req.query.tags as string[],
                assignee: req.query.assignee as string[],
                search: req.query.search as string,
                sortBy: req.query.sortBy as any,
                sortOrder: req.query.sortOrder as any,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20
            };

            // Parse date filters
            if (req.query.dueDateFrom) {
                filters.dueDateFrom = new Date(req.query.dueDateFrom as string);
            }
            if (req.query.dueDateTo) {
                filters.dueDateTo = new Date(req.query.dueDateTo as string);
            }
            if (req.query.completedFrom) {
                filters.completedFrom = new Date(req.query.completedFrom as string);
            }
            if (req.query.completedTo) {
                filters.completedTo = new Date(req.query.completedTo as string);
            }

            const result = await this.activityService.listActivities(filters, userId);

            ApiResponse.success(res, {
                data: result,
                message: 'Activities retrieved successfully'
            });

        } catch (error) {
            logger.error('List activities controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /activities/{id}:
     *   patch:
     *     summary: Update activity
     *     tags: [Activities]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Activity ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateActivityDto'
     *     responses:
     *       200:
     *         description: Activity updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ActivityResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Activity not found
     */
    updateActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const activityId = req.params.id;
            const updateData: UpdateActivityDto = {
                title: req.body.title,
                description: req.body.description,
                type: req.body.type,
                status: req.body.status,
                priority: req.body.priority,
                dueDate: req.body.dueDate,
                tags: req.body.tags,
                assignee: req.body.assignee,
                dependencies: req.body.dependencies,
                recurring: req.body.recurring,
                reminders: req.body.reminders,
                metadata: req.body.metadata
            };

            const result = await this.activityService.updateActivity(activityId, userId, updateData);

            ApiResponse.success(res, {
                data: result,
                message: 'Activity updated successfully'
            });

        } catch (error) {
            logger.error('Update activity controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /activities/{id}:
     *   delete:
     *     summary: Delete activity
     *     tags: [Activities]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Activity ID
     *     responses:
     *       200:
     *         description: Activity deleted successfully
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Activity not found
     */
    deleteActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const activityId = req.params.id;

            await this.activityService.deleteActivity(activityId, userId);

            ApiResponse.success(res, {
                message: 'Activity deleted successfully'
            });

        } catch (error) {
            logger.error('Delete activity controller error:', error);
            next(error);
        }
    });

    // Continue with remaining controller methods...
    // (Due to length, I'll provide the complete controller in the next message if needed)

    /**
     * Setup routes
     */
    setupRoutes() {
        const router = require('express').Router();

        // All routes require authentication
        router.use(authMiddleware());

        // Activity CRUD routes
        router.post('/sections/:sectionId/activities',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }), // 50 activities per 15 minutes
            validationMiddleware(this.activityValidation.createActivity),
            this.createActivity
        );

        router.get('/activities',
            this.listActivities
        );

        router.get('/activities/:id',
            this.getActivity
        );

        router.patch('/activities/:id',
            validationMiddleware(this.activityValidation.updateActivity),
            this.updateActivity
        );

        router.delete('/activities/:id',
            this.deleteActivity
        );

        return router;
    }
}