let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();
import { UserRepository } from './user.repository';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { FirebaseService } from '../../shared/services/firebase.service';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import {
    UserProfile,
    UserSettings,
    UserPreferences,
    NotificationRecord,
    AvatarRecord,
    ExportRecord,
    SessionRecord,
} from './user.types';

export class UserService {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly cache: CacheService,
        private readonly email: EmailService,
        private readonly firebase: FirebaseService
    ) { }

    /* =========================================================
       👤 Profile Management
    ========================================================= */

    async getProfile(userId: string): Promise<UserProfile> {
        const cacheKey = `user:profile:${userId}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const profile = await this.userRepo.getProfile(userId);
        if (!profile)
            throw new AppError('User profile not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        await this.cache.set(cacheKey, profile, { ttl: 300 });
        return profile;
    }

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
        const existing = await this.userRepo.getProfile(userId);
        if (!existing)
            throw new AppError('User profile not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        const updated: UserProfile = {
            ...existing,
            ...updates,
            updatedAt: new Date(),
        };

        await this.userRepo.updateProfile(userId, updated);
        await this.cache.delete(`user:profile:${userId}`);
        logger.info(`User ${userId} updated their profile`);

        return updated;
    }

    /* =========================================================
       ⚙️ Settings Management
    ========================================================= */

    async getSettings(userId: string): Promise<UserSettings> {
        const cacheKey = `user:settings:${userId}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const settings = await this.userRepo.getSettings(userId);
        if (!settings) throw new AppError('Settings not found', 404);

        await this.cache.set(cacheKey, settings, { ttl: 600 });
        return settings;
    }

    async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
        const existing = await this.userRepo.getSettings(userId);
        if (!existing) throw new AppError('Settings not found', 404);

        const updated: UserSettings = {
            ...existing,
            ...updates,
            updatedAt: new Date(),
        };

        await this.userRepo.updateSettings(userId, updated);
        await this.cache.delete(`user:settings:${userId}`);
        return updated;
    }

    /* =========================================================
       💬 Preferences
    ========================================================= */

    async getPreferences(userId: string): Promise<UserPreferences> {
        const prefs = await this.userRepo.getPreferences(userId);
        if (!prefs) throw new AppError('Preferences not found', 404);
        return prefs;
    }

    async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
        const existing = await this.userRepo.getPreferences(userId);
        if (!existing) throw new AppError('Preferences not found', 404);

        const updated: UserPreferences = {
            ...existing,
            ...updates,
            updatedAt: new Date(),
        };

        await this.userRepo.updatePreferences(userId, updated);
        return updated;
    }

    /* =========================================================
       🖼 Avatar
    ========================================================= */

    async uploadAvatar(userId: string, file: Express.Multer.File): Promise<AvatarRecord> {
        try {
            const uid = uuidv4();
            const filePath = `avatars/${userId}/${uid}-${file.originalname}`;

            // Upload file buffer to Firebase Storage
            const [uploadedFile] = await this.firebase.uploadBuffer(file.buffer, filePath, {
                metadata: { contentType: file.mimetype },
            });

            // Generate a signed public URL (valid for 7 days)
            const [publicUrl] = await uploadedFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
            });

            // Build AvatarRecord
            const avatarRecord: AvatarRecord = {
                uid,
                userId,
                filePath,
                publicUrl,
                contentType: file.mimetype,
                size: file.size,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Save avatar record in Firestore
            await this.userRepo.setAvatar(
                userId,
                filePath,
                publicUrl,
                file.mimetype,
                file.size
            );

            // Clear cached profile
            await this.cache.delete(`user:profile:${userId}`);
            logger.info(`User ${userId} uploaded a new avatar`);

            return avatarRecord;
        } catch (err) {
            logger.error(`uploadAvatar error for user ${userId}`, err);
            throw new AppError(
                'Failed to upload avatar',
                500,
                undefined,
                ErrorCode.FILE_UPLOAD_ERROR
            );
        }
    }

    async removeAvatar(userId: string): Promise<void> {
        try {
            const profile = await this.userRepo.getProfile(userId);
            if (!profile?.avatar) return;

            const avatarUrl = profile.avatar;
            const match = avatarUrl.match(/avatars\/(.+)$/);
            if (match && match[1]) {
                const filePath = `avatars/${match[1]}`;
                await this.firebase.deleteFile(filePath);
                await this.userRepo.removeAvatar(userId);
                await this.cache.delete(`user:profile:${userId}`);
                logger.info(`User ${userId} removed their avatar`);
            }
        } catch (err) {
            logger.error(`removeAvatar error for user ${userId}`, err);
            throw new AppError(
                'Failed to remove avatar',
                500,
                undefined,
                ErrorCode.STORAGE_DELETE_FAILED
            );
        }
    }

    /* =========================================================
       🔔 Notifications
    ========================================================= */

    async getNotifications(userId: string, page = 1, limit = 20): Promise<NotificationRecord[]> {
        return this.userRepo.getNotifications(userId, page, limit);
    }

    async markNotificationRead(userId: string, notificationId: string): Promise<void> {
        await this.userRepo.markNotificationRead(userId, notificationId);
    }

    async markAllNotificationsRead(userId: string): Promise<void> {
        await this.userRepo.markAllNotificationsRead(userId);
    }

    /* =========================================================
       🛡 Sessions
    ========================================================= */

    async getSessions(userId: string): Promise<SessionRecord[]> {
        return this.userRepo.getSessions(userId);
    }

    async revokeSession(userId: string, sessionId: string): Promise<void> {
        await this.userRepo.revokeSession(userId, sessionId);
    }

    /* =========================================================
       📦 Data Export
    ========================================================= */

    async exportData(userId: string): Promise<ExportRecord> {
        const user = await this.userRepo.getProfile(userId);
        if (!user) {
            throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);
        }

        // Generate a file path for the export
        const exportFilePath = `exports/${userId}/${uuidv4()}.zip`;

        // Save export record in Firestore
        const record = await this.userRepo.createExportRecord(userId, exportFilePath);

        // Send email notification
        if (user.email) {
            await this.email.sendDataExportStartedEmail(user.email, exportFilePath, user.displayName);
        } else {
            logger.warn(`User ${userId} has no email associated for export notification`);
        }

        return record;
    }

    /* =========================================================
       💳 Subscription
    ========================================================= */

    async updateSubscription(userId: string, plan: string): Promise<void> {
        await this.userRepo.updateSubscription(userId, plan);
        logger.info(`User ${userId} updated subscription to ${plan}`);
    }

    /* =========================================================
       🔐 Two-Factor Authentication
    ========================================================= */

    async toggleTwoFactor(userId: string, enable: boolean): Promise<{ enabled: boolean }> {
        await this.userRepo.toggleTwoFactor(userId, enable);
        return { enabled: enable };
    }

    /* =========================================================
       🧩 Bulk Operations
    ========================================================= */

    async bulkOperation(data: { userIds: string[]; action: string }): Promise<{ success: number; failed: number }> {
        let success = 0;
        for (const id of data.userIds) {
            try {
                switch (data.action) {
                    case 'disable-2fa':
                        await this.toggleTwoFactor(id, false);
                        break;
                    default:
                        throw new AppError('Invalid bulk action', 400);
                }
                success++;
            } catch (err) {
                logger.error(`Bulk operation failed for user ${id}: ${err}`);
            }
        }
        return { success, failed: data.userIds.length - success };
    }

    /* =========================================================
       ❌ Account Deletion
    ========================================================= */

    async deleteAccount(userId: string): Promise<void> {
        // Fetch the user first
        const user = await this.userRepo.getProfile(userId);
        if (!user) {
            throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);
        }

        // Delete the account
        await this.userRepo.deleteAccount(userId);

        // Send the account deleted email
        if (user.email && user.displayName) {
            await this.email.sendAccountDeletedEmail(user.email, user.displayName);
        } else if (user.email) {
            // fallback if name is missing
            await this.email.sendAccountDeletedEmail(user.email, 'Client');
        }

        // Clear cache
        await this.cache.delete(`user:profile:${userId}`);
    }

}
