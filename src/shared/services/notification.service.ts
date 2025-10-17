// src/shared/services/notification.service.ts
import { injectable, inject } from 'inversify';
import {emailService, EmailService } from './email.service';
import {CacheService } from './cache.service';
import { getMessaging, Messaging, MulticastMessage } from 'firebase-admin/messaging';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import firebaseConnection from '@/infrastructure/database/firebase';
;

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export interface NotificationPayload {
  userId: string;
  email?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  data?: Record<string, unknown>;
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
    start: string; // HH:mm
    end: string;
  };
}

/* ------------------------------------------------------------------ */
/* Service                                                            */
/* ------------------------------------------------------------------ */
@injectable()
export class NotificationService {
  private readonly messaging: Messaging;

  constructor(
    @inject(EmailService) private emailService: EmailService,
    @inject(CacheService) private cacheService: CacheService
  ) {
    this.messaging = getMessaging(firebaseConnection.getApp());
  }

  /* ========================================================== */
  /* Public API  (unchanged signatures)                         */
  /* ========================================================== */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      if (payload.scheduledFor && payload.scheduledFor > new Date()) {
        await this.scheduleNotification(payload);
        return;
      }

      const prefs = await this.getUserPreferences(payload.userId);
      const enabled = payload.channels.filter(ch => prefs[ch as keyof NotificationPreferences] === true);

      if (this.isInQuietHours(prefs) && ['low', 'medium'].includes(payload.priority)) {
        const resume = this.getQuietHoursEndTime(prefs.quietHours);
        await this.scheduleNotification({ ...payload, scheduledFor: resume });
        return;
      }

      await Promise.allSettled(enabled.map(ch => this.sendThroughChannel(ch, payload)));

      if (enabled.includes('in-app')) await this.storeInAppNotification(payload);

