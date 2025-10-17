/* ------------------------------------------------------------------ */
/*  export.routes.ts  –  Express router (no NestJS)                   */
/* ------------------------------------------------------------------ */
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { exportValidations } from './export.validation';
import { exportController as exportControll} from '@/shared/container';

const router = Router();
const exportController = exportControll;

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Data export functionality
 */

// All routes require authentication
router.use(authenticate());
router.use(rateLimiter);

/**
 * @swagger
 * /pdf:
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
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [planner, section, activity, report, summary]
 *               format:
 *                 type: string
 *                 enum: [pdf, csv, excel, json, ical, markdown, html, txt]
 *               plannerId:
 *                 type: string
 *               sectionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               activityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               options:
 *                 type: object
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
router.post('/pdf',
    validate(exportValidations.createExport),
    exportController.exportPdf
);

/**
 * @swagger
 * /calendar:
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
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [planner, section, activity, calendar]
 *               format:
 *                 type: string
 *                 enum: [ical, google, outlook]
 *               plannerId:
 *                 type: string
 *               sectionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               activityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               options:
 *                 type: object
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
router.post('/calendar',
    validate(exportValidations.createExport),
    exportController.exportCalendar
);

/**
 * @swagger
 * /handwriting:
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
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [handwriting]
 *               format:
 *                 type: string
 *                 enum: [svg, png, pdf]
 *               options:
 *                 type: object
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
router.post('/handwriting',
    validate(exportValidations.createExport),
    exportController.exportHandwriting
);

/**
 * @swagger
 * /json:
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
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [planner, section, activity, report, summary]
 *               format:
 *                 type: string
 *                 enum: [json]
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: JSON exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/json',
    validate(exportValidations.createExport),
    exportController.exportJson
);

/**
 * @swagger
 * /csv:
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
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [planner, section, activity, report, summary]
 *               format:
 *                 type: string
 *                 enum: [csv]
 *               options:
 *                 type: object
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
router.post('/csv',
    validate(exportValidations.createExport),
    exportController.exportCsv
);

/**
 * @swagger
 * /exports:
 *   get:
 *     summary: Get user exports
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, expired]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Exports retrieved successfully
 */
router.get('/',
    validate(exportValidations.getUserExports),
    exportController.getUserExports
);

/**
 * @swagger
 * "/exports/:exportId"
 *   get:
 *     summary: Get export by ID
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export retrieved successfully
 *       404:
 *         description: Export not found
 */
router.get('/:exportId',
    validate(exportValidations.getExport),
    exportController.getExport
);

/**
 * @swagger
 * "/exports/:exportId/download"
 *   get:
 *     summary: Download export file
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Export file not found
 */
router.get('/:exportId/download',
    validate(exportValidations.downloadExport),
    exportController.downloadExport
);

/**
 * @swagger
 * "/exports/:exportId"
 *   delete:
 *     summary: Delete export
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export deleted successfully
 */
router.delete('/:exportId',
    validate(exportValidations.deleteExport),
    exportController.deleteExport
);

/**
 * @swagger
 * "/quota"
 *   get:
 *     summary: Get export quota information
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quota information retrieved successfully
 */
router.get('/quota',
    exportController.getExportQuota
);

export default router;