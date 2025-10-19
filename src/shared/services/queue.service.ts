/* ------------------------------------------------------------------ */
/* queue.service.ts  –  fixed, slim, drop-in replacement              */
/* ------------------------------------------------------------------ */
import Bull, { Job, JobOptions, Queue, QueueOptions } from 'bull';
import { RedisOptions } from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { QueueError } from '../utils/errors';

/* ======================  public types  ============================ */
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

export interface QueueJobResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  duration: number;
  completedAt: Date;
}

export interface QueueServiceConfig {
  redis: RedisOptions;          // <- connection options only
  defaultJobOptions?: JobOptions;
  queueOptions?: QueueOptions;
}

export type QueueProcessor<T = any> = (
  job: Job<QueueJobData<T>>
) => Promise<QueueJobResult<T>>;

export interface QueueEventHandlers {
  onCompleted?: (job: Job, result: any) => void;
  onFailed?: (job: Job, err: Error) => void;
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

/* ======================  service  ================================= */
export class QueueService {
  private readonly queues = new Map<string, Queue>();
  private readonly processors = new Map<string, QueueProcessor>();
  private readonly handlers = new Map<string, QueueEventHandlers>();
  private readonly config: QueueServiceConfig;

  constructor(cfg: QueueServiceConfig) {
    this.config = cfg;
    logger.info('QueueService instantiated');
  }

  /* ---------------  life-cycle  ----------------------------------- */
  createQueue(name: string, opts: Partial<QueueOptions> = {}): Queue {
    if (this.queues.has(name)) return this.queues.get(name)!;
    const queue = new Bull(name, this.buildOpts(opts));
    this.queues.set(name, queue);
    this.attachHandlers(name, queue);
    logger.info('Queue created', { name });
    return queue;
  }

  private buildOpts(user: Partial<QueueOptions>): QueueOptions {
    const base: JobOptions = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...this.config.defaultJobOptions,
    };
    return { redis: this.config.redis, defaultJobOptions: base, ...user };
  }

  /* ---------------  processor  ------------------------------------ */
  registerProcessor<T = any>(
    queueName: string,
    processor: QueueProcessor<T>,
    { concurrency = 1 } = {}
  ): void {
    const queue = this.getQueue(queueName);
    queue.process(concurrency, this.wrap(queueName, processor));
    this.processors.set(queueName, processor as QueueProcessor);
    logger.info('Processor registered', { queue: queueName });
  }

  private wrap<T>(queueName: string, fn: QueueProcessor<T>) {
    return async (job: Job<QueueJobData<T>>): Promise<QueueJobResult<T>> => {
      const start = Date.now();
      logger.debug('Processing job', {
        queue: queueName,
        jobId: job.id,
        type: job.data.type,
        attempts: job.attemptsMade,
      });
      try {
        const result = await fn(job);
        logger.debug('Job processed successfully', {
          queue: queueName,
          jobId: job.id,
          type: job.data.type,
          duration: Date.now() - start,
        });
        return result;
      } catch (err: any) {
        logger.error('Job processing failed', {
          queue: queueName,
          jobId: job.id,
          type: job.data.type,
          error: err.message,
        });
        throw err;
      }
    };
  }

  /* ---------------  job CRUD  ------------------------------------- */
  async addJob<T = any>(
    queueName: string,
    type: string,
    payload: T,
    options: Partial<QueueJobData<T>> = {}
  ): Promise<Job<QueueJobData<T>>> {
    const queue = this.getQueue(queueName);
    const data: QueueJobData<T> = {
      id: randomUUID(),
      type,
      payload,
      attempts: 0,
      maxAttempts: 3,
      priority: 0,
      ...options,
    };
    const jobOpts: JobOptions = {
      priority: data.priority,
      delay: data.delay,
      timeout: data.timeout,
      removeOnComplete: data.removeOnComplete,
      removeOnFail: data.removeOnFail,
      attempts: data.maxAttempts,
      backoff: { type: 'exponential', delay: 2000 },
    };
    const job = await queue.add(data, jobOpts);
    logger.info('Job added', {
      queue: queueName,
      jobId: job.id,
      type: data.type,
      priority: data.priority,
      delay: data.delay,
    });
    return job;
  }

  async addJobs<T = any>(
    queueName: string,
    jobs: Array<{ type: string; payload: T; options?: Partial<QueueJobData<T>> }>
  ): Promise<Job<QueueJobData<T>>[]> {
    const added: Job<QueueJobData<T>>[] = [];
    for (const j of jobs) added.push(await this.addJob(queueName, j.type, j.payload, j.options));
    logger.info('Multiple jobs added', { queue: queueName, count: jobs.length });
    return added;
  }

