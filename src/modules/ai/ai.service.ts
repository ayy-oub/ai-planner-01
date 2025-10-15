/* ------------------------------------------------------------------ */
/*  ai.service.ts  –  OpenAI-powered implementation                   */
/* ------------------------------------------------------------------ */
import { Injectable } from '@nestjs/common';
const { v4: uuidv4 } = require('uuid');
import { Timestamp } from 'firebase-admin/firestore';

/* ---------- internal ---------- */
import { AIRepository } from './ai.repository';
import { CacheService } from '../../shared/services/cache.service';
import { createServiceClient } from '../../infrastructure/external/serviceClient';
import { logger } from '../../shared/utils/logger';
import { RateLimitError, AppError, ErrorCode } from '../../shared/utils/errors';
import { config } from '../../shared/config';

/* ---------- types ---------- */
import {
    AIRequest,
    AIRequestLog,
    AIResponse,
    AITaskSuggestion,
    AIScheduleOptimization,
    AIAnalysisResult,
    AIInsight,
    AINaturalLanguageQuery,
    AINaturalLanguageResponse,
    AIModelConfig,
    AISuggestion,
    AIPlannerSuggestion,
} from './ai.types';
import { UserRepository } from '../user/user.repository';
import { PlannerRepository } from '../planner/planner.repository';
import { SectionRepository } from '../section/section.repository';
import { ActivityRepository } from '../activity/activity.repository';
import { inject } from 'tsyringe';

/* ---------- private return types ---------- */
type GatherCtx = {
    userId: string;
    context: AIRequest['context'];
    planner?: any;
    sections?: any[];
    activities?: any[];
};

type ScheduleCtx = {
    userId: string;
    planner?: any;
    sections?: any[];
    activities?: any[];
    constraints?: string[];
    preferences?: Record<string, any>;
};

type HistoricalCtx = {
    userId: string;
    planner?: any;
    activities?: any[];
    timeframe?: { start: string; end: string };
};

/* ------------------------------------------------------------------ */
@Injectable()
export class AIService {
    /* ---------- config ---------- */
    private readonly aiConfig: AIModelConfig;
    private readonly rateWindowMinutes = config.ai.rateLimits.windowMinutes;
    private readonly rateLimits = {
        suggestion: config.ai.rateLimits.suggestion,
        optimization: config.ai.rateLimits.optimization,
        analysis: config.ai.rateLimits.analysis,
        insights: config.ai.rateLimits.insights,
        'natural-language': config.ai.rateLimits.naturalLanguage,
        chat: config.ai.rateLimits.naturalLanguage,
        'generate-description': config.ai.rateLimits.suggestion,
        'predict-duration': config.ai.rateLimits.suggestion,
    };

    /* ---------- OpenAI client (circuit-breaker, retries, tracing) ---------- */
    private readonly openAI = createServiceClient('openAI', config.ai.apiKey);

    constructor(
        private readonly repo: AIRepository,
        private readonly userRepo: UserRepository,
        private readonly cache: CacheService,
        @inject(PlannerRepository) private readonly plannerRepo: PlannerRepository,
        @inject(SectionRepository) private readonly sectionRepo: SectionRepository,
        @inject(ActivityRepository) private readonly activityRepo: ActivityRepository,
    ) {
        this.aiConfig = {
            model: config.ai.model,
            maxTokens: config.ai.maxTokens,
            temperature: config.ai.temperature,
            topP: config.ai.topP,
            frequencyPenalty: config.ai.frequencyPenalty,
            presencePenalty: config.ai.presencePenalty,
            timeout: config.ai.timeout,
        };
    }

    /* ================================================================= */
    /*  Public  –  entry-points mirrored from controller                 */
    /* ================================================================= */

