// src/modules/section/section.routes.ts
import { Router } from 'express';
;
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { sectionValidations } from './section.validations';
import { sectionController as sectionControll } from '@/shared/container';

const router = Router();
const sectionController = sectionControll;

/**
 * @swagger
 * tags:
 *   name: Sections
 *   description: Section management within planners
 */

// All routes require authentication
router.use(authenticate());
router.use(rateLimiter);

/* ==========================================================
    CRUD
   ========================================================== */

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
 *         description: ID of the parent planner
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Section title
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional description
 *               type:
 *                 type: string
 *                 enum: [tasks, notes, goals, habits, milestones]
 *                 description: Section type
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 description: Display order inside the planner
 *               settings:
 *                 type: object
 *                 properties:
 *                   collapsed:
 *                     type: boolean
 *                   color:
 *                     type: string
 *                     pattern: '^#[0-9A-F]{6}$'
 *                     description: Hex color code
 *                   icon:
 *                     type: string
 *                     maxLength: 50
 *                   visibility:
 *                     type: string
 *                     enum: [visible, hidden, collapsed]
 *                   maxActivities:
 *                     type: integer
 *                     minimum: 1
 *                   autoArchiveCompleted:
 *                     type: boolean
 *                   defaultActivityType:
 *                     type: string
 *                     enum: [task, event, note, goal, habit, milestone]
 *     responses:
 *       201:
 *         description: Section created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionResponse'
 *       400:
 *         description: Validation error / Section limit exceeded
 *       403:
 *         description: No edit permission
 */
router.post('/planners/:plannerId/sections',
  validate(sectionValidations.createSection),
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
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionResponse'
 *       404:
 *         description: Section not found
 */
router.get('/sections/:id',
  validate(sectionValidations.getSection),
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
 *         description: Planner ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [tasks, notes, goals, habits, milestones]
 *         description: Filter by section types
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search in title/description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [order, title, createdAt, updatedAt, lastActivityAt]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction
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
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Sections retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionListResponse'
 *       404:
 *         description: Planner not found
 */
router.get('/planners/:plannerId/sections',
  validate(sectionValidations.listSections),
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
 *         description: Section ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               settings:
 *                 type: object
 *                 properties:
 *                   collapsed:
 *                     type: boolean
 *                   color:
 *                     type: string
 *                     pattern: '^#[0-9A-F]{6}$'
 *                   icon:
 *                     type: string
 *                     maxLength: 50
 *                   visibility:
 *                     type: string
 *                     enum: [visible, hidden, collapsed]
 *                   maxActivities:
 *                     type: integer
 *                     minimum: 1
 *                   autoArchiveCompleted:
 *                     type: boolean
 *                   defaultActivityType:
 *                     type: string
 *                     enum: [task, event, note, goal, habit, milestone]
 *     responses:
 *       200:
 *         description: Section updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionResponse'
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Section not found
 */
router.patch('/sections/:id',
  validate(sectionValidations.updateSection),
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
 *         description: Section ID
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
  validate(sectionValidations.deleteSection),
  sectionController.deleteSection
);

/* ==========================================================
   ACTIONS
   ========================================================== */

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
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - order
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       description: Section ID
 *                     order:
 *                       type: integer
 *                       minimum: 0
 *                       description: New order index
 *     responses:
 *       200:
 *         description: Sections reordered successfully
 *       400:
 *         description: Invalid section IDs
 *       403:
 *         description: No edit permission
 */
router.post('/planners/:plannerId/sections/reorder',
  validate(sectionValidations.reorderSections),
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
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionStatistics'
 *       404:
 *         description: Section not found
 */
router.get('/sections/:id/statistics',
  validate(sectionValidations.getSectionStatistics),
  sectionController.getSectionStatistics
);

export default router;