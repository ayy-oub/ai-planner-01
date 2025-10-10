// src/shared/processors/job-processors.ts  (or wherever your processors live)
import { Job } from 'bullmq';
import { logger } from '../../shared/utils/logger';
import { emailService } from '../../shared/services/email.service';
import { cacheService } from '../../shared/services/cache.service';
import { notificationService } from '../../shared/services/notification.service'; // adjust path if needed


/* ------------------------------------------------------------------ */
/* Email processor                                                    */
/* ------------------------------------------------------------------ */
export const emailProcessor = async (job: Job): Promise<void> => {
    const { type, data } = job.data;

    try {
        logger.info(`Processing email job ${job.id} of type ${type}`);

        switch (type) {
            case 'welcome':
                await emailService.sendWelcomeEmail(data.to, data.name, data.appUrl);
                break;
            case 'password-reset':
                await emailService.sendPasswordResetEmail(data.to, data.name, data.resetUrl, data.expiryHours);
                break;
            case 'email-verification':
                await emailService.sendEmailVerificationEmail(data.to, data.name, data.verificationUrl, data.expiryHours);
                break;
            case 'notification':
                await emailService.sendTemplate(
                    'notification',
                    data.to,
                    { title: data.title, message: data.message, type: data.type, ...data },
                    { subject: data.subject || 'Notification' }
                );
                break;
            default:
                throw new Error(`Unknown email type: ${type}`);
        }

        logger.info(`Email job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Email job ${job.id} failed:`, error);
        throw error;
    }
};

/* ------------------------------------------------------------------ */
/* Cache processor  (REAL implementations)                            */
/* ------------------------------------------------------------------ */
export const cacheProcessor = async (job: Job): Promise<void> => {
    const { operation, data } = job.data;

    try {
        logger.info(`Processing cache job ${job.id} with operation ${operation}`);

        switch (operation) {
            case 'invalidate':
                // data.pattern required
                await cacheService.clear(data.pattern);
                break;

            case 'warm-up':
                // data: Array<{ key: string; value: any; ttl?: number }>
                await cacheService.setMany(data.entries);
                break;

            case 'refresh':
                // data: { key: string; value: any; ttl?: number }
                await cacheService.set(data.key, data.value, { ttl: data.ttl });
                break;

            default:
                throw new Error(`Unknown cache operation: ${operation}`);
        }

        logger.info(`Cache job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Cache job ${job.id} failed:`, error);
        throw error;
    }
};

/* ------------------------------------------------------------------ */
/* Notification processor  (uses real NotificationService)              */
/* ------------------------------------------------------------------ */

export const notificationProcessor = async (job: Job): Promise<void> => {
  const { type, data } = job.data;

  try {
    logger.info(`Processing notification job ${job.id} of type ${type}`);

    switch (type) {
      case 'push':
        await notificationService.sendNotification({
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.severity || 'info',
          priority: data.priority || 'medium',
          channels: ['push'],
          data: data.payload || {},
        });
        break;

      case 'sms':
        await notificationService.sendNotification({
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.severity || 'info',
          priority: data.priority || 'medium',
          channels: ['sms'],
          data: data.payload || {},
        });
        break;

      case 'in-app':
        await notificationService.sendNotification({
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.severity || 'info',
          priority: data.priority || 'medium',
          channels: ['in-app'],
          data: data.payload || {},
        });
        break;

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    logger.info(`Notification job ${job.id} completed successfully`);
  } catch (error) {
    logger.error(`Notification job ${job.id} failed:`, error);
    throw error;
  }
};

/* ------------------------------------------------------------------ */
/* AI processor                                                       */
/* ------------------------------------------------------------------ */
export const aiProcessor = async (job: Job): Promise<any> => {
    const { type, data } = job.data;

    try {
        logger.info(`Processing AI job ${job.id} of type ${type}`);

        switch (type) {
            case 'task-suggestion':
                return await processTaskSuggestions(data);
            case 'schedule-optimization':
                return await processScheduleOptimization(data);
            case 'productivity-analysis':
                return await processProductivityAnalysis(data);
            default:
                throw new Error(`Unknown AI processing type: ${type}`);
        }
    } catch (error) {
        logger.error(`AI job ${job.id} failed:`, error);
        throw error;
    }
};

/* ------------------------------------------------------------------ */
/* Export processor                                                   */
/* ------------------------------------------------------------------ */
export const exportProcessor = async (job: Job): Promise<void> => {
    const { type, data } = job.data;

    try {
        logger.info(`Processing export job ${job.id} of type ${type}`);

        switch (type) {
            case 'pdf':
                await processPdfExport(data);
                break;
            case 'calendar':
                await processCalendarExport(data);
                break;
            case 'handwriting':
                await processHandwritingExport(data);
                break;
            default:
                throw new Error(`Unknown export type: ${type}`);
        }

        logger.info(`Export job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Export job ${job.id} failed:`, error);
        throw error;
    }
};



/* ------------------------------------------------------------------ */
/* Helper functions (unchanged – keep your stubs or replace later)   */
/* ------------------------------------------------------------------ */
async function processTaskSuggestions(data: any): Promise<any> {
    logger.info('Processing task suggestions with data:', data);
    await new Promise(r => setTimeout(r, 2000));
    return { suggestions: [{ task: 'Complete project documentation', priority: 'high' }], confidence: 0.85 };
}

async function processScheduleOptimization(data: any): Promise<any> {
    logger.info('Processing schedule optimization with data:', data);
    await new Promise(r => setTimeout(r, 3000));
    return { optimizedSchedule: [{ time: '09:00', task: 'Morning standup' }], efficiency: 0.92 };
}

async function processProductivityAnalysis(data: any): Promise<any> {
    logger.info('Processing productivity analysis with data:', data);
    await new Promise(r => setTimeout(r, 1500));
    return { score: 78, insights: ['Peak productivity hours: 10 AM - 12 PM'], recommendations: ['Block 2-hour focus time'] };
}

async function processPdfExport(data: any): Promise<void> {
    logger.info('Processing PDF export with data:', data);
    await new Promise(r => setTimeout(r, 1000));
}

async function processCalendarExport(data: any): Promise<void> {
    logger.info('Processing calendar export with data:', data);
    await new Promise(r => setTimeout(r, 800));
}

async function processHandwritingExport(data: any): Promise<void> {
    logger.info('Processing handwriting export with data:', data);
    await new Promise(r => setTimeout(r, 2000));
}

/* ------------------------------------------------------------------ */
/* Job progress helpers (unchanged)                                   */
/* ------------------------------------------------------------------ */
export const updateJobProgress = async (job: Job, progress: number): Promise<void> => {
    try {
        await job.updateProgress(progress);
        logger.info(`Job ${job.id} progress: ${progress}%`);
    } catch (error) {
        logger.error(`Failed to update job ${job.id} progress:`, error);
    }
};

export const updateJobData = async (job: Job, data: any): Promise<void> => {
    try {
      await job.updateData(data);
      logger.info(`Job ${job.id} data updated`);
    } catch (error) {
      logger.error(`Failed to update job ${job.id} data:`, error);
    }
  };