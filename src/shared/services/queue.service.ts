import Bull, { Queue, Job, JobOptions, QueueOptions } from 'bull';
import { Redis } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError, QueueError } from '../utils/errors';

/**
 * Queue job data
 */
export interface QueueJobData<T = any> {
    id: string;
    type: string;
    payload: T;
    metadata?: Record<string, any>;
    attempts: number;
    maxAttempts: number;
    priority: number;
    delay?: number;
    timeout?: number;
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
}

/**
 * Queue job result
 */
export interface QueueJobResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    attempts: number;
    duration: number;
    completedAt: Date;
}

/**
 * Queue service configuration
 */
export interface QueueServiceConfig {
    redis: Redis;
    defaultJobOptions?: JobOptions;
    queueOptions?: QueueOptions;
}

/**
 * Queue processor function
 */
export type QueueProcessor<T = any> = (
    job: Job<QueueJobData<T>>
) => Promise<QueueJobResult<T>>;

/**
 * Queue event handlers
 */
export interface QueueEventHandlers {
    onCompleted?: (job: Job, result: any) => void;
    onFailed?: (job: Job, error: Error) => void;
    onStalled?: (job: Job) => void;
    onProgress?: (job: Job, progress: number) => void;
    onWaiting?: (job: Job) => void;
    onActive?: (job: Job) => void;
    onDelayed?: (job: Job) => void;
    onRemoved?: (job: Job) => void;
    onCleaned?: (jobs: Job[], type: string) => void;
    onDrained?: () => void;
    onPaused?: () => void;
    onResumed?: () => void;
}

/**
 * Bull queue service
 */
export class QueueService {
    private queues = new Map<string, Queue>();
    private processors = new Map<string, QueueProcessor>();
    private eventHandlers = new Map<string, QueueEventHandlers>();
    private config: QueueServiceConfig;

    constructor(config: QueueServiceConfig) {
        this.config = config;
        logger.info('Queue service initialized');
    }

