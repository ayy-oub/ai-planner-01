/* ===================================================================
 * queue-manager.ts  –  bullmq-based, singleton, scheduler-free
 * =================================================================== */
import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

/* ------------------------------------------------------------------ */
interface QueueConfig {
  name: string;
  concurrency?: number;
  attempts?: number;
  backoff?: { type: string; delay: number };
}

/* ------------------------------------------------------------------ */
class QueueManager {
  private static instance: QueueManager;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private connection: IORedis;

  /* ---------------  ctor / singleton  ----------------------------- */
  private constructor() {
    this.connection = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.connection.on('error', (err) =>
      logger.error('Redis connection error in QueueManager:', err)
    );
    this.connection.on('connect', () =>
      logger.info('QueueManager Redis connection established')
    );
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) QueueManager.instance = new QueueManager();
    return QueueManager.instance;
  }

  /* ---------------  queue  ---------------------------------------- */
  createQueue(cfg: QueueConfig): Queue {
    if (this.queues.has(cfg.name)) return this.queues.get(cfg.name)!;

    const queue = new Queue(cfg.name, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: cfg.attempts ?? 3,
        backoff: cfg.backoff ?? { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });

    this.queues.set(cfg.name, queue);
    logger.info('Queue created', { name: cfg.name });
    return queue;
  }

  /* ---------------  worker  --------------------------------------- */
  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    concurrency = 10
  ): Worker {
    if (this.workers.has(queueName)) return this.workers.get(queueName)!;

    const worker = new Worker(queueName, processor, {
      connection: this.connection,
      concurrency,
      limiter: { max: 100, duration: 1000 },
    } as WorkerOptions);

    this.setupWorkerHandlers(worker, queueName);
    this.workers.set(queueName, worker);
    return worker;
  }

  private setupWorkerHandlers(worker: Worker, queueName: string): void {
    worker.on('completed', (job) =>
      logger.info('Job completed', { queue: queueName, jobId: job.id })
    );
    worker.on('failed', (job, err) =>
      logger.error('Job failed', { queue: queueName, jobId: job?.id, error: err })
    );
    worker.on('error', (err) =>
      logger.error('Worker error', { queue: queueName, error: err })
    );
  }

  /* ---------------  job  ------------------------------------------ */
  async addJob(queueName: string, data: any, opts: any = {}): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new AppError(`Queue '${queueName}' not found`, 404);

    try {
      const job = await queue.add(queueName, data, opts);
      logger.info('Job added', { queue: queueName, jobId: job.id });
      return job;
    } catch (err: any) {
      logger.error('Failed to add job', { queue: queueName, error: err });
      throw new AppError(`Job addition failed: ${queueName}`, 500);
    }
  }

  /* ---------------  stats  ---------------------------------------- */
  async getJobCounts(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new AppError(`Queue '${queueName}' not found`, 404);

    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
      );
      // bullmq returns a generic index-signature object; pick the keys we need
      return {
        waiting: counts.waiting ?? 0,
        active:  counts.active  ?? 0,
        completed: counts.completed ?? 0,
        failed:  counts.failed  ?? 0,
        delayed: counts.delayed ?? 0,
      };
    } catch (err: any) {
      logger.error('Failed to get job counts', { queue: queueName, error: err });
      throw new AppError(`Job count retrieval failed: ${queueName}`, 500);
    }
  }

  /* ---------------  teardown  ------------------------------------- */
  async closeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    const worker = this.workers.get(queueName);

    await Promise.all([
      queue?.close(),
      worker?.close(),
    ]);

    this.queues.delete(queueName);
    this.workers.delete(queueName);
    logger.info('Queue closed', { name: queueName });
  }

  async closeAll(): Promise<void> {
    const names = Array.from(this.queues.keys());
    await Promise.all(names.map((n) => this.closeQueue(n)));
    await this.connection.quit();
    logger.info('All queues and Redis connection closed');
  }

  /* ---------------  getters  -------------------------------------- */
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

/* ------------------------------------------------------------------ */
export const queueManager = QueueManager.getInstance();
export default queueManager;