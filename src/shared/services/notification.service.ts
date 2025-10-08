// src/shared/services/notification.service.ts

import { injectable, inject } from 'inversify';
import { EmailService } from './email.service';
import { CacheService } from './cache.service';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

export interface NotificationPayload {
    userId: string;
    email?: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    data?: Record<string, any>;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    channels: ('email' | 'push' | 'in-app' | 'sms')[];
    scheduledFor?: Date;
}

export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    inApp: boolean;
    sms: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    quietHours: {
        enabled: boolean;
        start: string; // HH:MM format
        end: string;   // HH:MM format
    };
}

@injectable()
export class NotificationService {
    constructor(
        @inject(EmailService) private emailService: EmailService,
        @inject(CacheService) private cacheService: CacheService
    ) { }

    async sendNotification(payload: NotificationPayload): Promise<void> {
        try {
            // Check if notification is scheduled for later
            if (payload.scheduledFor && payload.scheduledFor > new Date()) {
                await this.scheduleNotification(payload);
                return;
            }

            // Check user preferences
            const preferences = await this.getUserPreferences(payload.userId);

            // Filter channels based on preferences
            const enabledChannels = payload.channels.filter(channel =>
                preferences[channel as keyof NotificationPreferences] === true
            );

            // Check quiet hours
            if (this.isInQuietHours(preferences)) {
                if (payload.priority === 'low' || payload.priority === 'medium') {
                    // Schedule for after quiet hours
                    const resumeTime = this.getQuietHoursEndTime(preferences.quietHours);
                    await this.scheduleNotification({ ...payload, scheduledFor: resumeTime });
                    return;
                }
            }

            // Send through enabled channels
            const promises = enabledChannels.map(channel =>
                this.sendThroughChannel(channel, payload)
            );

            await Promise.allSettled(promises);

            // Store in-app notification
            if (enabledChannels.includes('in-app')) {
                await this.storeInAppNotification(payload);
            }

            logger.info(`Notification sent to user ${payload.userId} through channels: ${enabledChannels.join(', ')}`);
        } catch (error) {
            logger.error('Error sending notification:', error);
            throw new AppError('Failed to send notification', 500);
        }
    }

    async sendBulkNotifications(payloads: NotificationPayload[]): Promise<{ success: number; failed: number }> {
        const results = { success: 0, failed: 0 };

        // Process in batches of 50 to avoid overwhelming the system
        const batchSize = 50;
        for (let i = 0; i < payloads.length; i += batchSize) {
            const batch = payloads.slice(i, i + batchSize);
            const promises = batch.map(async (payload) => {
                try {
                    await this.sendNotification(payload);
                    results.success++;
                } catch (error) {
                    results.failed++;
                    logger.error('Error in bulk notification:', error);
                }
            });

            await Promise.all(promises);
        }

        logger.info(`Bulk notification completed. Success: ${results.success}, Failed: ${results.failed}`);
        return results;
    }

    async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<{
        notifications: any[];
        total: number;
        unread: number;
    }> {
        try {
            const cacheKey = `notifications_${userId}_${limit}_${offset}`;
            const cached = await this.cacheService.get(cacheKey);

            if (cached) {
                return cached;
            }

            // This would typically fetch from database
            // For now, return mock data structure
            const notifications = [
                {
                    id: 'notif_1',
                    title: 'Welcome to AI Planner',
                    message: 'Your account has been created successfully.',
                    type: 'success',
                    priority: 'medium',
                    read: false,
                    createdAt: new Date().toISOString(),
                    data: {}
                }
            ];

            const result = {
                notifications,
                total: notifications.length,
                unread: notifications.filter(n => !n.read).length
            };

            // Cache for 5 minutes
            await this.cacheService.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            logger.error('Error fetching user notifications:', error);
            throw new AppError('Failed to fetch notifications', 500);
        }
    }