    /**
     * Create queue
     */
    createQueue(name: string, options: Partial<QueueOptions> = {}): Queue {
        try {
            if (this.queues.has(name)) {
                return this.queues.get(name)!;
            }

            const queueOptions: QueueOptions = {
                redis: this.config.redis,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                    ...this.config.defaultJobOptions,
                },
                ...options,
            };

            const queue = new Bull(name, queueOptions);
            this.queues.set(name, queue);

            // Setup event handlers
            this.setupQueueEventHandlers(name, queue);

            logger.info('Queue created', { name });
            return queue;
        } catch (error) {
            logger.error('Failed to create queue', { error: error.message, name });
            throw new QueueError(`Failed to create queue: ${error.message}`);
        }
    }

    /**
     * Setup queue event handlers
     */
    private setupQueueEventHandlers(name: string, queue: Queue): void {
        const handlers = this.eventHandlers.get(name);

        if (handlers?.onCompleted) {
            queue.on('completed', handlers.onCompleted);
        }

        if (handlers?.onFailed) {
            queue.on('failed', handlers.onFailed);
        }

        if (handlers?.onStalled) {
            queue.on('stalled', handlers.onStalled);
        }

        if (handlers?.onProgress) {
            queue.on('progress', handlers.onProgress);
        }

        if (handlers?.onWaiting) {
            queue.on('waiting', handlers.onWaiting);
        }

        if (handlers?.onActive) {
            queue.on('active', handlers.onActive);
        }

        if (handlers?.onDelayed) {
            queue.on('delayed', handlers.onDelayed);
        }

        if (handlers?.onRemoved) {
            queue.on('removed', handlers.onRemoved);
        }

        if (handlers?.onCleaned) {
            queue.on('cleaned', handlers.onCleaned);
        }

        if (handlers?.onDrained) {
            queue.on('drained', handlers.onDrained);
        }

        if (handlers?.onPaused) {
            queue.on('paused', handlers.onPaused);
        }

        if (handlers?.onResumed) {
            queue.on('resumed', handlers.onResumed);
        }
    }

    /**
     * Register queue processor
     */
    registerProcessor<T = any>(
        queueName: string,
        processor: QueueProcessor<T>,
        options: {
            concurrency?: number;
            maxStalledCount?: number;
            stalledInterval?: number;
        } = {}
    ): void {
        try {
            const queue = this.getQueue(queueName);

            queue.process(
                options.concurrency || 1,
                async (job: Job<QueueJobData<T>>) => {
                    logger.debug('Processing job', {
                        queue: queueName,
                        jobId: job.id,
                        type: job.data.type,
                        attempts: job.attemptsMade,
                    });

                    try {
                        const result = await processor(job);

                        logger.debug('Job processed successfully', {
                            queue: queueName,
                            jobId: job.id,
                            type: job.data.type,
                            duration: Date.now() - job.processedOn!,
                        });

                        return result;
                    } catch (error) {
                        logger.error('Job processing failed', {
                            queue: queueName,
                            jobId: job.id,
                            type: job.data.type,
                            error: error.message,
                        });

                        throw error;
                    }
                }
            );

            this.processors.set(queueName, processor);
            logger.info('Processor registered', { queue: queueName });
        } catch (error) {
            logger.error('Failed to register processor', { error: error.message, queue: queueName });
            throw new QueueError(`Failed to register processor: ${error.message}`);
        }
    }

    /**
     * Add job to queue
     */
    async addJob<T = any>(
        queueName: string,
        type: string,
        payload: T,
        options: Partial<QueueJobData<T>> = {}
    ): Promise<Job<QueueJobData<T>>> {
        try {
            const queue = this.getQueue(queueName);

            const jobData: QueueJobData<T> = {
                id: require('crypto').randomUUID(),
                type,
                payload,
                attempts: 0,
                maxAttempts: 3,
                priority: 0,
                ...options,
            };

            const jobOptions: JobOptions = {
                priority: jobData.priority,
                delay: jobData.delay,
                timeout: jobData.timeout,
                removeOnComplete: jobData.removeOnComplete,
                removeOnFail: jobData.removeOnFail,
                attempts: jobData.maxAttempts,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            };

            const job = await queue.add(jobData, jobOptions);

            logger.info('Job added to queue', {
                queue: queueName,
                jobId: job.id,
                type: jobData.type,
                priority: jobData.priority,
                delay: jobData.delay,
            });

            return job;
        } catch (error) {
            logger.error('Failed to add job to queue', {
                error: error.message,
                queue: queueName,
                type
            });
            throw new QueueError(`Failed to add job to queue: ${error.message}`);
        }
    }

    /**
     * Add multiple jobs to queue
     */
    async addJobs<T = any>(
        queueName: string,
        jobs: Array<{
            type: string;
            payload: T;
            options?: Partial<QueueJobData<T>>;
        }>
    ): Promise<Job<QueueJobData<T>>[]> {
        try {
            const queue = this.getQueue(queueName);
            const addedJobs: Job<QueueJobData<T>>[] = [];

            for (const job of jobs) {
                const addedJob = await this.addJob(
                    queueName,
                    job.type,
                    job.payload,
                    job.options
                );
                addedJobs.push(addedJob);
            }

            logger.info('Multiple jobs added to queue', {
                queue: queueName,
                count: jobs.length,
            });

            return addedJobs;
        } catch (error) {
            logger.error('Failed to add multiple jobs to queue', {
                error: error.message,
                queue: queueName
            });
            throw new QueueError(`Failed to add multiple jobs to queue: ${error.message}`);
        }
    }

    /**
     * Get queue by name
     */
    private getQueue(name: string): Queue {
        const queue = this.queues.get(name);
        if (!queue) {
            throw new QueueError(`Queue not found: ${name}`);
        }
        return queue;
    }

    /**
     * Get job by ID
     */
    async getJob(queueName: string, jobId: string): Promise<Job | null> {
        try {
            const queue = this.getQueue(queueName);
            const job = await queue.getJob(jobId);

            logger.debug('Job retrieved', { queue: queueName, jobId });
            return job;
        } catch (error) {
            logger.error('Failed to get job', { error: error.message, queue: queueName, jobId });
            throw new QueueError(`Failed to get job: ${error.message}`);
        }
    }

    /**
     * Get queue jobs
     */
    async getJobs(
        queueName: string,
        status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused',
        start = 0,
        end = -1
    ): Promise<Job[]> {
        try {
            const queue = this.getQueue(queueName);
            const jobs = await queue.getJobs([status], start, end);

            logger.debug('Jobs retrieved', {
                queue: queueName,
                status,
                count: jobs.length
            });
            return jobs;
        } catch (error) {
            logger.error('Failed to get jobs', {
                error: error.message,
                queue: queueName,
                status
            });
            throw new QueueError(`Failed to get jobs: ${error.message}`);
        }
    }

    /**
     * Get queue stats
     */
    async getQueueStats(queueName: string): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
    }> {
        try {
            const queue = this.getQueue(queueName);

            const [
                waiting,
                active,
                completed,
                failed,
                delayed,
                paused,
            ] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
                queue.getDelayedCount(),
                queue.getPausedCount(),
            ]);

            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
                paused,
            };
        } catch (error) {
            logger.error('Failed to get queue stats', {
                error: error.message,
                queue: queueName
            });
            throw new QueueError(`Failed to get queue stats: ${error.message}`);
        }
    }

    /**
     * Pause queue
     */
    async pauseQueue(queueName: string): Promise<void> {
        try {
            const queue = this.getQueue(queueName);
            await queue.pause();

            logger.info('Queue paused', { queue: queueName });
        } catch (error) {
            logger.error('Failed to pause queue', { error: error.message, queue: queueName });
            throw new QueueError(`Failed to pause queue: ${error.message}`);
        }
    }

    /**
     * Resume queue
     */
    async resumeQueue(queueName: string): Promise<void> {
        try {
            const queue = this.getQueue(queueName);
            await queue.resume();

            logger.info('Queue resumed', { queue: queueName });
        } catch (error) {
            logger.error('Failed to resume queue', { error: error.message, queue: queueName });
            throw new QueueError(`Failed to resume queue: ${error.message}`);
        }
    }

    /**
     * Clean queue
     */
    async cleanQueue(
        queueName: string,
        grace: number,
        status: 'completed' | 'wait' | 'active' | 'delayed' | 'failed' | 'paused'
    ): Promise<Job[]> {
        try {
            const queue = this.getQueue(queueName);
            const jobs = await queue.clean(grace, status);

            logger.info('Queue cleaned', {
                queue: queueName,
                status,
                grace,
                count: jobs.length
            });
            return jobs;
        } catch (error) {
            logger.error('Failed to clean queue', {
                error: error.message,
                queue: queueName,
                status
            });
            throw new QueueError(`Failed to clean queue: ${error.message}`);
        }
    }

    /**
     * Remove job from queue
     */
    async removeJob(queueName: string, jobId: string): Promise<boolean> {
        try {
            const job = await this.getJob(queueName, jobId);
            if (!job) {
                return false;
            }

            await job.remove();
            logger.info('Job removed', { queue: queueName, jobId });
            return true;
        } catch (error) {
            logger.error('Failed to remove job', {
                error: error.message,
                queue: queueName,
                jobId
            });
            throw new QueueError(`Failed to remove job: ${error.message}`);
        }
    }

    /**
     * Retry failed job
     */
    async retryJob(queueName: string, jobId: string): Promise<void> {
        try {
            const job = await this.getJob(queueName, jobId);
            if (!job) {
                throw new QueueError('Job not found');
            }

            await job.retry();
            logger.info('Job retry initiated', { queue: queueName, jobId });
        } catch (error) {
            logger.error('Failed to retry job', {
                error: error.message,
                queue: queueName,
                jobId
            });
            throw new QueueError(`Failed to retry job: ${error.message}`);
        }
    }

    /**
     * Set queue event handlers
     */
    setQueueEventHandlers(queueName: string, handlers: QueueEventHandlers): void {
        this.eventHandlers.set(queueName, handlers);

        const queue = this.queues.get(queueName);
        if (queue) {
            this.setupQueueEventHandlers(queueName, queue);
        }
    }

    /**
     * Get all queue names
     */
    getQueueNames(): string[] {
        return Array.from(this.queues.keys());
    }

    /**
     * Disconnect all queues
     */
    async disconnect(): Promise<void> {
        try {
            const disconnectPromises = Array.from(this.queues.values()).map(queue =>
                queue.close()
            );

            await Promise.all(disconnectPromises);
            logger.info('All queues disconnected');
        } catch (error) {
            logger.error('Failed to disconnect queues', { error: error.message });
            throw new QueueError(`Failed to disconnect queues: ${error.message}`);
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        queues: Record<string, any>;
        error?: string;
    }> {
        try {
            const queueHealth: Record<string, any> = {};

            for (const [name, queue] of this.queues) {
                const stats = await this.getQueueStats(name);
                queueHealth[name] = {
                    connected: queue.client.status === 'ready',
                    stats,
                };
            }

            const allHealthy = Object.values(queueHealth).every(
                (q: any) => q.connected
            );

            return {
                status: allHealthy ? 'healthy' : 'unhealthy',
                queues: queueHealth,
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                queues: {},
                error: error.message,
            };
        }
    }
}

