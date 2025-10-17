import { Router } from 'express';
import { PlannerController } from './planner.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { plannerValidations } from './planner.validation';
import { plannerController as plannerControll } from '@/shared/container';

const router = Router();
const plannerController = plannerControll

/**
 * @swagger
 * tags:
 *   name: Planners
 *   description: Planner management and organization
 */

// All routes require authentication
router.use(authenticate());
router.use(rateLimiter)

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
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *               settings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Planner created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Plan limit exceeded
 */
router.post('/',
    validate(plannerValidations.createPlanner),
    plannerController.createPlanner
);

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
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: isArchived
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Planners retrieved successfully
 */
router.get('/',
    validate(plannerValidations.listPlanners),
    plannerController.listPlanners
);

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
 *     responses:
 *       200:
 *         description: Planner retrieved successfully
 *       404:
 *         description: Planner not found
 */
router.get('/:id',
    validate(plannerValidations.getPlanner),
    plannerController.getPlanner
);

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
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *               settings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Planner updated successfully
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Planner not found
 */
router.patch('/:id',
    validate(plannerValidations.updatePlanner),
    plannerController.updatePlanner
);

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
 *     responses:
 *       200:
 *         description: Planner deleted successfully
 *       403:
 *         description: Only owner can delete
 *       404:
 *         description: Planner not found
 */
router.delete('/:id',
    validate(plannerValidations.deletePlanner),
    plannerController.deletePlanner
);

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
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, admin]
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Planner shared successfully
 *       400:
 *         description: User already collaborator
 *       403:
 *         description: No share permission
 */
router.post('/:id/share',
    validate(plannerValidations.sharePlanner),
    plannerController.sharePlanner
);

/**
 * @swagger
 * /planners/{id}/collaborators/{userId}:
 *   delete:
 *     summary: Remove collaborator
 *     tags: [Planners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Collaborator removed successfully
 *       403:
 *         description: No permission to remove collaborator
 */
router.delete('/:id/collaborators/:userId', plannerController.removeCollaborator);

/**
 * @swagger
 * /planners/{id}/duplicate:
 *   post:
 *     summary: Duplicate planner
 *     tags: [Planners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               includeActivities:
 *                 type: boolean
 *               includeSections:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Planner duplicated successfully
 */
router.post('/:id/duplicate',
    validate(plannerValidations.duplicatePlanner),
    plannerController.duplicatePlanner
);

/**
 * @swagger
 * /planners/{id}/export:
 *   post:
 *     summary: Export planner
 *     tags: [Planners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [pdf, json, csv]
 *               includeSections:
 *                 type: boolean
 *               includeActivities:
 *                 type: boolean
 *               dateRange:
 *                 type: object
 *               template:
 *                 type: string
 *     responses:
 *       200:
 *         description: File exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/:id/export',
    validate(plannerValidations.exportPlanner),
    plannerController.exportPlanner
);

/**
 * @swagger
 * /planners/{id}/statistics:
 *   get:
 *     summary: Get planner statistics
 *     tags: [Planners]
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
 */
router.get('/:id/statistics', plannerController.getPlannerStatistics);

/**
 * @swagger
 * /planners/{id}/ai-suggestions:
 *   get:
 *     summary: Get AI suggestions for planner
 *     tags: [Planners]
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
 *         description: AI suggestions retrieved successfully
 */
router.get('/:id/ai-suggestions', plannerController.getAISuggestions);

/**
 * @swagger
 * /planners/{id}/archive:
 *   post:
 *     summary: Archive planner
 *     tags: [Planners]
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
 *         description: Planner archived successfully
 */
router.post('/:id/archive', plannerController.archivePlanner);

/**
 * @swagger
 * /planners/{id}/unarchive:
 *   post:
 *     summary: Unarchive planner
 *     tags: [Planners]
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
 *         description: Planner unarchived successfully
 */
router.post('/:id/unarchive', plannerController.unarchivePlanner);

export default router;