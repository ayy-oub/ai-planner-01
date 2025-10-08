import { Router } from 'express';
import { container } from 'tsyringe';
import { SectionController } from './section.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const sectionController = container.resolve(SectionController);

/**
 * @swagger
 * tags:
 *   name: Sections
 *   description: Section management within planners
 */

// All routes require authentication
router.use(authMiddleware());

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [tasks, notes, goals]
 *               order:
 *                 type: number
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Section created successfully
 *       400:
 *         description: Section limit exceeded
 *       403:
 *         description: No edit permission
 */
router.post('/planners/:plannerId/sections',
    rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
    validationMiddleware(sectionController.sectionValidation.createSection),
    sectionController.createSection
);

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
 *     responses:
 *       200:
 *         description: Section retrieved successfully
 *       404:
 *         description: Section not found
 */
router.get('/sections/:id',
    validationMiddleware(sectionController.sectionValidation.getSection),
    sectionController.getSection
);

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
 *     responses:
 *       200:
 *         description: Sections retrieved successfully
 *       404:
 *         description: Planner not found
 */
router.get('/planners/:plannerId/sections',
    validationMiddleware(sectionController.sectionValidation.listSections),
    sectionController.listSections
);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Section updated successfully
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Section not found
 */
router.patch('/sections/:id',
    validationMiddleware(sectionController.sectionValidation.updateSection),
    sectionController.updateSection
);

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
 *     responses:
 *       200:
 *         description: Section deleted successfully
 *       400:
 *         description: Cannot delete last section
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Section not found
 */
router.delete('/sections/:id',
    validationMiddleware(sectionController.sectionValidation.deleteSection),
    sectionController.deleteSection
);

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
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Sections reordered successfully
 *       400:
 *         description: Invalid section IDs
 *       403:
 *         description: No edit permission
 */
router.post('/planners/:plannerId/sections/reorder',
    validationMiddleware(sectionController.sectionValidation.reorderSections),
    sectionController.reorderSections
);

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
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       404:
 *         description: Section not found
 */
router.get('/sections/:id/statistics',
    validationMiddleware(sectionController.sectionValidation.getSectionStatistics),
    sectionController.getSectionStatistics
);

export default router;