/**
 * Queue job priorities
 */
export enum QueueJobPriority {
    LOW = 10,
    NORMAL = 0,
    HIGH = -10,
    CRITICAL = -20,
}

/**
 * Predefined queue names
 */
export enum QueueName {
    EMAIL = 'email',
    NOTIFICATION = 'notification',
    EXPORT = 'export',
    IMPORT = 'import',
    AI_PROCESSING = 'ai-processing',
    FILE_PROCESSING = 'file-processing',
    CALENDAR_SYNC = 'calendar-sync',
    WEBHOOK = 'webhook',
    BACKUP = 'backup',
    CLEANUP = 'cleanup',
    INDEXING = 'indexing',
    ANALYTICS = 'analytics',
    REPORTING = 'reporting',
}

/**
 * Queue job types
 */
export enum QueueJobType {
    // Email jobs
    SEND_EMAIL = 'send-email',
    SEND_BULK_EMAIL = 'send-bulk-email',
    SEND_TEMPLATE_EMAIL = 'send-template-email',

    // Notification jobs
    SEND_PUSH_NOTIFICATION = 'send-push-notification',
    SEND_SMS = 'send-sms',
    SEND_IN_APP_NOTIFICATION = 'send-in-app-notification',

    // Export jobs
    EXPORT_PLANNER_PDF = 'export-planner-pdf',
    EXPORT_PLANNER_CSV = 'export-planner-csv',
    EXPORT_USER_DATA = 'export-user-data',

