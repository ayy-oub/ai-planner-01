import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../shared/utils/logger';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import firebaseConnection from '../../infrastructure/database/firebase';
import { CacheService } from '../../shared/services/cache.service';
import {
    AISuggestion,
    AIInsight,
    AIScheduleOptimization,
    AIAnalysisResult,
    AIRequestLog,
} from './ai.types';
import { cacheService } from '@/shared/container';

const firestore = firebaseConnection.getDatabase();

export class AIRepository {
    private readonly suggestionColl = firestore.collection('aiSuggestions');
    private readonly optimizationColl = firestore.collection('aiScheduleOptimizations');
    private readonly analysisColl = firestore.collection('aiAnalysisResults');
    private readonly insightColl = firestore.collection('aiInsights');
    private readonly logColl = firestore.collection('aiRequestLogs');
    private readonly statsColl = firestore.collection('aiUserStats');
    private readonly cachePrefix = 'ai:';

    constructor() { }
    get cacheService(): CacheService { return cacheService; }


    /* ------------------------------------------------------------------ */
    /*  Suggestions                                                       */
    /* ------------------------------------------------------------------ */

    async saveAISuggestion(s: AISuggestion): Promise<void> {
        try {
            await this.suggestionColl.doc(s.id).set({
                ...s,
                createdAt: Timestamp.now(),
            });

            await this.cacheService.set(`${this.cachePrefix}suggestion:${s.id}`, s, { ttl: 3600 });
            logger.info(`AI suggestion saved: ${s.id}`);
        } catch (err) {
            logger.error('saveAISuggestion error', { suggestion: s, err });
            throw new AppError('Failed to save AI suggestion', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findAISuggestionById(id: string): Promise<AISuggestion | null> {
        try {
            const cached = await this.cacheService.get(`${this.cachePrefix}suggestion:${id}`);
            if (cached) return cached as AISuggestion;

            const doc = await this.suggestionColl.doc(id).get();
            if (!doc.exists) return null;

            const suggestion = { id: doc.id, ...doc.data() } as AISuggestion;
            await this.cacheService.set(`${this.cachePrefix}suggestion:${id}`, suggestion, { ttl: 3600 });
            return suggestion;
        } catch (err) {
            logger.error('findAISuggestionById error', { id, err });
            throw new AppError('Failed to get AI suggestion', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Schedule Optimizations                                            */
    /* ------------------------------------------------------------------ */

    async saveScheduleOptimization(opt: AIScheduleOptimization): Promise<void> {
        try {
            await this.optimizationColl.doc(opt.id).set({
                ...opt,
                createdAt: Timestamp.now(),
            });
            logger.info(`AI schedule optimization saved: ${opt.id}`);
        } catch (err) {
            logger.error('saveScheduleOptimization error', { opt, err });
            throw new AppError('Failed to save schedule optimization', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findOptimizationsByUser(userId: string, limit = 10): Promise<AIScheduleOptimization[]> {
        try {
            const snap = await this.optimizationColl
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIScheduleOptimization));
        } catch (err) {
            logger.error('findOptimizationsByUser error', { userId, err });
            throw new AppError('Failed to fetch optimizations', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Analysis Results                                                  */
    /* ------------------------------------------------------------------ */

    async saveAnalysisResult(a: AIAnalysisResult): Promise<void> {
        try {
            await this.analysisColl.doc(a.id).set({
                ...a,
                generatedAt: Timestamp.now(),
            });
            logger.info(`AI analysis saved: ${a.id}`);
        } catch (err) {
            logger.error('saveAnalysisResult error', { a, err });
            throw new AppError('Failed to save analysis result', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findAnalysisResults(userId: string, type?: string, limit = 10): Promise<AIAnalysisResult[]> {
        try {
            let q = this.analysisColl.where('userId', '==', userId).orderBy('generatedAt', 'desc');
            if (type) q = q.where('type', '==', type);

            const snap = await q.limit(limit).get();
            return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIAnalysisResult));
        } catch (err) {
            logger.error('findAnalysisResults error', { userId, type, err });
            throw new AppError('Failed to fetch analysis results', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Insights                                                          */
    /* ------------------------------------------------------------------ */

    async saveAIInsight(insight: AIInsight): Promise<void> {
        try {
            await this.insightColl.doc(insight.id).set({
                ...insight,
                generatedAt: Timestamp.now(),
            });
            logger.info(`AI insight saved: ${insight.id}`);
        } catch (err) {
            logger.error('saveAIInsight error', { insight, err });
            throw new AppError('Failed to save AI insight', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async findAIInsights(userId: string, type?: string, limit = 20): Promise<AIInsight[]> {
        try {
            const cacheKey = `${this.cachePrefix}insights:${userId}:${type || 'all'}`;
            const cached = await this.cacheService.get(cacheKey);
            if (cached) return cached as AIInsight[];

            let q = this.insightColl.where('userId', '==', userId).orderBy('generatedAt', 'desc');
            if (type) q = q.where('type', '==', type);

            const snap = await q.limit(limit).get();
            const insights = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIInsight));

            await this.cacheService.set(cacheKey, insights, { ttl: 3600 });
            return insights;
        } catch (err) {
            logger.error('findAIInsights error', { userId, type, err });
            throw new AppError('Failed to fetch AI insights', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Logging + Rate Limiting                                           */
    /* ------------------------------------------------------------------ */

    async logAIRequest(log: AIRequestLog): Promise<void> {
        try {
            await this.logColl.doc(log.requestId).set({
                ...log,
                timestamp: Timestamp.now(),
            });
            await this.updateUserRequestCount(log.userId, log.requestType);
            logger.info(`AI request logged: ${log.requestId}`);
        } catch (err) {
            logger.error('logAIRequest error', { log, err });
            throw new AppError('Failed to log AI request', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* returns number of AI requests created after the given date */
    async getRequestCountSince(userId: string, since: Date): Promise<number> {
        const snap = await this.logColl
            .where('userId', '==', userId)
            .where('timestamp', '>=', Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }

    async getRequestHistory(userId: string, limit = 50, offset = 0): Promise<AIRequestLog[]> {
        try {
            const snap = await this.logColl
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .offset(offset)
                .limit(limit)
                .get();

            return snap.docs.map((d) => {
                const data = d.data();
                return {
                    requestId: d.id,
                    userId: data.userId,
                    plannerId: data.plannerId,
                    sectionId: data.sectionId,
                    activityIds: data.activityIds,
                    type: data.type,
                    context: data.context,
                    responseData: data.responseData,
                    metadata: data.metadata,
                    requestType: data.requestType,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
                } as AIRequestLog;
            });

        } catch (err) {
            logger.error('getRequestHistory error', { userId, err });
            throw new AppError('Failed to fetch request history', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    private async updateUserRequestCount(userId: string, requestType: string): Promise<void> {
        try {
            await this.statsColl.doc(userId).set(
                {
                    [`requestCounts.${requestType}`]: FieldValue.increment(1),
                    [`lastRequestAt.${requestType}`]: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                },
                { merge: true },
            );
        } catch (err) {
            logger.error('updateUserRequestCount error', { userId, requestType, err });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Cleanup                                                           */
    /* ------------------------------------------------------------------ */

    async cleanupOldLogs(daysToKeep = 90): Promise<number> {
        try {
            const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            const snap = await this.logColl.where('timestamp', '<', cutoff).limit(1000).get();

            if (snap.empty) return 0;

            const batch = firestore.batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();

            logger.info(`Cleaned up ${snap.docs.length} old AI logs`);
            return snap.docs.length;
        } catch (err) {
            logger.error('cleanupOldLogs error', err);
            throw new AppError('Failed to clean AI logs', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }
}
