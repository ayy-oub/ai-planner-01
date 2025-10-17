import { Router } from 'express';
;
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import { aiValidations } from './ai.validations';
import { aiController as aiControll } from '@/shared/container';

const router = Router();
const aiController = aiControll

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered planning assistance
 */

// Apply authentication & global rate limiter to all routes
router.use(authenticate());
router.use(rateLimiter);

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Interact with AI assistant (chat-based)
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Help me plan my week"
 *               context:
 *                 type: object
 *                 description: Optional planner context or metadata
 *     responses:
 *       200:
 *         description: AI message processed successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: AI access denied
 */
router.post('/chat', validate(aiValidations.chat), aiController.chat);

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
router.post('/suggest-tasks',
    validate(aiValidations.suggestTasks),
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
router.post('/optimize-schedule',
    validate(aiValidations.optimizeSchedule),
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
router.post('/analyze-productivity',
    validate(aiValidations.analyzeProductivity),
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
router.get('/insights',
    validate(aiValidations.getInsights),
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
router.post('/generate-description',
    validate(aiValidations.generateDescription),
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
router.post('/predict-duration',
    validate(aiValidations.predictDuration),
    aiController.predictDuration
);

export default router;