    // Import jobs
    IMPORT_CSV = 'import-csv',
    IMPORT_JSON = 'import-json',
    IMPORT_EXCEL = 'import-excel',

    // AI processing jobs
    GENERATE_AI_SUGGESTIONS = 'generate-ai-suggestions',
    ANALYZE_PRODUCTIVITY = 'analyze-productivity',
    OPTIMIZE_SCHEDULE = 'optimize-schedule',

    // File processing jobs
    PROCESS_UPLOADED_FILE = 'process-uploaded-file',
    GENERATE_THUMBNAIL = 'generate-thumbnail',
    EXTRACT_FILE_METADATA = 'extract-file-metadata',

    // Calendar sync jobs
    SYNC_GOOGLE_CALENDAR = 'sync-google-calendar',
    SYNC_OUTLOOK_CALENDAR = 'sync-outlook-calendar',
    SYNC_CALENDAR_EVENTS = 'sync-calendar-events',

    // Webhook jobs
    DELIVER_WEBHOOK = 'deliver-webhook',
    RETRY_WEBHOOK = 'retry-webhook',

    // Backup jobs
    CREATE_BACKUP = 'create-backup',
    RESTORE_BACKUP = 'restore-backup',
    CLEANUP_OLD_BACKUPS = 'cleanup-old-backups',

