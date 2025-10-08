import { Queue, QueueScheduler, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

interface QueueConfig {
    name: string;
    concurrency?: number;
    attempts?: number;
    backoff?: {
        type: string;
        delay: number;
    };
}

class QueueManager {
    private static instance: QueueManager;
    private queues: Map<string, Queue> = new Map();
    private workers: Map<string, Worker> = new Map();
    private queueSchedulers: Map<string, QueueScheduler> = new Map();
    private connection: Redis;

    private constructor() {
        this.connection = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });

        this.setupConnectionHandlers();
    }

    static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }

    private setupConnectionHandlers(): void {
        this.connection.on('error', (error) => {
            logger.error('Redis connection error in QueueManager:', error);
        });

        this.connection.on('connect', () => {
            logger.info('QueueManager Redis connection established');
        });
    }

    createQueue(config: QueueConfig): Queue {
        try {
            if (this.queues.has(config.name)) {
                return this.queues.get(config.name)!;
            }

            const queue = new Queue(config.name, {
                connection: this.connection,
                defaultJobOptions: {
                    attempts: config.attempts || 3,
                    backoff: config.backoff || { type: 'exponential', delay: 2000 },
                    removeOnComplete: { count: 100 },
                    removeOnFail: { count: 500 },
                },
            });

            this.queues.set(config.name, queue);
            logger.info(`Queue '${config.name}' created successfully`);

            return queue;
        } catch (error) {
            logger.error(`Failed to create queue '${config.name}':`, error);
            throw new AppError(`Queue creation failed: ${config.name}`, 500);
        }
    }

    createWorker(
        queueName: string,
        processor: (job: Job) => Promise<any>,
        concurrency: number = 10
    ): Worker {
        try {
            if (this.workers.has(queueName)) {
                return this.workers.get(queueName)!;
            }

            const worker = new Worker(queueName, processor, {
                connection: this.connection,
                concurrency,
                limiter: {
                    max: 100,
                    duration: 1000,
                },
            });

            this.setupWorkerHandlers(worker, queueName);
            this.workers.set(queueName, worker);

            return worker;
        } catch (error) {
            logger.error(`Failed to create worker for queue '${queueName}':`, error);
            throw new AppError(`Worker creation failed: ${queueName}`, 500);
        }
    }

    private setupWorkerHandlers(worker: Worker, queueName: string): void {
        worker.on('completed', (job: Job) => {
            logger.info(`Job ${job.id} in queue '${queueName}' completed`);
        });

        worker.on('failed', (job: Job | undefined, error: Error) => {
            logger.error(`Job ${job?.id} in queue '${queueName}' failed:`, error);
        });

        worker.on('error', (error: Error) => {
            logger.error(`Worker for queue '${queueName}' encountered error:`, error);
        });
    }

    createQueueScheduler(queueName: string): QueueScheduler {
        try {
            if (this.queueSchedulers.has(queueName)) {
                return this.queueSchedulers.get(queueName)!;
            }

            const scheduler = new QueueScheduler(queueName, {
                connection: this.connection,
            });

            this.queueSchedulers.set(queueName, scheduler);
            logger.info(`Queue scheduler for '${queueName}' created successfully`);

            return scheduler;
        } catch (error) {
            logger.error(`Failed to create queue scheduler for '${queueName}':`, error);
            throw new AppError(`Queue scheduler creation failed: ${queueName}`, 500);
        }
    }

    async addJob(queueName: string, data: any, options: any = {}): Promise<Job> {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new AppError(`Queue '${queueName}' not found`, 404);
        }

        try {
            const job = await queue.add(queueName, data, options);
            logger.info(`Job added to queue '${queueName}' with ID: ${job.id}`);
            return job;
        } catch (error) {
            logger.error(`Failed to add job to queue '${queueName}':`, error);
            throw new AppError(`Job addition failed: ${queueName}`, 500);
        }
    }

    async getJobCounts(queueName: string): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }> {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new AppError(`Queue '${queueName}' not found`, 404);
        }

        try {
            return await queue.getJobCounts();
        } catch (error) {
            logger.error(`Failed to get job counts for queue '${queueName}':`, error);
            throw new AppError(`Job count retrieval failed: ${queueName}`, 500);
        }
    }

    async closeQueue(queueName: string): Promise<void> {
        try {
            const queue = this.queues.get(queueName);
            const worker = this.workers.get(queueName);
            const scheduler = this.queueSchedulers.get(queueName);

            if (queue) {
                await queue.close();
                this.queues.delete(queueName);
            }

            if (worker) {
                await worker.close();
                this.workers.delete(queueName);
            }

            if (scheduler) {
                await scheduler.close();
                this.queueSchedulers.delete(queueName);
            }

            logger.info(`Queue '${queueName}' closed successfully`);
        } catch (error) {
            logger.error(`Error closing queue '${queueName}':`, error);
            throw new AppError(`Queue close failed: ${queueName}`, 500);
        }
    }

    async closeAll(): Promise<void> {
        try {
            const queueNames = Array.from(this.queues.keys());

            await Promise.all(
                queueNames.map(queueName => this.closeQueue(queueName))
            );

            await this.connection.quit();
            logger.info('All queues and connections closed successfully');
        } catch (error) {
            logger.error('Error closing all queues:', error);
            throw new AppError('Failed to close all queues', 500);
        }
    }

    getQueueNames(): string[] {
        return Array.from(this.queues.keys());
    }

    getQueue(queueName: string): Queue | undefined {
        return this.queues.get(queueName);
    }

    getWorker(queueName: string): Worker | undefined {
        return this.workers.get(queueName);
    }
}

// Export singleton instance
export const queueManager = QueueManager.getInstance();
export default queueManager;