    async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
        try {
            // This would typically update in database
            logger.info(`Notification ${notificationId} marked as read for user ${userId}`);
        } catch (error) {
            logger.error('Error marking notification as read:', error);
            throw new AppError('Failed to mark notification as read', 500);
        }
    }

    async markAllNotificationsAsRead(userId: string): Promise<void> {
        try {
            // This would typically update in database
            logger.info(`All notifications marked as read for user ${userId}`);
        } catch (error) {
            logger.error('Error marking all notifications as read:', error);
            throw new AppError('Failed to mark notifications as read', 500);
        }
    }

    async deleteNotification(userId: string, notificationId: string): Promise<void> {
        try {
            // This would typically delete from database
            logger.info(`Notification ${notificationId} deleted for user ${userId}`);
        } catch (error) {
            logger.error('Error deleting notification:', error);
            throw new AppError('Failed to delete notification', 500);
        }
    }

    async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
        try {
            const currentPrefs = await this.getUserPreferences(userId);
            const updatedPrefs = { ...currentPrefs, ...preferences };

            await this.cacheService.set(`user_prefs_${userId}`, updatedPrefs, 86400); // 24 hours
            logger.info(`Notification preferences updated for user ${userId}`);

            return updatedPrefs;
        } catch (error) {
            logger.error('Error updating user preferences:', error);
            throw new AppError('Failed to update preferences', 500);
        }
    }

    async getUserPreferences(userId: string): Promise<NotificationPreferences> {
        try {
            const cached = await this.cacheService.get(`user_prefs_${userId}`);
            if (cached) {
                return cached;
            }

            // Default preferences
            const defaultPrefs: NotificationPreferences = {
                email: true,
                push: true,
                inApp: true,
                sms: false,
                frequency: 'immediate',
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00'
                }
            };

            // In a real implementation, this would fetch from database
            await this.cacheService.set(`user_prefs_${userId}`, defaultPrefs, 86400);
            return defaultPrefs;
        } catch (error) {
            logger.error('Error fetching user preferences:', error);
            return {
                email: true,
                push: true,
                inApp: true,
                sms: false,
                frequency: 'immediate',
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00'
                }
            };
        }
    }

    private async sendThroughChannel(channel: string, payload: NotificationPayload): Promise<void> {
        switch (channel) {
            case 'email':
                await this.sendEmailNotification(payload);
                break;
            case 'push':
                await this.sendPushNotification(payload);
                break;
            case 'sms':
                await this.sendSMSNotification(payload);
                break;
            default:
                logger.warn(`Unknown notification channel: ${channel}`);
        }
    }

    private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
        if (!payload.email) {
            logger.warn(`No email provided for user ${payload.userId}`);
            return;
        }

        try {
            await this.emailService.sendEmail({
                to: payload.email,
                subject: payload.title,
                template: 'notification',
                data: {
                    title: payload.title,
                    message: payload.message,
                    type: payload.type,
                    ...payload.data
                }
            });
        } catch (error) {
            logger.error('Error sending email notification:', error);
            throw error;
        }
    }

    private async sendPushNotification(payload: NotificationPayload): Promise<void> {
        // This would integrate with a push notification service like Firebase Cloud Messaging
        logger.info(`Push notification would be sent to user ${payload.userId}: ${payload.title}`);
    }

    private async sendSMSNotification(payload: NotificationPayload): Promise<void> {
        // This would integrate with an SMS service like Twilio
        logger.info(`SMS notification would be sent to user ${payload.userId}: ${payload.title}`);
    }

    private async storeInAppNotification(payload: NotificationPayload): Promise<void> {
        try {
            // This would typically store in database
            const notification = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: payload.userId,
                title: payload.title,
                message: payload.message,
                type: payload.type,
                priority: payload.priority,
                data: payload.data || {},
                read: false,
                createdAt: new Date().toISOString()
            };

            // Invalidate user's notification cache
            await this.cacheService.del(`notifications_${payload.userId}_*`);

            logger.info(`In-app notification stored for user ${payload.userId}`);
        } catch (error) {
            logger.error('Error storing in-app notification:', error);
        }
    }

    private async scheduleNotification(payload: NotificationPayload): Promise<void> {
        try {
            // Store scheduled notification
            const scheduledNotif = {
                ...payload,
                id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: 'scheduled'
            };

            // In a real implementation, this would use a job queue like BullMQ
            // For now, we'll just log it
            logger.info(`Notification scheduled for ${payload.scheduledFor?.toISOString()} for user ${payload.userId}`);

            // Simulate scheduled execution (in production, use a proper job scheduler)
            const delay = payload.scheduledFor!.getTime() - Date.now();
            if (delay > 0 && delay < 86400000) { // Only schedule if within 24 hours
                setTimeout(() => {
                    this.sendNotification({ ...payload, scheduledFor: undefined })
                        .catch(error => logger.error('Error sending scheduled notification:', error));
                }, delay);
            }
        } catch (error) {
            logger.error('Error scheduling notification:', error);
        }
    }

    private isInQuietHours(preferences: NotificationPreferences): boolean {
        if (!preferences.quietHours.enabled) {
            return false;
        }

        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const { start, end } = preferences.quietHours;

        if (start < end) {
            return currentTime >= start && currentTime < end;
        } else {
            // Quiet hours span midnight
            return currentTime >= start || currentTime < end;
        }
    }

    private getQuietHoursEndTime(quietHours: { start: string; end: string }): Date {
        const now = new Date();
        const [endHour, endMinute] = quietHours.end.split(':').map(Number);

        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);

        // If end time has already passed today, set it for tomorrow
        if (endTime <= now) {
            endTime.setDate(endTime.getDate() + 1);
        }

        return endTime;
    }
}