    // Cleanup jobs
    CLEANUP_TEMP_FILES = 'cleanup-temp-files',
    CLEANUP_OLD_SESSIONS = 'cleanup-old-sessions',
    CLEANUP_EXPIRED_DATA = 'cleanup-expired-data',

    // Indexing jobs
    UPDATE_SEARCH_INDEX = 'update-search-index',
    REBUILD_SEARCH_INDEX = 'rebuild-search-index',

    // Analytics jobs
    TRACK_EVENT = 'track-event',
    GENERATE_ANALYTICS_REPORT = 'generate-analytics-report',

    // Reporting jobs
    GENERATE_USAGE_REPORT = 'generate-usage-report',
    GENERATE_PERFORMANCE_REPORT = 'generate-performance-report',
}

/**
 * Queue processor registry
 */
export class QueueProcessorRegistry {
    private processors = new Map<string, QueueProcessor>();

    /**
     * Register processor
     */
    register(jobType: string, processor: QueueProcessor): void {
        this.processors.set(jobType, processor);
    }

    /**
     * Get processor
     */
    get(jobType: string): QueueProcessor | undefined {
        return this.processors.get(jobType);
    }

    /**
     * Get all processors
     */
    getAll(): Map<string, QueueProcessor> {
        return new Map(this.processors);
    }
}

/**
 * Queue service factory
 */
export class QueueServiceFactory {
    private static instance: QueueServiceFactory;
    private services = new Map<string, QueueService>();
    private processorRegistry = new QueueProcessorRegistry();

    private constructor() { }

    /**
     * Get factory instance
     */
    static getInstance(): QueueServiceFactory {
        if (!QueueServiceFactory.instance) {
            QueueServiceFactory.instance = new QueueServiceFactory();
        }
        return QueueServiceFactory.instance;
    }

    /**
     * Create queue service
     */
    createQueueService(config: QueueServiceConfig): QueueService {
        const serviceId = `queue_${Date.now()}`;
        const service = new QueueService(config);

        this.services.set(serviceId, service);
        return service;
    }

    /**
     * Get processor registry
     */
    getProcessorRegistry(): QueueProcessorRegistry {
        return this.processorRegistry;
    }

    /**
     * Create default queue service
     */
    createDefaultQueueService(redis: Redis): QueueService {
        const config: QueueServiceConfig = {
            redis,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        };

        return this.createQueueService(config);
    }
}

/**
 * Queue metrics collector
 */
export class QueueMetricsCollector {
    private metrics = new Map<string, any>();

    /**
     * Record job processing time
     */
    recordJobProcessingTime(queueName: string, jobType: string, duration: number): void {
        const key = `queue.${queueName}.${jobType}.processing_time`;
        this.recordMetric(key, duration);
    }

    /**
     * Record job success
     */
    recordJobSuccess(queueName: string, jobType: string): void {
        const key = `queue.${queueName}.${jobType}.success`;
        this.incrementMetric(key);
    }

    /**
     * Record job failure
     */
    recordJobFailure(queueName: string, jobType: string): void {
        const key = `queue.${queueName}.${jobType}.failure`;
        this.incrementMetric(key);
    }

    /**
     * Record queue size
     */
    recordQueueSize(queueName: string, status: string, count: number): void {
        const key = `queue.${queueName}.size.${status}`;
        this.setMetric(key, count);
    }

    /**
     * Record metric
     */
    private recordMetric(key: string, value: number): void {
        this.metrics.set(key, value);
    }

    /**
     * Increment metric
     */
    private incrementMetric(key: string): void {
        const current = this.metrics.get(key) || 0;
        this.metrics.set(key, current + 1);
    }

    /**
     * Set metric
     */
    private setMetric(key: string, value: number): void {
        this.metrics.set(key, value);
    }

    /**
     * Get metrics
     */
    getMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }

    /**
     * Clear metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
    }
}