      logger.info(`Notification sent to user ${payload.userId} through channels: ${enabled.join(', ')}`);
    } catch (err) {
      logger.error('Error sending notification:', err);
      throw new AppError('Failed to send notification', 500);
    }
  }

  async sendBulkNotifications(payloads: NotificationPayload[]): Promise<{ success: number; failed: number }> {
    const res = { success: 0, failed: 0 };
    const batch = 50;
    for (let i = 0; i < payloads.length; i += batch) {
      const slice = payloads.slice(i, i + batch);
      await Promise.allSettled(slice.map(async p => {
        try { await this.sendNotification(p); res.success++; }
        catch { res.failed++; }
      }));
    }
    logger.info(`Bulk notification completed. Success: ${res.success}, Failed: ${res.failed}`);
    return res;
  }

  async getUserNotifications(userId: string, limit = 50, offset = 0) {
    const key = `notifications:${userId}:${limit}:${offset}`;
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    // TODO: replace with DB call
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

    const result = { notifications, total: notifications.length, unread: notifications.filter(n => !n.read).length };
    await this.cacheService.set(key, result, {ttl: 300});
    return result;
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    logger.info(`Notification ${notificationId} marked as read for user ${userId}`);
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    logger.info(`All notifications marked as read for user ${userId}`);
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    logger.info(`Notification ${notificationId} deleted for user ${userId}`);
  }

  async updateUserPreferences(userId: string, delta: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...delta };
    await this.cacheService.set(`prefs:${userId}`, updated, {ttl: 86_400});
    logger.info(`Notification preferences updated for user ${userId}`);
    return updated;
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const cached = await this.cacheService.get(`prefs:${userId}`) as NotificationPreferences | undefined;    if (cached) return cached;

    const defaults: NotificationPreferences = {
      email: true,
      push: true,
      inApp: true,
      sms: false,
      frequency: 'immediate',
      quietHours: { enabled: false, start: '22:00', end: '08:00' }
    };
    await this.cacheService.set(`prefs:${userId}`, defaults, {ttl: 86_400});
    return defaults;
  }

  /* ========================================================== */
  /* Channel senders                                            */
  /* ========================================================== */
  private async sendThroughChannel(channel: string, payload: NotificationPayload): Promise<void> {
    switch (channel) {
      case 'email':
        return this.sendEmailNotification(payload);
      case 'push':
        return this.sendPushNotification(payload);
      case 'sms':
        return this.sendSMSNotification(payload);
      default:
        logger.warn(`Unknown channel ${channel}`);
    }
  }

  private async sendEmailNotification(p: NotificationPayload): Promise<void> {
    if (!p.email) { logger.warn(`No email for user ${p.userId}`); return; }
    await this.emailService.sendEmail({
      to: p.email,
      subject: p.title,
      template: 'notification',
      templateData: { title: p.title, message: p.message, type: p.type, ...p.data }
    });
  }

  /* -------------- FCM PUSH  -------------------------------- */
  private async sendPushNotification(p: NotificationPayload): Promise<void> {
    const tokens = await this.getPushTokens(p.userId);
    if (!tokens.length) { logger.info(`No push tokens for user ${p.userId}`); return; }

    const msg: MulticastMessage = {
      tokens,
      notification: { title: p.title, body: p.message },
      data: p.data ? this.toStringMap(p.data) : undefined,
      android: { priority: p.priority === 'urgent' ? 'high' : 'normal' },
      apns: { headers: { 'apns-priority': p.priority === 'urgent' ? '10' : '5' } }
    };

    const res = await this.messaging.sendEachForMulticast(msg);

    logger.info(`Push sent ${res.successCount}/${tokens.length} to user ${p.userId}`);

    // remove invalid / unregistered tokens
    res.responses.forEach((r, i) => {
      if (r.error?.code === 'messaging/invalid-registration-token' ||
          r.error?.code === 'messaging/registration-token-not-registered') {
        this.removePushToken(tokens[i]).catch(() => {/* ignore */});
      }
    });
  }

  private async sendSMSNotification(p: NotificationPayload): Promise<void> {
    logger.info(`SMS notification would be sent to user ${p.userId}: ${p.title}`);
  }

  /* ========================================================== */
  /* Token CRUD  (Firestore)                                   */
  /* ========================================================== */
  private async getPushTokens(userId: string): Promise<string[]> {
    const snap = await firebaseConnection.getDatabase()
      .collection('user_push_tokens')
      .where('userId', '==', userId)
      .get();
    return snap.docs.map(d => d.data().token);
  }

  private async removePushToken(token: string): Promise<void> {
    const hash = this.hash(token);
    await firebaseConnection.getDatabase()
      .collection('user_push_tokens')
      .doc(hash)
      .delete();
  }

  /* ========================================================== */
  /* Helpers                                                    */
  /* ========================================================== */
  private readonly hash = (s: string): string =>
    require('crypto').createHash('sha256').update(s).digest('hex');

  private toStringMap(obj: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
  }

  private isInQuietHours(p: NotificationPreferences): boolean {
    if (!p.quietHours.enabled) return false;
    const now = new Date();
    const cur = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { start, end } = p.quietHours;
    return start < end ? (cur >= start && cur < end) : (cur >= start || cur < end);
  }

  private getQuietHoursEndTime(qh: { start: string; end: string }): Date {
    const [h, m] = qh.end.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    return d;
  }

  private async storeInAppNotification(p: NotificationPayload): Promise<void> {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      userId: p.userId,
      title: p.title,
      message: p.message,
      type: p.type,
      priority: p.priority,
      data: p.data ?? {},
      read: false,
      createdAt: new Date().toISOString()
    };
    // TODO: persist to DB
    await this.cacheService.delete(`notifications:${p.userId}:*:*`); // invalidate list caches
    logger.info(`In-app notification stored for user ${p.userId}`);
  }

  private async scheduleNotification(p: NotificationPayload): Promise<void> {
    const delay = p.scheduledFor!.getTime() - Date.now();
    if (delay <= 0 || delay > 86400000) return; // ignore > 24 h
    setTimeout(() => this.sendNotification({ ...p, scheduledFor: undefined }), delay);
    logger.info(`Notification scheduled for ${p.scheduledFor!.toISOString()} (delay ${delay} ms)`);
  }
}