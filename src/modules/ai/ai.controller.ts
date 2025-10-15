import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { AIService } from './ai.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { logger } from '../../shared/utils/logger';
import { AuthRequest } from '../../modules/auth/auth.types';

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered planning assistance
 */
@injectable()
export class AIController {
    constructor(
        @inject(AIService) private readonly aiService: AIService
    ) { }

    /**
     * @swagger
     * /ai/chat:
     *   post:
     *     summary: Interact with AI assistant (chat-based)
     */
    chat = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.chat({
                message: req.body.message,
                context: req.body.context,
                userId: req.user!.uid,
            });
            res.json(new ApiResponse(req).success(result, 'AI message processed successfully'));
        } catch (err) {
            logger.error('AI chat error:', err);
            next(err);
        }
    });

    /**
  * @swagger
  * /ai/suggest-tasks:
  *   post:
  *     summary: Get AI task suggestions
  */
    suggestTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.suggestTasks({
                userId: req.user!.uid,
                plannerId: req.body.plannerId,
                sectionId: req.body.sectionId,
                activityIds: req.body.activityIds,
                type: 'suggestion',
                context: {
                    goal: req.body.goal,
                    constraints: req.body.constraints,
                    preferences: req.body.preferences,
                },
                metadata: req.body.metadata,
            });
            res.json(new ApiResponse(req).success(result, 'AI task suggestions generated'));
        } catch (err) {
            logger.error('AI suggestTasks error:', err);
            next(err);
        }
    });

    /**
     * @swagger
     * /ai/optimize-schedule:
     *   post:
     *     summary: Optimize schedule using AI
     */
    optimizeSchedule = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.optimizeSchedule({
                userId: req.user!.uid,
                plannerId: req.body.plannerId,
                sectionId: req.body.sectionId,
                activityIds: req.body.activityIds,
                type: 'optimization',
                context: {
                    constraints: req.body.constraints,
                    preferences: req.body.preferences,
                },
                metadata: req.body.metadata,
            });
            res.json(new ApiResponse(req).success(result, 'Schedule optimized successfully'));
        } catch (err) {
            logger.error('AI optimizeSchedule error:', err);
            next(err);
        }
    });

    /**
     * @swagger
     * /ai/analyze-productivity:
     *   post:
     *     summary: Analyze productivity patterns
     */
    analyzeProductivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.analyzeProductivity({
                userId: req.user!.uid,
                type: 'analysis',
                context: {
                    timeframe: req.body.timeRange,
                    historicalData: req.body.historicalData,
                },
                metadata: { metrics: req.body.metrics },
            });
            res.json(new ApiResponse(req).success(result, 'Productivity analysis completed'));
        } catch (err) {
            logger.error('AI analyzeProductivity error:', err);
            next(err);
        }
    });

    /**
     * @swagger
     * /ai/insights:
     *   get:
     *     summary: Get AI insights
     */
    getInsights = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.getInsights(
                req.user!.uid,
                req.query.type as string,
            );
            res.json(new ApiResponse(req).success(result, 'AI insights retrieved successfully'));
        } catch (err) {
            logger.error('AI getInsights error:', err);
            next(err);
        }
    });

    /**
     * @swagger
     * /ai/generate-description:
     *   post:
     *     summary: Generate activity description using AI
     */
    generateDescription = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.generateDescription({
                title: req.body.title,
                context: req.body.context,
                tone: req.body.tone,
                userId: req.user!.uid,
            });
            res.json(new ApiResponse(req).success(result, 'Activity description generated successfully'));
        } catch (err) {
            logger.error('AI generateDescription error:', err);
            next(err);
        }
    });

    /**
     * @swagger
     * /ai/predict-duration:
     *   post:
     *     summary: Predict task duration using AI
     */
    predictDuration = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.aiService.predictDuration({
                title: req.body.title,
                description: req.body.description,
                category: req.body.category,
                complexity: req.body.complexity,
                userId: req.user!.uid,
            });
            res.json(new ApiResponse(req).success(result, 'Task duration predicted successfully'));
        } catch (err) {
            logger.error('AI predictDuration error:', err);
            next(err);
        }
    });

    async getUsage(req: AuthRequest, res: Response, next: NextFunction) {
        const stats = await this.aiService.getUsage(req.user!.uid);
        res.json(new ApiResponse(req).success(stats));
    }
}
