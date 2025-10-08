import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../shared/services/firebase.service';
import { CacheService } from '../../shared/services/cache.service';
import {
    AISuggestion,
    AIInsight,
    AIScheduleOptimization,
    AIAnalysisResult,
    AIRequestLimit
} from './ai.types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../shared/utils/logger';

@Injectable()
export class AIRepository {
    private readonly logger = new Logger(AIRepository.name);
    private readonly db;
    private readonly cachePrefix = 'ai:';

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly cacheService: CacheService
    ) {
        this.db = this.firebaseService.getFirestore();
    }

    /**
     * Save AI suggestion
     */
    async saveAISuggestion(suggestion: AISuggestion): Promise<void> {
        try {
            const suggestionRef = this.db.collection('aiSuggestions').doc(suggestion.id);
            await suggestionRef.set({
                ...suggestion,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Cache for quick access
            const cacheKey = `${this.cachePrefix}suggestion:${suggestion.id}`;
            await this.cacheService.set(cacheKey, suggestion, 3600); // 1 hour

            logger.info(`AI suggestion saved: ${suggestion.id}`);
        } catch (error) {
            logger.error('Error saving AI suggestion:', error);
            throw error;
        }
    }

    /**
     * Get AI suggestion by ID
     */
    async getAISuggestion(suggestionId: string): Promise<AISuggestion | null> {
        try {
            // Check cache first
            const cacheKey = `${this.cachePrefix}suggestion:${suggestionId}`;
            const cached = await this.cacheService.get<AISuggestion>(cacheKey);
            if (cached) return cached;

            // Fetch from database
            const suggestionRef = this.db.collection('aiSuggestions').doc(suggestionId);
            const doc = await suggestionRef.get();

            if (!doc.exists) return null;

            const suggestion = { id: doc.id, ...doc.data() } as AISuggestion;

            // Cache for future requests
            await this.cacheService.set(cacheKey, suggestion, 3600);

            return suggestion;
        } catch (error) {
            logger.error('Error retrieving AI suggestion:', error);
            throw error;
        }
    }

    /**
     * Save schedule optimization
     */
    async saveScheduleOptimization(optimization: AIScheduleOptimization): Promise<void> {
        try {
            const optimizationRef = this.db.collection('aiScheduleOptimizations').doc(optimization.id);
            await optimizationRef.set({
                ...optimization,
                createdAt: FieldValue.serverTimestamp(),
            });

            logger.info(`Schedule optimization saved: ${optimization.id}`);
        } catch (error) {
            logger.error('Error saving schedule optimization:', error);
            throw error;
        }
    }

    /**
     * Get schedule optimizations by user
     */
    async getScheduleOptimizations(userId: string, limit: number = 10): Promise<AIScheduleOptimization[]> {
        try {
            const optimizationsRef = this.db.collection('aiScheduleOptimizations')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            const snapshot = await optimizationsRef.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt
            } as AIScheduleOptimization));
        } catch (error) {
            logger.error('Error retrieving schedule optimizations:', error);
            throw error;
        }
    }

    /**
     * Save analysis result
     */
    async saveAnalysisResult(analysis: AIAnalysisResult): Promise<void> {
        try {
            const analysisRef = this.db.collection('aiAnalysisResults').doc(analysis.id);
            await analysisRef.set({
                ...analysis,
                generatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`Analysis result saved: ${analysis.id}`);
        } catch (error) {
            logger.error('Error saving analysis result:', error);
            throw error;
        }
    }

    /**
     * Get analysis results by user
     */
    async getAnalysisResults(userId: string, type?: string, limit: number = 10): Promise<AIAnalysisResult[]> {
        try {
            let query = this.db.collection('aiAnalysisResults')
                .where('userId', '==', userId)
                .orderBy('generatedAt', 'desc');

            if (type) {
                query = query.where('type', '==', type);
            }

            const snapshot = await query.limit(limit).get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                generatedAt: doc.data().generatedAt
            } as AIAnalysisResult));
        } catch (error) {
            logger.error('Error retrieving analysis results:', error);
            throw error;
        }
    }

    /**
     * Save AI insight
     */
    async saveAIInsight(insight: AIInsight): Promise<void> {
        try {
            const insightRef = this.db.collection('aiInsights').doc(insight.id);
            await insightRef.set({
                ...insight,
                generatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`AI insight saved: ${insight.id}`);
        } catch (error) {
            logger.error('Error saving AI insight:', error);
            throw error;
        }
    }

    /**
     * Get AI insights by user
     */
    async getAIInsights(userId: string, type?: string, limit: number = 20): Promise<AIInsight[]> {
        try {
            // Check cache first for recent insights
            const cacheKey = `${this.cachePrefix}insights:${userId}:${type || 'all'}`;
            const cached = await this.cacheService.get<AIInsight[]>(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('aiInsights')
                .where('userId', '==', userId)
                .orderBy('generatedAt', 'desc');

            if (type) {
                query = query.where('type', '==', type);
            }

            const snapshot = await query.limit(limit).get();

            const insights = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                generatedAt: doc.data().generatedAt
            } as AIInsight));

            // Cache for 1 hour
            await this.cacheService.set(cacheKey, insights, 3600);

            return insights;
        } catch (error) {
            logger.error('Error retrieving AI insights:', error);
            throw error;
        }
    }

    /**
     * Log AI request for analytics and rate limiting
     */
    async logAIRequest(logData: {
        requestId: string;
        userId: string;
        requestType: string;
        requestData: any;
        responseData: any;
        timestamp: Timestamp;
        metadata?: any;
    }): Promise<void> {
        try {
            const logRef = this.db.collection('aiRequestLogs').doc(logData.requestId);
            await logRef.set(logData);

            // Update user request count for rate limiting
            await this.updateUserRequestCount(logData.userId, logData.requestType);

            logger.info(`AI request logged: ${logData.requestId}`);
        } catch (error) {
            logger.error('Error logging AI request:', error);
            throw error;
        }
    }

    /**
     * Get request count for rate limiting
     */
    async getRequestCount(userId: string, requestType: string, since: Date): Promise<number> {
        try {
            const snapshot = await this.db.collection('aiRequestLogs')
                .where('userId', '==', userId)
                .where('requestType', '==', requestType)
                .where('timestamp', '>=', since)
                .count()
                .get();

            return snapshot.data().count;
        } catch (error) {
            logger.error('Error getting request count:', error);
            throw error;
        }
    }

    /**
     * Update user request count
     */
    private async updateUserRequestCount(userId: string, requestType: string): Promise<void> {
        try {
            const userStatsRef = this.db.collection('aiUserStats').doc(userId);
            const now = new Date();
            const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour window

            await userStatsRef.set({
                [`requestCounts.${requestType}`]: FieldValue.increment(1),
                [`lastRequestAt.${requestType}`]: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (error) {
            logger.error('Error updating user request count:', error);
            throw error;
        }
    }

    /**
     * Get user historical data for AI analysis
     */
    async getUserHistoricalData(userId: string, timeframe?: { start?: string; end?: string }): Promise<any[]> {
        try {
            let query = this.db.collection('activities')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc');

            if (timeframe?.start) {
                query = query.where('createdAt', '>=', new Date(timeframe.start));
            }

            if (timeframe?.end) {
                query = query.where('createdAt', '<=', new Date(timeframe.end));
            }

            const snapshot = await query.limit(1000).get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt
            }));
        } catch (error) {
            logger.error('Error retrieving user historical data:', error);
            throw error;
        }
    }

    /**
     * Get request history
     */
    async getRequestHistory(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
        try {
            const snapshot = await this.db.collection('aiRequestLogs')
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .offset(offset)
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp
            }));
        } catch (error) {
            logger.error('Error retrieving request history:', error);
            throw error;
        }
    }

    /**
     * Get usage statistics
     */
    async getUsageStats(userId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<any> {
        try {
            const now = new Date();
            let startDate: Date;

            switch (period) {
                case 'day':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            // Get request counts by type
            const requestStats = await this.db.collection('aiRequestLogs')
                .where('userId', '==', userId)
                .where('timestamp', '>=', startDate)
                .get();

            const requestsByType = {};
            let totalRequests = 0;

            requestStats.docs.forEach(doc => {
                const type = doc.data().requestType;
                requestsByType[type] = (requestsByType[type] || 0) + 1;
                totalRequests++;
            });

            // Get user subscription details
            const userDoc = await this.db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const subscriptionPlan = userData?.subscription?.plan || 'free';

            // Define quota limits based on subscription
            const quotaLimits = {
                free: { total: 100, daily: 20 },
                premium: { total: 1000, daily: 100 },
                enterprise: { total: -1, daily: -1 } // unlimited
            };

            const userLimit = quotaLimits[subscriptionPlan] || quotaLimits.free;
            const dailyCount = Object.values(requestsByType).reduce((sum: number, count: number) => sum + count, 0);

            return {
                totalRequests,
                requestsByType,
                remainingQuota: userLimit.total > 0 ? Math.max(0, userLimit.total - totalRequests) : -1,
                dailyRemaining: userLimit.daily > 0 ? Math.max(0, userLimit.daily - dailyCount) : -1,
                usageTrend: await this.getUsageTrend(userId, period),
                subscriptionPlan,
                limits: userLimit
            };
        } catch (error) {
            logger.error('Error retrieving usage statistics:', error);
            throw error;
        }
    }

    /**
     * Get usage trend data
     */
    private async getUsageTrend(userId: string, period: string): Promise<any[]> {
        try {
            // This is a simplified implementation
            // In a real scenario, you would aggregate data by time periods
            const now = new Date();
            let startDate: Date;

            switch (period) {
                case 'day':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            const snapshot = await this.db.collection('aiRequestLogs')
                .where('userId', '==', userId)
                .where('timestamp', '>=', startDate)
                .orderBy('timestamp', 'asc')
                .get();

            // Group by day
            const dailyUsage = {};
            snapshot.docs.forEach(doc => {
                const date = doc.data().timestamp.toDate().toISOString().split('T')[0];
                dailyUsage[date] = (dailyUsage[date] || 0) + 1;
            });

            return Object.entries(dailyUsage).map(([date, count]) => ({
                date,
                count
            }));
        } catch (error) {
            logger.error('Error retrieving usage trend:', error);
            return [];
        }
    }

    /**
     * Clean up old AI data
     */
    async cleanupOldData(daysToKeep: number = 90): Promise<number> {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            let deletedCount = 0;

            // Clean up old request logs
            const logsSnapshot = await this.db.collection('aiRequestLogs')
                .where('timestamp', '<', cutoffDate)
                .limit(1000)
                .get();

            const batch = this.db.batch();
            logsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });

            await batch.commit();
            logger.info(`Cleaned up ${deletedCount} old AI request logs`);

            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up old AI data:', error);
            throw error;
        }
    }
}