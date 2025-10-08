import { Router } from 'express';
import { container } from 'tsyringe';
import { AIController } from './ai.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const aiController = container.resolve(AIController);

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered planning assistance
 */

// All routes require authentication
router.use(authMiddleware());

/**
 * @swagger
 * /ai/suggest-tasks:
 *   post:
 *     summary: Get AI task suggestions
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context
 *             properties:
 *               context:
 *                 type: string
 *               plannerId:
 *                 type: string
 *               sectionId:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: AI suggestions retrieved successfully
 *       403:
 *         description: AI features disabled for user
 */
router.post('/ai/suggest-tasks',
    rateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 requests per minute
    validationMiddleware(aiController.aiValidation.suggestTasks),
    aiController.suggestTasks
);

/**
 * @swagger
 * /ai/optimize-schedule:
 *   post:
 *     summary: Optimize schedule using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activities
 *             properties:
 *               activities:
 *                 type: array
 *                 items:
 *                   type: object
 *               constraints:
 *                 type: object
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Schedule optimized successfully
 *       403:
 *         description: AI features disabled for user
 */
router.post('/ai/optimize-schedule',
    rateLimiter({ windowMs: 60 * 1000, max: 5 }), // 5 requests per minute
    validationMiddleware(aiController.aiValidation.optimizeSchedule),
    aiController.optimizeSchedule
);

/**
 * @swagger
 * /ai/analyze-productivity:
 *   post:
 *     summary: Analyze productivity patterns
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeRange:
 *                 type: object
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Productivity analysis completed
 *       403:
 *         description: AI features disabled for user
 */
router.post('/ai/analyze-productivity',
    rateLimiter({ windowMs: 60 * 1000, max: 3 }), // 3 requests per minute
    validationMiddleware(aiController.aiValidation.analyzeProductivity),
    aiController.analyzeProductivity
);

/**
 * @swagger
 * /ai/insights:
 *   get:
 *     summary: Get AI insights
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [productivity, planning, time-management]
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *     responses:
 *       200:
 *         description: AI insights retrieved successfully
 *       403:
 *         description: AI features disabled for user
 */
router.get('/ai/insights',
    validationMiddleware(aiController.aiValidation.getInsights),
    aiController.getInsights
);

/**
 * @swagger
 * /ai/generate-description:
 *   post:
 *     summary: Generate activity description using AI
 *     tags: [AI]
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
 *               context:
 *                 type: string
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, detailed, brief]
 *     responses:
 *       200:
 *         description: Description generated successfully
 *       403:
 *         description: AI features disabled for user
 */
router.post('/ai/generate-description',
    rateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 requests per minute
    validationMiddleware(aiController.aiValidation.generateDescription),
    aiController.generateDescription
);

/**
 * @swagger
 * /ai/predict-duration:
 *   post:
 *     summary: Predict task duration using AI
 *     tags: [AI]
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
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               complexity:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       200:
 *         description: Duration predicted successfully
 *       403:
 *         description: AI features disabled for user
 */
router.post('/ai/predict-duration',
    rateLimiter({ windowMs: 60 * 1000, max: 15 }), // 15 requests per minute
    validationMiddleware(aiController.aiValidation.predictDuration),
    aiController.predictDuration
);

export default router;