import { Router } from 'express';
import { container } from 'tsyringe';
import { ExportController } from './export.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const exportController = container.resolve(ExportController);

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Data export functionality
 */

// All routes require authentication
router.use(authMiddleware());

/**
 * @swagger
 * /export/pdf:
 *   post:
 *     summary: Export data as PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *               - type
 *             properties:
 *               data:
 *                 type: object
 *               type:
 *                 type: string
 *                 enum: [planner, section, activity]
 *               format:
 *                 type: string
 *                 enum: [standard, detailed, summary]
 *               includeMetadata:
 *                 type: boolean
 *               template:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF exported successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Export limit exceeded
 */
router.post('/export/pdf',
    rateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), // 10 exports per hour
    validationMiddleware(exportController.exportValidation.exportPdf),
    exportController.exportPdf
);

/**
 * @swagger
 * /export/calendar:
 *   post:
 *     summary: Export to calendar format
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *               - format
 *             properties:
 *               data:
 *                 type: object
 *               format:
 *                 type: string
 *                 enum: [ical, google, outlook]
 *               calendarName:
 *                 type: string
 *               dateRange:
 *                 type: object
 *               includeReminders:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Calendar file exported successfully
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 *       403:
 *         description: Export limit exceeded
 */
router.post('/export/calendar',
    rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 exports per hour
    validationMiddleware(exportController.exportValidation.exportCalendar),
    exportController.exportCalendar
);

/**
 * @swagger
 * /export/handwriting:
 *   post:
 *     summary: Export as handwriting format
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *               style:
 *                 type: string
 *                 enum: [cursive, print, mixed]
 *               handwriting:
 *                 type: object
 *               outputFormat:
 *                 type: string
 *                 enum: [svg, png, pdf]
 *     responses:
 *       200:
 *         description: Handwriting exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Export limit exceeded
 */
router.post('/export/handwriting',
    rateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }), // 3 exports per hour
    validationMiddleware(exportController.exportValidation.exportHandwriting),
    exportController.exportHandwriting
);

/**
 * @swagger
 * /export/json:
 *   post:
 *     summary: Export data as JSON
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *               includeMetadata:
 *                 type: boolean
 *               prettyPrint:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: JSON exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/export/json',
    rateLimiter({ windowMs: 60 * 60 * 1000, max: 20 }), // 20 exports per hour
    validationMiddleware(exportController.exportValidation.exportJson),
    exportController.exportJson
);

/**
 * @swagger
 * /export/csv:
 *   post:
 *     summary: Export data as CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *               delimiter:
 *                 type: string
 *               includeHeaders:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: CSV exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       403:
 *         description: Export limit exceeded
 */
router.post('/export/csv',
    rateLimiter({ windowMs: 60 * 60 * 1000, max: 15 }), // 15 exports per hour
    validationMiddleware(exportController.exportValidation.exportCsv),
    exportController.exportCsv
);

export default router;