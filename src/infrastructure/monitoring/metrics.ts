import { prometheusService } from './prometheus';
import { logger } from '../../shared/utils/logger';

class MetricsCollector {
    private static instance: MetricsCollector;
    private metricsBuffer: Map<string, any[]> = new Map();
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly flushIntervalMs = 60000; // 1 minute

    private constructor() {
        this.startPeriodicFlush();
    }

    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    // Business metrics
    recordUserActivity(userId: string, activity: string, metadata?: any): void {
        try {
            const timestamp = new Date();
            prometheusService.recordUserRegistration('native', 'free'); // Example

            this.addToBuffer('user_activity', {
                userId,
                activity,
                timestamp,
                metadata,
            });
        } catch (error) {
            logger.error('Failed to record user activity:', error);
        }
    }

    recordPlannerOperation(
        userId: string,
        operation: 'create' | 'update' | 'delete' | 'share',
        plannerType: string,
        duration: number
    ): void {
        try {
            prometheusService.recordPlannerCreation(plannerType);

            this.addToBuffer('planner_operations', {
                userId,
                operation,
                plannerType,
                duration,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record planner operation:', error);
        }
    }

    recordAIUsage(
        userId: string,
        aiType: 'suggestion' | 'optimization' | 'analysis',
        tokensUsed: number,
        cost: number,
        responseTime: number
    ): void {
        try {
            prometheusService.recordAIRequest(aiType, 'success');

            this.addToBuffer('ai_usage', {
                userId,
                aiType,
                tokensUsed,
                cost,
                responseTime,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record AI usage:', error);
        }
    }

    recordFileOperation(
        userId: string,
        operation: 'upload' | 'download' | 'delete',
        fileType: string,
        fileSize: number,
        duration: number
    ): void {
        try {
            prometheusService.recordFileUpload(fileType, fileSize);

            this.addToBuffer('file_operations', {
                userId,
                operation,
                fileType,
                fileSize,
                duration,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record file operation:', error);
        }
    }

    recordCollaborationEvent(
        plannerId: string,
        userId: string,
        event: 'join' | 'leave' | 'edit' | 'comment',
        collaboratorsCount: number
    ): void {
        try {
            this.addToBuffer('collaboration_events', {
                plannerId,
                userId,
                event,
                collaboratorsCount,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record collaboration event:', error);
        }
    }

    recordCacheEvent(
        cacheType: string,
        event: 'hit' | 'miss' | 'set' | 'delete',
        key: string,
        duration?: number
    ): void {
        try {
            if (event === 'hit' || event === 'miss') {
                // Update cache hit rate metric
                const hitRate = this.calculateCacheHitRate(cacheType);
                prometheusService.recordCacheHitRate(cacheType, hitRate);
            }

            this.addToBuffer('cache_events', {
                cacheType,
                event,
                key,
                duration,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record cache event:', error);
        }
    }

    recordDatabaseQuery(
        operation: string,
        collection: string,
        query: any,
        duration: number,
        affectedDocuments: number
    ): void {
        try {
            prometheusService.recordDatabaseQuery(operation, collection, duration);

            this.addToBuffer('database_queries', {
                operation,
                collection,
                query: this.sanitizeQuery(query),
                duration,
                affectedDocuments,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record database query:', error);
        }
    }

    recordQueueEvent(
        queueName: string,
        jobType: string,
        event: 'added' | 'completed' | 'failed' | 'delayed',
        duration?: number,
        error?: string
    ): void {
        try {
            if (duration) {
                prometheusService.recordQueueJob(queueName, jobType, duration, event === 'failed');
            }

            this.addToBuffer('queue_events', {
                queueName,
                jobType,
                event,
                duration,
                error,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record queue event:', error);
        }
    }

    recordSecurityEvent(
        event: 'login_attempt' | 'login_success' | 'login_failure' | 'password_reset' | 'suspicious_activity',
        userId?: string,
        metadata?: any
    ): void {
        try {
            this.addToBuffer('security_events', {
                event,
                userId,
                metadata,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record security event:', error);
        }
    }

    // Performance metrics
    recordApiPerformance(
        method: string,
        route: string,
        statusCode: number,
        duration: number,
        userAgent?: string,
        ip?: string
    ): void {
        try {
            prometheusService.recordHttpRequest(method, route, statusCode, duration);

            this.addToBuffer('api_performance', {
                method,
                route,
                statusCode,
                duration,
                userAgent: this.parseUserAgent(userAgent),
                ip,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record API performance:', error);
        }
    }

    recordMemoryUsage(): void {
        try {
            const memUsage = process.memoryUsage();
            prometheusService.updateSystemMetrics();

            this.addToBuffer('memory_usage', {
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                timestamp: new Date(),
            });
        } catch (error) {
            logger.error('Failed to record memory usage:', error);
        }
    }

    // Helper methods
    private addToBuffer(bufferName: string, data: any): void {
        if (!this.metricsBuffer.has(bufferName)) {
            this.metricsBuffer.set(bufferName, []);
        }

        const buffer = this.metricsBuffer.get(bufferName)!;
        buffer.push(data);

        // Limit buffer size to prevent memory issues
        if (buffer.length > 1000) {
            buffer.shift();
        }
    }

    private calculateCacheHitRate(cacheType: string): number {
        const cacheEvents = this.metricsBuffer.get('cache_events') || [];
        const recentEvents = cacheEvents.slice(-100); // Last 100 events

        const hits = recentEvents.filter((e: any) =>
            e.cacheType === cacheType && e.event === 'hit'
        ).length;

        const misses = recentEvents.filter((e: any) =>
            e.cacheType === cacheType && e.event === 'miss'
        ).length;

        const total = hits + misses;
        return total > 0 ? (hits / total) * 100 : 0;
    }

    private sanitizeQuery(query: any): any {
        // Remove sensitive information from queries
        if (typeof query === 'object' && query !== null) {
            const sanitized = { ...query };
            const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

            sensitiveFields.forEach(field => {
                if (sanitized[field]) {
                    sanitized[field] = '[REDACTED]';
                }
            });

            return sanitized;
        }
        return query;
    }

    private parseUserAgent(userAgent?: string): any {
        if (!userAgent) return null;

        // Simple user agent parsing
        const isMobile = /mobile/i.test(userAgent);
        const isTablet = /tablet|ipad/i.test(userAgent);
        const browser = this.extractBrowser(userAgent);

        return {
            isMobile,
            isTablet,
            browser,
            raw: userAgent,
        };
    }

    private extractBrowser(userAgent: string): string {
        if (/chrome/i.test(userAgent)) return 'Chrome';
        if (/firefox/i.test(userAgent)) return 'Firefox';
        if (/safari/i.test(userAgent)) return 'Safari';
        if (/edge/i.test(userAgent)) return 'Edge';
        return 'Unknown';
    }

    // Buffer management
    getBufferData(bufferName: string): any[] {
        return this.metricsBuffer.get(bufferName) || [];
    }

    clearBuffer(bufferName: string): void {
        this.metricsBuffer.delete(bufferName);
    }

    clearAllBuffers(): void {
        this.metricsBuffer.clear();
    }

    // Periodic flush
    private startPeriodicFlush(): void {
        this.flushInterval = setInterval(() => {
            this.flushAllBuffers();
        }, this.flushIntervalMs);
    }

    private flushAllBuffers(): void {
        try {
            // Process and send buffered metrics to external service if needed
            for (const [bufferName, data] of this.metricsBuffer.entries()) {
                if (data.length > 0) {
                    // Here you could send to external monitoring service
                    logger.debug(`Flushing ${data.length} metrics from ${bufferName} buffer`);

                    // Clear buffer after processing
                    this.metricsBuffer.set(bufferName, []);
                }
            }
        } catch (error) {
            logger.error('Failed to flush metrics buffers:', error);
        }
    }

    stopPeriodicFlush(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    // Aggregate metrics
    getAggregatedMetrics(timeRange: '1h' | '24h' | '7d'): any {
        const now = new Date();
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
        };

        const cutoff = new Date(now.getTime() - ranges[timeRange]);

        const aggregated: any = {
            timeRange,
            generatedAt: now,
        };

        // Aggregate user activity
        const userActivities = this.metricsBuffer.get('user_activity') || [];
        aggregated.userActivity = userActivities.filter((e: any) =>
            new Date(e.timestamp) >= cutoff
        ).reduce((acc: any, activity: any) => {
            const key = activity.activity;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Aggregate API performance
        const apiPerformance = this.metricsBuffer.get('api_performance') || [];
        const recentApiCalls = apiPerformance.filter((e: any) =>
            new Date(e.timestamp) >= cutoff
        );

        aggregated.apiMetrics = {
            totalRequests: recentApiCalls.length,
            avgResponseTime: recentApiCalls.reduce((sum: number, e: any) => sum + e.duration, 0) / recentApiCalls.length,
            statusCodes: recentApiCalls.reduce((acc: any, e: any) => {
                acc[e.statusCode] = (acc[e.statusCode] || 0) + 1;
                return acc;
            }, {}),
        };

        return aggregated;
    }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();
export default metricsCollector;