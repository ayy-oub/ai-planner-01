import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { activityValidation } from './activity.validations';
import { activityController as activityControll } from '@/shared/container';

const router = Router();
const activityController = activityControll;

/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: Activity and task management
 */

// All routes require authentication
router.use(authenticate());
router.use(rateLimiter);

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
 *                 enum: [task, event, note, goal, habit, milestone]
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed, cancelled, archived]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               assignee:
 *                 type: string
 *               dependencies:
 *                 type: array
 *                 items:
 *                   type: string
 *               recurring:
 *                 type: object
 *               reminders:
 *                 type: array
 *                 items:
 *                   type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Activity created successfully
 *       400:
 *         description: Activity limit exceeded or invalid dependencies
 *       403:
 *         description: No edit permission
 */
router.post(
    '/sections/:sectionId/activities',
    validate(activityValidation.createActivity),
    activityController.createActivity
);

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
 *       - in: query
 *         name: plannerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [pending, in-progress, completed, cancelled, archived]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [low, medium, high, urgent]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Activities retrieved successfully
 */
router.get(
    '/activities',
    validate(activityValidation.listActivities),
    activityController.listActivities
);

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
 *     responses:
 *       200:
 *         description: Activity retrieved successfully
 *       404:
 *         description: Activity not found
 */
router.get(
    '/activities/:id',
    validate(activityValidation.getActivity),
    activityController.getActivity
);

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
 *               type:
 *                 type: string
 *                 enum: [task, event, note, goal, habit, milestone]
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed, cancelled, archived]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               assignee:
 *                 type: string
 *               dependencies:
 *                 type: array
 *                 items:
 *                   type: string
 *               recurring:
 *                 type: object
 *               reminders:
 *                 type: array
 *                 items:
 *                   type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Activity updated successfully
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Activity not found
 */
router.patch(
    '/activities/:id',
    validate(activityValidation.updateActivity),
    activityController.updateActivity
);

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
 *     responses:
 *       200:
 *         description: Activity deleted successfully
 *       403:
 *         description: No edit permission
 *       404:
 *         description: Activity not found
 */
router.delete(
    '/activities/:id',
    validate(activityValidation.deleteActivity),
    activityController.deleteActivity
);

export default router;