    /** /ai/chat */
    async chat(req: { message: string; context?: any; userId: string }): Promise<AIResponse<string>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'chat');

        const cacheKey = `ai:chat:${req.userId}:${Buffer.from(req.message).toString('base64')}`;
        const cached = await this.cache.get(cacheKey) as string;
        if (cached) return this.ok(cached, id, start);

        const prompt = this.buildChatPrompt(req.message, req.context);
        const gptReply = await this.callGPT(prompt);
        await this.cache.set(cacheKey, gptReply, { ttl: 300 });
        await this.log(req.userId, 'chat', req, gptReply, id);

        return this.ok(gptReply, id, start);
    }

    /** /ai/suggest-tasks */
    async suggestTasks(req: AIRequest): Promise<AIResponse<AITaskSuggestion[]>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'suggestion');

        const cacheKey = `ai:suggestions:${req.userId}:${this.hash(req.context)}`;
        const cached = await this.cache.get(cacheKey) as AITaskSuggestion[];
        if (cached) return this.ok(cached, id, start, 0.85);

        const ctx = await this.gatherContext(req);
        const prompt = this.buildSuggestionsPrompt(ctx);
        const gptJson = await this.callGPT(prompt, true);
        const suggestions: AITaskSuggestion[] = JSON.parse(gptJson);

        await this.cache.set(cacheKey, suggestions, { ttl: 1800 });
        await this.log(req.userId, 'suggestion', req, suggestions, id);

        return this.ok(suggestions, id, start, this.avgConfidence(suggestions));
    }

    /** /ai/optimize-schedule */
    async optimizeSchedule(req: AIRequest): Promise<AIResponse<AIScheduleOptimization>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'optimization');

        const ctx = await this.gatherScheduleContext(req);
        const prompt = this.buildOptimizationPrompt(ctx);
        const gptJson = await this.callGPT(prompt, true);
        const opt: AIScheduleOptimization = {
            id: uuidv4(),
            ...JSON.parse(gptJson),
            createdAt: new Date(),
        };

        await this.repo.saveScheduleOptimization(opt);
        await this.log(req.userId, 'optimization', req, opt, id);

        return this.ok(opt, id, start, 0.92);
    }

    /** /ai/analyze-productivity */
    async analyzeProductivity(req: AIRequest): Promise<AIResponse<AIAnalysisResult>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'analysis');

        const historical = await this.gatherHistorical(req);
        const prompt = this.buildAnalysisPrompt(historical);
        const gptJson = await this.callGPT(prompt, true);
        const analysis: AIAnalysisResult = {
            id: uuidv4(),
            ...JSON.parse(gptJson),
            generatedAt: new Date(),
        };

        await this.repo.saveAnalysisResult(analysis);
        await this.log(req.userId, 'analysis', req, analysis, id);

        return this.ok(analysis, id, start, 0.88);
    }

    /** /ai/insights */
    async getInsights(userId: string, type?: string): Promise<AIResponse<AIInsight[]>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(userId);
        await this.checkRateLimit(userId, 'insights');

        const cacheKey = `ai:insights:${userId}:${type || 'all'}`;
        const cached = await this.cache.get(cacheKey) as AIInsight[];
        if (cached) return this.ok(cached, id, start);

        const prompt = this.buildInsightsPrompt(userId, type);
        const gptJson = await this.callGPT(prompt, true);
        const insights: AIInsight[] = JSON.parse(gptJson).map((i: any) => ({
            ...i,
            id: uuidv4(),
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400_000),
        }));

        await this.cache.set(cacheKey, insights, { ttl: 3600 });
        await this.log(userId, 'insights', { userId, type }, insights, id);

        return this.ok(insights, id, start);
    }

    /** /ai/generate-description */
    async generateDescription(req: {
        title: string;
        context?: string;
        tone?: string;
        userId: string;
    }): Promise<AIResponse<string>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'generate-description');

        const prompt = this.buildDescriptionPrompt(req.title, req.context, req.tone);
        const desc = await this.callGPT(prompt);

        await this.log(req.userId, 'generate-description', req, desc, id);
        return this.ok(desc, id, start);
    }

    /** /ai/predict-duration */
    async predictDuration(req: {
        title: string;
        description: string;
        category?: string;
        complexity?: string;
        userId: string;
    }): Promise<AIResponse<number>> {
        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(req.userId);
        await this.checkRateLimit(req.userId, 'predict-duration');

        const prompt = this.buildDurationPrompt(req);
        const gptJson = await this.callGPT(prompt, true);
        const minutes: number = JSON.parse(gptJson).minutes;

        await this.log(req.userId, 'predict-duration', req, minutes, id);
        return this.ok(minutes, id, start, 0.8);
    }

    /** /ai natural-language helper */
    async processNaturalLanguage(q: AINaturalLanguageQuery): Promise<AIResponse<AINaturalLanguageResponse>> {
        if (!q.context) throw new AppError('context is required', 400);

        const start = Date.now();
        const id = uuidv4();
        await this.checkPlanLimits(q.context.userId);
        await this.checkRateLimit(q.context.userId, 'natural-language');

        const prompt = this.buildNLPrompt(q);
        const gptJson = await this.callGPT(prompt, true);
        const res: AINaturalLanguageResponse = JSON.parse(gptJson);

        await this.log(q.context.userId, 'natural-language', q, res, id);
        return this.ok(res, id, start);
    }

    /* ------------------------------------------------------------------ */
    /*  NEW – plan-based quota check                                      */
    /* ------------------------------------------------------------------ */
    private async checkPlanLimits(userId: string): Promise<void> {
        const user = await this.userRepo.getProfile(userId);
        if (!user) throw new AppError('User not found', 404);

        const plan: keyof typeof config.ai.quota = user.subscription?.plan || 'free';
        const { day, month } = config.ai.quota[plan];

        /* ---- daily ---- */
        if (day !== -1) {
            const dayCount = await this.repo.getRequestCountSince(
                userId,
                new Date(Date.now() - 24 * 60 * 60 * 1000),
            );
            if (dayCount >= day)
                throw new AppError(`Daily AI quota reached (${plan})`, 403, undefined, ErrorCode.QUOTA_EXCEEDED);
        }

        /* ---- monthly ---- */
        if (month !== -1) {
            const monthCount = await this.repo.getRequestCountSince(
                userId,
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            );
            if (monthCount >= month)
                throw new AppError(`Monthly AI quota reached (${plan})`, 403, undefined, ErrorCode.QUOTA_EXCEEDED);
        }
    }

    async getUsage(userId: string) {
        const plan = (await this.userRepo.getProfile(userId))?.subscription?.plan || 'free';
        const { day, month } = config.ai.quota[plan];

        const dayCount = await this.repo.getRequestCountSince(
            userId,
            new Date(Date.now() - 24 * 60 * 60 * 1000),
        );
        const monthCount = await this.repo.getRequestCountSince(
            userId,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        );

        return {
            plan,
            limits: { day, month },
            used: { day: dayCount, month: monthCount },
            remaining: {
                day: day === -1 ? null : Math.max(0, day - dayCount),
                month: month === -1 ? null : Math.max(0, month - monthCount),
            },
        };
    }

    /* ------------------------------------------------------------------ */
    /*  NEW – missing helper you asked for                                */
    /* ------------------------------------------------------------------ */
    async getAISuggestions(plannerId: string, userId: string): Promise<AIPlannerSuggestion> {
        /* Stub data – wire real repos later */
        const planner = { id: plannerId, ownerId: userId } as any;
        const sections = [] as any[];
        const activities = [] as any[];

        // if (!planner) throw new AppError('Planner not found', 404, undefined, ErrorCode.NOT_FOUND);
        // if (planner.ownerId !== userId) throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);

        const suggestions = await this.generatePlannerSuggestions({ planner, sections, activities, userId });

        // await this.logActivity(userId, 'AI_SUGGESTIONS_REQUESTED', { plannerId });
        return suggestions;
    }

    async generatePlannerSuggestions(input: {
        planner: any;
        sections: any[];
        activities: any[];
        userId: string;
    }): Promise<AIPlannerSuggestion> {
        const prompt = `Planner: ${JSON.stringify(input.planner)}
Sections: ${JSON.stringify(input.sections)}
Activities: ${JSON.stringify(input.activities)}
Generate planner-level suggestions in strict JSON:
{"type":"optimize_schedule"|"suggest_tasks"|"categorize"|"prioritize","suggestions":[{"id":"...","title":"...","description":"...","action":"add|modify|delete|reorder","targetId":"...","targetType":"section|activity"}],"confidence":0.9,"reasoning":"..."}`;

        const gptJson = await this.callGPT(prompt, true);
        return JSON.parse(gptJson);
    }

    /* ================================================================= */
    /*  Private helpers                                                 */
    /* ================================================================= */

    private async callGPT(prompt: string, json = false): Promise<string> {
        const body = {
            model: this.aiConfig.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.aiConfig.maxTokens,
            temperature: this.aiConfig.temperature,
            top_p: this.aiConfig.topP,
            frequency_penalty: this.aiConfig.frequencyPenalty,
            presence_penalty: this.aiConfig.presencePenalty,
            ...(json && { response_format: { type: 'json_object' } }),
        };

        const res = await this.openAI.post<{ choices: { message: { content: string } }[] }>(
            '/chat/completions',
            body,
        );
        return res.choices[0].message.content.trim();
    }

    private async checkRateLimit(userId: string, type: keyof typeof this.rateLimits): Promise<void> {
        const since = new Date(Date.now() - this.rateWindowMinutes * 60_000);
        const count = await this.repo.getRequestCountSince(userId, since);
        const max = this.rateLimits[type];

        if (count >= max) {
            throw new RateLimitError(
                `Rate limit exceeded for ${type}: max ${max} per ${this.rateWindowMinutes} min.`,
            );
        }
    }

    private async log(
        userId: string,
        type: keyof typeof this.rateLimits,
        req: any,
        res: any,
        requestId: string,
    ): Promise<void> {
        const log: AIRequestLog = {
            requestId,
            userId,
            type,
            requestType: type,
            requestData: req,
            responseData: res,
            context: {
                goal: 'ai-log',
                preferences: { requestData: req, responseData: res },
            },
            timestamp: Timestamp.now() as any,
        };
        await this.repo.logAIRequest(log).catch((e) => logger.error('Log fail', e));
    }

    /* ---------- response helpers ---------- */
    private ok<T>(data: T, requestId: string, start: number, confidence?: number): AIResponse<T> {
        return {
            success: true,
            data,
            metadata: {
                requestId,
                processingTime: Date.now() - start,
                modelVersion: this.aiConfig.model,
                confidence,
            },
        };
    }

    private avgConfidence(arr: AISuggestion[]): number {
        return arr.length ? arr.reduce((s, i) => s + i.confidence, 0) / arr.length : 0;
    }

    private hash(obj: any): string {
        return Buffer.from(JSON.stringify(obj)).toString('base64').slice(0, 32);
    }

    /* ---------- prompt builders ---------- */
    private buildChatPrompt(msg: string, ctx?: any): string {
        return `You are a helpful planning assistant.\nUser: ${msg}\nContext: ${JSON.stringify(ctx)}\nAssistant:`;
    }

    private buildSuggestionsPrompt(ctx: any): string {
        return `Given the following planner context:\n${JSON.stringify(
            ctx,
        )}\nSuggest 3–7 actionable tasks in strict JSON format:\n{"suggestions":[{"task":{"title":"...","description":"...","priority":"low|medium|high|urgent","estimatedDuration":minutes},"confidence":0.9}]}`;
    }

    private buildOptimizationPrompt(ctx: any): string {
        return `Schedule to optimise:\n${JSON.stringify(
            ctx,
        )}\nReturn strict JSON:\n{"originalSchedule":[...],"optimizedSchedule":[...],"improvements":{"timeSaved":minutes,"efficiencyGain":%},"constraints":[...]}`;
    }

    private buildAnalysisPrompt(hist: any): string {
        return `Historical data:\n${JSON.stringify(
            hist,
        )}\nReturn strict JSON analysis:\n{"period":{...},"metrics":{...},"insights":[...],"recommendations":[...]}`;
    }

    private buildInsightsPrompt(userId: string, type?: string): string {
        return `Generate ${type || 'general'} insights for user ${userId} in strict JSON:\n{"insights":[{"type":"...","title":"...","description":"...","actionableItems":[...]}]}`;
    }

    private buildDescriptionPrompt(title: string, ctx?: string, tone = 'neutral'): string {
        return `Write a ${tone} one-paragraph description for planner activity titled "${title}". Context: ${ctx}`;
    }

    private buildDurationPrompt(req: any): string {
        return `Estimate duration in minutes for task: ${JSON.stringify(req)}. Reply strict JSON: {"minutes":number}`;
    }

    private buildNLPrompt(q: AINaturalLanguageQuery): string {
        return `Parse and execute planner command: ${JSON.stringify(q)}. Reply strict JSON:\n{"success":bool,"action":{...},"result":...}`;
    }

    /* ---------- stub data gatherers ---------- */

    /* real implementations – keep signature identical */
    private async gatherContext(r: AIRequest): Promise<GatherCtx> {
        const base = { userId: r.userId, context: r.context };

        if (!r.plannerId) return base; // old behaviour

        const [planner, sections, activities] = await Promise.all([
            this.plannerRepo.findById(r.plannerId),
            r.plannerId ? this.sectionRepo.findByPlannerId(r.plannerId) : [],
            r.activityIds?.length
                ? this.activityRepo.findByIds(r.activityIds)
                : r.plannerId
                    ? this.activityRepo.findByPlannerId(r.plannerId)
                    : [],
        ]);

        return { userId: r.userId, context: r.context, planner, sections, activities };
    }

    private async gatherScheduleContext(r: AIRequest): Promise<ScheduleCtx> {
        const ctx = await this.gatherContext(r);
        return {
            userId: ctx.userId,
            planner: ctx.planner,
            sections: ctx.sections,
            activities: ctx.activities,
            constraints: r.context.constraints,
            preferences: r.context.preferences,
        };
    }

    private async gatherHistorical(r: AIRequest): Promise<HistoricalCtx> {
        const ctx = await this.gatherContext(r);
        return {
            userId: ctx.userId,
            planner: ctx.planner,
            activities: ctx.activities,
            timeframe: r.context.timeframe,
        };
    }
}