  /* ---------------  introspection  -------------------------------- */
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    return this.getQueue(queueName).getJob(jobId);
  }

  async getJobs(
    queueName: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused',
    start = 0,
    end = -1
  ): Promise<Job[]> {
    return this.getQueue(queueName).getJobs([status], start, end);
  }

  async getQueueStats(queueName: string) {
    const q = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getDelayedCount(),
      q.getPausedCount(),
    ]);
    return { waiting, active, completed, failed, delayed, paused };
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /* ---------------  control  -------------------------------------- */
  async pauseQueue(queueName: string): Promise<void> {
    await this.getQueue(queueName).pause();
    logger.info('Queue paused', { queue: queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    await this.getQueue(queueName).resume();
    logger.info('Queue resumed', { queue: queueName });
  }

  async cleanQueue(
    queueName: string,
    grace: number,
    status: 'completed' | 'wait' | 'active' | 'delayed' | 'failed' | 'paused'
  ): Promise<Job[]> {
    const jobs = await this.getQueue(queueName).clean(grace, status);
    logger.info('Queue cleaned', { queue: queueName, status, grace, count: jobs.length });
    return jobs;
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (!job) return false;
    await job.remove();
    logger.info('Job removed', { queue: queueName, jobId });
    return true;
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (!job) throw new QueueError('Job not found');
    await job.retry();
    logger.info('Job retry initiated', { queue: queueName, jobId });
  }

  /* ---------------  event handling  ------------------------------- */
  setQueueEventHandlers(queueName: string, h: QueueEventHandlers): void {
    this.handlers.set(queueName, h);
    const queue = this.queues.get(queueName);
    if (queue) this.attachHandlers(queueName, queue);
  }

  private attachHandlers(name: string, queue: Queue): void {
    const h = this.handlers.get(name) ?? {};
    const entries = [
      ['completed', h.onCompleted],
      ['failed', h.onFailed],
      ['stalled', h.onStalled],
      ['progress', h.onProgress],
      ['waiting', h.onWaiting],
      ['active', h.onActive],
      ['delayed', h.onDelayed],
      ['removed', h.onRemoved],
      ['cleaned', h.onCleaned],
      ['drained', h.onDrained],
      ['paused', h.onPaused],
      ['resumed', h.onResumed],
    ] as const;
    entries.forEach(([event, handler]) => {
      if (handler) queue.on(event, handler as any);
    });
  }

  /* ---------------  graceful shutdown  ---------------------------- */
  async disconnect(): Promise<void> {
    await Promise.all(Array.from(this.queues.values(), q => q.close()));
    logger.info('All queues disconnected');
  }

  /* ---------------  health  --------------------------------------- */
  async healthCheck() {
    const health: Record<string, any> = {};
    for (const [name, q] of this.queues) {
      health[name] = {
        connected: q.client.status === 'ready',
        stats: await this.getQueueStats(name).catch(() => null),
      };
    }
    const allHealthy = Object.values(health).every((h: any) => h.connected);
    return { status: allHealthy ? 'healthy' : 'unhealthy', queues: health };
  }

  /* ---------------  helpers  -------------------------------------- */
  private getQueue(name: string): Queue {
    const q = this.queues.get(name);
    if (!q) throw new QueueError(`Queue "${name}" not found`);
    return q;
  }
}

/* ======================  convenience enums  ======================== */
export enum QueueJobPriority {
  LOW = 10,
  NORMAL = 0,
  HIGH = -10,
  CRITICAL = -20,
}

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

export enum QueueJobType {
  SEND_EMAIL = 'send-email',
  SEND_WELCOME_EMAIL = 'send-welcome-email',
  SEND_BULK_EMAIL = 'send-bulk-email',
  SEND_TEMPLATE_EMAIL = 'send-template-email',
  SEND_PUSH_NOTIFICATION = 'send-push-notification',
  SEND_SMS = 'send-sms',
  SEND_IN_APP_NOTIFICATION = 'send-in-app-notification',
  EXPORT_PLANNER_PDF = 'export-planner-pdf',
  EXPORT_PLANNER_CSV = 'export-planner-csv',
  EXPORT_USER_DATA = 'export-user-data',
  IMPORT_CSV = 'import-csv',
  IMPORT_JSON = 'import-json',
  IMPORT_EXCEL = 'import-excel',
  GENERATE_AI_SUGGESTIONS = 'generate-ai-suggestions',
  ANALYZE_PRODUCTIVITY = 'analyze-productivity',
  OPTIMIZE_SCHEDULE = 'optimize-schedule',
  PROCESS_UPLOADED_FILE = 'process-uploaded-file',
  GENERATE_THUMBNAIL = 'generate-thumbnail',
  EXTRACT_FILE_METADATA = 'extract-file-metadata',
  SYNC_GOOGLE_CALENDAR = 'sync-google-calendar',
  SYNC_OUTLOOK_CALENDAR = 'sync-outlook-calendar',
  SYNC_CALENDAR_EVENTS = 'sync-calendar-events',
  DELIVER_WEBHOOK = 'deliver-webhook',
  RETRY_WEBHOOK = 'retry-webhook',
  CREATE_BACKUP = 'create-backup',
  RESTORE_BACKUP = 'restore-backup',
  CLEANUP_OLD_BACKUPS = 'cleanup-old-backups',
  CLEANUP_TEMP_FILES = 'cleanup-temp-files',
  CLEANUP_OLD_SESSIONS = 'cleanup-old-sessions',
  CLEANUP_EXPIRED_DATA = 'cleanup-expired-data',
  UPDATE_SEARCH_INDEX = 'update-search-index',
  REBUILD_SEARCH_INDEX = 'rebuild-search-index',
  TRACK_EVENT = 'track-event',
  GENERATE_ANALYTICS_REPORT = 'generate-analytics-report',
  GENERATE_USAGE_REPORT = 'generate-usage-report',
  GENERATE_PERFORMANCE_REPORT = 'generate-performance-report',
}

/* re-export helper */
export { randomUUID };