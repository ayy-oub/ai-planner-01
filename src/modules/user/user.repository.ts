import { Timestamp } from 'firebase-admin/firestore';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import {
    UserProfile,
    UserSettings,
    UserPreferences,
    NotificationRecord,
    SessionRecord,
    ExportRecord,
    AvatarRecord,
} from './user.types';

const firestore = firebaseConnection.getDatabase();

export class UserRepository {
    private readonly userColl = firestore.collection('users');
    private readonly notifColl = firestore.collection('notifications');
    private readonly sessionColl = firestore.collection('sessions');
    private readonly exportColl = firestore.collection('exports');
    private readonly avatarColl = firestore.collection('avatars');

    /* ------------------------------------------------------------------ */
    /*  Profile                                                           */
    /* ------------------------------------------------------------------ */

    async getProfile(uid: string): Promise<UserProfile | null> {
        try {
            const snap = await this.userColl.doc(uid).get();
            return snap.exists ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null;
        } catch (err) {
            logger.error('getProfile error', err);
            throw new AppError('Failed to fetch user profile', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
        try {
            updates.updatedAt = new Date();
            await this.userColl.doc(uid).update(updates);
        } catch (err) {
            logger.error('updateProfile error', { uid, updates, err });
            throw new AppError('Failed to update user profile', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Email lookup                                                      */
    /* ------------------------------------------------------------------ */
    async getProfileByEmail(email: string): Promise<UserProfile | null> {
        try {
            const snap = await this.userColl.where('email', '==', email).limit(1).get();
            return snap.empty
                ? null
                : ({ uid: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile);
        } catch (err) {
            logger.error('getProfileByEmail error', { email, err });
            throw new AppError('Failed to fetch user by email', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Settings                                                          */
    /* ------------------------------------------------------------------ */

    async getSettings(uid: string): Promise<UserSettings | null> {
        try {
            const doc = await this.userColl.doc(uid).collection('config').doc('settings').get();
            return doc.exists ? (doc.data() as UserSettings) : null;
        } catch (err) {
            logger.error('getSettings error', err);
            throw new AppError('Failed to fetch user settings', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateSettings(uid: string, updates: Partial<UserSettings>): Promise<void> {
        try {
            updates.updatedAt = new Date();
            await this.userColl.doc(uid).collection('config').doc('settings').set(updates, { merge: true });
        } catch (err) {
            logger.error('updateSettings error', { uid, updates, err });
            throw new AppError('Failed to update user settings', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updateSubscription(userId: string, plan: string): Promise<void> {
        try {
            const userRef = this.userColl.doc(userId);
            await userRef.update({
                subscriptionPlan: plan,
                updatedAt: new Date(),
            });
        } catch (err) {
            logger.error('updateSubscription error', err);
            throw new AppError(
                'Failed to update subscription',
                500,
                undefined,
                ErrorCode.DATABASE_CONNECTION_ERROR
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Preferences                                                       */
    /* ------------------------------------------------------------------ */

    async getPreferences(uid: string): Promise<UserPreferences | null> {
        try {
            const doc = await this.userColl.doc(uid).collection('config').doc('preferences').get();
            return doc.exists ? (doc.data() as UserPreferences) : null;
        } catch (err) {
            logger.error('getPreferences error', err);
            throw new AppError('Failed to fetch user preferences', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async updatePreferences(uid: string, updates: Partial<UserPreferences>): Promise<void> {
        try {
            updates.updatedAt = new Date();
            await this.userColl.doc(uid).collection('config').doc('preferences').set(updates, { merge: true });
        } catch (err) {
            logger.error('updatePreferences error', { uid, updates, err });
            throw new AppError('Failed to update user preferences', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Avatar                                                            */
    /* ------------------------------------------------------------------ */

    async setAvatar(userId: string, filePath: string, publicUrl: string, contentType?: string, size?: number): Promise<AvatarRecord> {
        try {
            const uid = this.avatarColl.doc().id;
            const now = new Date();

            const record: AvatarRecord = {
                uid,
                userId,
                filePath,
                publicUrl,
                contentType,
                size,
                createdAt: now,
                updatedAt: now,
            };

            await this.avatarColl.doc(uid).set(record);
            return record;
        } catch (err) {
            logger.error('setAvatar error', err);
            throw new AppError('Failed to save avatar', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async removeAvatar(uid: string): Promise<void> {
        try {
            await this.avatarColl.doc(uid).delete();
        } catch (err) {
            logger.error('removeAvatar error', err);
            throw new AppError('Failed to remove avatar', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Notifications                                                     */
    /* ------------------------------------------------------------------ */

    async getNotifications(uid: string, page = 1, limit = 50): Promise<NotificationRecord[]> {
        try {
            let query = this.notifColl
                .where('userId', '==', uid)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            // If requesting a page beyond the first, compute the starting point
            if (page > 1) {
                const offset = (page - 1) * limit;

                // Fetch docs to get the cursor at the correct offset
                const prevDocsSnap = await this.notifColl
                    .where('userId', '==', uid)
                    .orderBy('createdAt', 'desc')
                    .limit(offset)
                    .get();

                const lastDoc = prevDocsSnap.docs[prevDocsSnap.docs.length - 1];
                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }
            }

            const snap = await query.get();

            return snap.docs.map(
                (d) => ({ id: d.id, ...d.data() } as NotificationRecord)
            );
        } catch (err) {
            logger.error(`getNotifications error for user ${uid}`, err);
            throw new AppError(
                'Failed to fetch notifications',
                500,
                undefined,
                ErrorCode.DATABASE_CONNECTION_ERROR
            );
        }
    }

    async markNotificationRead(uid: string, notifId: string): Promise<void> {
        try {
            await this.notifColl.doc(notifId).update({
                status: 'read',
                readAt: Timestamp.now(),
            });
        } catch (err) {
            logger.error('markNotificationRead error', { uid, notifId, err });
            throw new AppError('Failed to mark notification as read', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async markAllNotificationsRead(uid: string): Promise<void> {
        try {
            const snap = await this.notifColl.where('userId', '==', uid).where('status', '==', 'unread').get();
            const batch = firestore.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'read', readAt: Timestamp.now() });
            });
            await batch.commit();
        } catch (err) {
            logger.error('markAllNotificationsRead error', err);
            throw new AppError('Failed to mark all notifications as read', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Sessions                                                          */
    /* ------------------------------------------------------------------ */

    async getSessions(uid: string, limit = 20): Promise<SessionRecord[]> {
        try {
            const snap = await this.sessionColl
                .where('userId', '==', uid)
                .orderBy('lastActive', 'desc')
                .limit(limit)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionRecord));
        } catch (err) {
            logger.error('getSessions error', err);
            throw new AppError('Failed to fetch sessions', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    async revokeSession(uid: string, sessionId: string): Promise<void> {
        try {
            await this.sessionColl.doc(sessionId).delete();
        } catch (err) {
            logger.error('revokeSession error', { uid, sessionId, err });
            throw new AppError('Failed to revoke session', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Data Export                                                       */
    /* ------------------------------------------------------------------ */

    async createExportRecord(userId: string, filePath: string): Promise<ExportRecord> {
        try {
            const uid = this.exportColl.doc().id;
            const now = new Date();

            const record: ExportRecord = {
                id: uid,
                userId,
                filePath,
                status: 'processing',
                createdAt: now,
                updatedAt: now,
            };

            await this.exportColl.doc(uid).set(record);
            return record;
        } catch (err) {
            logger.error('createExportRecord error', err);
            throw new AppError(
                'Failed to create export record',
                500,
                undefined,
                ErrorCode.DATABASE_CONNECTION_ERROR
            );
        }
    }

    async updateExportStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
        try {
            await this.exportColl.doc(id).update({ status, updatedAt: Timestamp.now() });
        } catch (err) {
            logger.error('updateExportStatus error', { id, status, err });
            throw new AppError('Failed to update export status', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Account                                                           */
    /* ------------------------------------------------------------------ */

    async deleteAccount(uid: string): Promise<void> {
        try {
            await this.userColl.doc(uid).update({
                isDeleted: true,
                deletedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        } catch (err) {
            logger.error('deleteAccount error', err);
            throw new AppError('Failed to delete account', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Two-Factor Authentication                                         */
    /* ------------------------------------------------------------------ */

    async toggleTwoFactor(uid: string, enable: boolean): Promise<void> {
        try {
            await this.userColl.doc(uid).update({
                'security.twoFactorEnabled': enable,
                updatedAt: Timestamp.now(),
            });
        } catch (err) {
            logger.error('toggleTwoFactor error', err);
            throw new AppError('Failed to toggle two-factor authentication', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
        }
    }
}
