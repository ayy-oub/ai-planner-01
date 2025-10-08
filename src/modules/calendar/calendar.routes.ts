import { Router } from 'express';
import { container } from 'tsyringe';
import { CalendarController } from './calendar.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const calendarController = container.resolve(CalendarController);

/**
 * @swagger
 * tags:
 *   name: Calendar
 *   description: Calendar integration and sync
 */

// All routes require authentication
router.use(authMiddleware());

/**
 * @swagger
 * /calendar/sync/google:
 *   post:
 *     summary: Sync with Google Calendar
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authCode
 *             properties:
 *               authCode:
 *                 type: string
 *               syncDirection:
 *                 type: string
 *                 enum: [bidirectional, import, export]
 *               calendarId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Google Calendar synced successfully
 *       400:
 *         description: Invalid auth code
 */
router.post('/calendar/sync/google',
    rateLimiter({ windowMs: 60 * 1000, max: 5 }),
    validationMiddleware(calendarController.calendarValidation.syncGoogle),
    calendarController.syncGoogle
);

/**
 * @swagger
 * /calendar/sync/outlook:
 *   post:
 *     summary: Sync with Outlook Calendar
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authCode
 *             properties:
 *               authCode:
 *                 type: string
 *               syncDirection:
 *                 type: string
 *                 enum: [bidirectional, import, export]
 *               calendarId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Outlook Calendar synced successfully
 *       400:
 *         description: Invalid auth code
 */
router.post('/calendar/sync/outlook',
    rateLimiter({ windowMs: 60 * 1000, max: 5 }),
    validationMiddleware(calendarController.calendarValidation.syncOutlook),
    calendarController.syncOutlook
);

/**
 * @swagger
 * /calendar/events:
 *   get:
 *     summary: Get calendar events
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: calendarId
 *         schema:
 *           type: string
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [google, outlook]
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 */
router.get('/calendar/events',
    validationMiddleware(calendarController.calendarValidation.getEvents),
    calendarController.getEvents
);

/**
 * @swagger
 * /calendar/events:
 *   post:
 *     summary: Create calendar event
 *     tags: [Calendar]
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
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               calendarId:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [google, outlook]
 *     responses:
 *       201:
 *         description: Event created successfully
 */
router.post('/calendar/events',
    rateLimiter({ windowMs: 60 * 1000, max: 10 }),
    validationMiddleware(calendarController.calendarValidation.createEvent),
    calendarController.createEvent
);

/**
 * @swagger
 * /calendar/events/{id}:
 *   patch:
 *     summary: Update calendar event
 *     tags: [Calendar]
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
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 */
router.patch('/calendar/events/:id',
    validationMiddleware(calendarController.calendarValidation.updateEvent),
    calendarController.updateEvent
);

/**
 * @swagger
 * /calendar/events/{id}:
 *   delete:
 *     summary: Delete calendar event
 *     tags: [Calendar]
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
 *         description: Event deleted successfully
 */
router.delete('/calendar/events/:id',
    validationMiddleware(calendarController.calendarValidation.deleteEvent),
    calendarController.deleteEvent
);

/**
 * @swagger
 * /calendar/settings:
 *   get:
 *     summary: Get calendar settings
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get('/calendar/settings', calendarController.getSettings);

/**
 * @swagger
 * /calendar/settings:
 *   patch:
 *     summary: Update calendar settings
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultCalendar:
 *                 type: string
 *               syncFrequency:
 *                 type: string
 *               autoSync:
 *                 type: boolean
 *               notifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.patch('/calendar/settings',
    validationMiddleware(calendarController.calendarValidation.updateSettings),
    calendarController.updateSettings
);

export default router;