import { body, query } from 'express-validator';

/* ---------- Helper Validators ---------- */
const optStr = (field: string, max: number) =>
    body(field).optional().trim().isLength({ max }).withMessage(`${field} must be ≤ ${max} chars`);

const optEnum = <T extends readonly string[]>(field: string, arr: T) =>
    body(field).optional().isIn(arr).withMessage(`${field} must be one of: ${arr.join(', ')}`);

/* ---------- Enums ---------- */
const TONES = ['professional', 'casual', 'detailed', 'brief'] as const;
const COMPLEXITIES = ['low', 'medium', 'high'] as const;
const INSIGHT_TYPES = ['productivity', 'planning', 'time-management'] as const;
const TIME_RANGES = ['week', 'month', 'quarter', 'year'] as const;

/* ---------- AI Validations ---------- */
export const aiValidations = {
    /**
     * @swagger
     * /ai/chat:
     *   post:
     *     summary: Interact with AI assistant
     */
    chat: [
        body('message')
            .trim()
            .isLength({ min: 1, max: 1000 })
            .withMessage('Message must be between 1 and 1000 characters'),
        body('context').optional().isObject().withMessage('Context must be an object'),
    ],

    /**
     * @swagger
     * /ai/suggest-tasks:
     *   post:
     *     summary: Get AI task suggestions
     */
    suggestTasks: [
        body('context')
            .trim()
            .isLength({ min: 1, max: 2000 })
            .withMessage('Context must be a string between 1–2000 chars'),
        body('plannerId').optional().isUUID().withMessage('plannerId must be a valid UUID'),
        body('sectionId').optional().isUUID().withMessage('sectionId must be a valid UUID'),
        body('preferences').optional().isObject().withMessage('Preferences must be an object'),
    ],

    /**
     * @swagger
     * /ai/optimize-schedule:
     *   post:
     *     summary: Optimize schedule using AI
     */
    optimizeSchedule: [
        body('activities')
            .isArray({ min: 1 })
            .withMessage('Activities must be a non-empty array'),
        body('activities.*')
            .isObject()
            .withMessage('Each activity must be an object'),
        body('constraints').optional().isObject().withMessage('Constraints must be an object'),
        body('preferences').optional().isObject().withMessage('Preferences must be an object'),
    ],

    /**
     * @swagger
     * /ai/analyze-productivity:
     *   post:
     *     summary: Analyze productivity patterns
     */
    analyzeProductivity: [
        body('timeRange').optional().isObject().withMessage('timeRange must be an object'),
        body('metrics')
            .optional()
            .isArray()
            .withMessage('metrics must be an array')
            .custom((arr) => arr.every((m: any) => typeof m === 'string'))
            .withMessage('metrics must be an array of strings'),
    ],

    /**
     * @swagger
     * /ai/insights:
     *   get:
     *     summary: Get AI insights
     */
    getInsights: [
        query('type')
            .optional()
            .isIn(INSIGHT_TYPES)
            .withMessage(`type must be one of: ${INSIGHT_TYPES.join(', ')}`),
        query('timeRange')
            .optional()
            .isIn(TIME_RANGES)
            .withMessage(`timeRange must be one of: ${TIME_RANGES.join(', ')}`),
    ],

    /**
     * @swagger
     * /ai/generate-description:
     *   post:
     *     summary: Generate activity description using AI
     */
    generateDescription: [
        body('title')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Title must be between 1–200 characters'),
        body('context').optional().trim().isLength({ max: 1000 }),
        optEnum('tone', TONES),
    ],

    /**
     * @swagger
     * /ai/predict-duration:
     *   post:
     *     summary: Predict task duration using AI
     */
    predictDuration: [
        body('title')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Title must be between 1–200 characters'),
        body('description')
            .trim()
            .isLength({ min: 1, max: 2000 })
            .withMessage('Description must be between 1–2000 characters'),
        body('category').optional().trim().isLength({ max: 100 }),
        optEnum('complexity', COMPLEXITIES),
    ],
};
