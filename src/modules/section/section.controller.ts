// src/modules/section/section.controller.ts
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { SectionService } from './section.service';
import { SectionValidation } from './section.validation';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { CreateSectionDto, UpdateSectionDto } from './dto';
import { logger } from '../../shared/utils/logger';

@injectable()
export class SectionController {
    constructor(
        @inject('SectionService') private sectionService: SectionService,
        @inject('SectionValidation') private sectionValidation: SectionValidation
    ) { }

    /**
     * @swagger
     * /planners/{plannerId}/sections:
     *   post:
     *     summary: Create a new section
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: plannerId
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateSectionDto'
     *     responses:
     *       201:
     *         description: Section created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SectionResponse'
     *       400:
     *         description: Bad request - Section limit exceeded
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Planner not found
     */
    createSection = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.plannerId;
            const createData: CreateSectionDto = {
                title: req.body.title,
                description: req.body.description,
                type: req.body.type,
                order: req.body.order,
                settings: req.body.settings
            };

            const result = await this.sectionService.createSection(plannerId, userId, createData);

            ApiResponse.success(res, {
                data: result,
                message: 'Section created successfully',
                statusCode: 201
            });

        } catch (error) {
            logger.error('Create section controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /sections/{id}:
     *   get:
     *     summary: Get section by ID
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Section ID
     *     responses:
     *       200:
     *         description: Section retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SectionResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Section not found
     */
    getSection = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const sectionId = req.params.id;

            const result = await this.sectionService.getSection(sectionId, userId);

            ApiResponse.success(res, {
                data: result,
                message: 'Section retrieved successfully'
            });

        } catch (error) {
            logger.error('Get section controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{plannerId}/sections:
     *   get:
     *     summary: List sections for a planner
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: plannerId
     *         required: true
     *         schema:
     *           type: string
     *         description: Planner ID
     *     responses:
     *       200:
     *         description: Sections retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SectionListResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Planner not found
     */
    listSections = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.plannerId;

            const result = await this.sectionService.listSections(plannerId, userId);

            ApiResponse.success(res, {
                data: result,
                message: 'Sections retrieved successfully'
            });

        } catch (error) {
            logger.error('List sections controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /sections/{id}:
     *   patch:
     *     summary: Update section
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Section ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateSectionDto'
     *     responses:
     *       200:
     *         description: Section updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SectionResponse'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Section not found
     */
    updateSection = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const sectionId = req.params.id;
            const updateData: UpdateSectionDto = {
                title: req.body.title,
                description: req.body.description,
                order: req.body.order,
                settings: req.body.settings
            };

            const result = await this.sectionService.updateSection(sectionId, userId, updateData);

            ApiResponse.success(res, {
                data: result,
                message: 'Section updated successfully'
            });

        } catch (error) {
            logger.error('Update section controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /sections/{id}:
     *   delete:
     *     summary: Delete section
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Section ID
     *     responses:
     *       200:
     *         description: Section deleted successfully
     *       400:
     *         description: Bad request - Cannot delete last section
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Section not found
     */
    deleteSection = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const sectionId = req.params.id;

            await this.sectionService.deleteSection(sectionId, userId);

            ApiResponse.success(res, {
                message: 'Section deleted successfully'
            });

        } catch (error) {
            logger.error('Delete section controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /planners/{plannerId}/sections/reorder:
     *   post:
     *     summary: Reorder sections in a planner
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: plannerId
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
     *               - sections
     *             properties:
     *               sections:
     *                 type: array
     *                 items:
     *                   type: object
     *                   required:
     *                     - id
     *                     - order
     *                   properties:
     *                     id:
     *                       type: string
     *                       description: Section ID
     *                     order:
     *                       type: number
     *                       description: New order position
     *     responses:
     *       200:
     *         description: Sections reordered successfully
     *       400:
     *         description: Bad request - Invalid section IDs
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - No edit permission
     *       404:
     *         description: Planner not found
     */
    reorderSections = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const plannerId = req.params.plannerId;
            const reorderData = {
                sections: req.body.sections
            };

            await this.sectionService.reorderSections(plannerId, userId, reorderData);

            ApiResponse.success(res, {
                message: 'Sections reordered successfully'
            });

        } catch (error) {
            logger.error('Reorder sections controller error:', error);
            next(error);
        }
    });

    /**
     * @swagger
     * /sections/{id}/statistics:
     *   get:
     *     summary: Get section statistics
     *     tags: [Sections]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Section ID
     *     responses:
     *       200:
     *         description: Section statistics retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SectionStatistics'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Access denied
     *       404:
     *         description: Section not found
     */
    getSectionStatistics = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const sectionId = req.params.id;

            const statistics = await this.sectionService.getSectionStatistics(sectionId);

            ApiResponse.success(res, {
                data: statistics,
                message: 'Section statistics retrieved successfully'
            });

        } catch (error) {
            logger.error('Get section statistics controller error:', error);
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

        // Section routes
        router.post('/planners/:plannerId/sections',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), // 20 sections per 15 minutes
            validationMiddleware(this.sectionValidation.createSection),
            this.createSection
        );

        router.get('/sections/:id',
            this.getSection
        );

        router.get('/planners/:plannerId/sections',
            this.listSections
        );

        router.patch('/sections/:id',
            validationMiddleware(this.sectionValidation.updateSection),
            this.updateSection
        );

        router.delete('/sections/:id',
            this.deleteSection
        );

        router.post('/planners/:plannerId/sections/reorder',
            validationMiddleware(this.sectionValidation.reorderSections),
            this.reorderSections
        );

        router.get('/sections/:id/statistics',
            this.getSectionStatistics
        );

        return router;
    }
}