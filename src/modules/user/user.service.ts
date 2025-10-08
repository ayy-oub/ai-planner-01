import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CacheService } from '../../shared/services/cache.service';
import {
    User,
    UserProfile,
    UserPreferences,
    UserActivity,
    UserSession,
    UserNotification,
    UserSearchFilters,
    UserBulkOperation,
    UserExportData,
    UserImportData,
    UserValidationResult,
    UserSearchResult,
    UserSubscription,
    UserStatistics,
    UserSecurity
} from './user.types';
import { FirebaseService } from '../../shared/services/firebase.service';
import { EmailService } from '../../shared/services/email.service';
import { NotificationService } from '../../shared/services/notification.service';
import { FileUploadService } from '../../shared/services/file-upload.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../../shared/utils/errors';
import { validateInput } from '../../shared/utils/validators';
import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays, differenceInDays } from 'date-fns';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    private readonly userCachePrefix = 'user:';
    private readonly profileCachePrefix = 'profile:';
    private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

    constructor(
        private readonly userRepository: UserRepository,
        private readonly cacheService: CacheService,
        private readonly firebaseService: FirebaseService,
        private readonly emailService: EmailService,
        private readonly notificationService: NotificationService,
        private readonly fileUploadService: FileUploadService
    ) { }

    /**
     * Get user by ID
     */
    async getUser(userId: string): Promise<User | null> {
        try {
            // Check cache first
            const cacheKey = `${this.userCachePrefix}${userId}`;
            const cached = await this.cacheService.get<User>(cacheKey);
            if (cached) return cached;

            // Get from database
            const user = await this.userRepository.getUser(userId);
            if (!user) return null;

            // Cache for future requests
            await this.cacheService.set(cacheKey, user, 1800); // 30 minutes

            return user;
        } catch (error) {
            logger.error('Error getting user:', error);
            throw error;
        }
    }

    /**
     * Get user profile (public-safe)
     */
    async getUserProfile(userId: string): Promise<UserProfile> {
        try {
            // Check cache first
            const cacheKey = `${this.profileCachePrefix}${userId}`;
            const cached = await this.cacheService.get<UserProfile>(cacheKey);
            if (cached) return cached;

            // Get user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Create profile (exclude sensitive data)
            const profile: UserProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                preferences: user.preferences,
                subscription: user.subscription,
                statistics: user.statistics,
                roles: user.roles,
                createdAt: user.metadata.createdAt,
                lastActivity: user.lastActivity,
                isOnline: this.isUserOnline(user.lastActivity)
            };

            // Cache profile
            await this.cacheService.set(cacheKey, profile, 1800); // 30 minutes

            return profile;
        } catch (error) {
            logger.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
        try {
            // Validate input
            await validateInput(updates, 'userProfileUpdate');

            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Apply updates
            const updatedUser = await this.userRepository.updateUser(userId, {
                displayName: updates.displayName,
                photoURL: updates.photoURL,
                updatedAt: new Date()
            });

            // Invalidate caches
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'profile_updated', {
                updatedFields: Object.keys(updates)
            });

            return await this.getUserProfile(userId);
        } catch (error) {
            logger.error('Error updating user profile:', error);
            throw error;
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
        try {
            // Validate input
            await validateInput(preferences, 'userPreferences');

            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Merge preferences
            const updatedPreferences = {
                ...user.preferences,
                ...preferences
            };

            // Update user
            await this.userRepository.updateUser(userId, {
                preferences: updatedPreferences,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'settings_updated', {
                type: 'preferences',
                updatedFields: Object.keys(preferences)
            });

            return updatedPreferences;
        } catch (error) {
            logger.error('Error updating user preferences:', error);
            throw error;
        }
    }

    /**
     * Update user settings
     */
    async updateUserSettings(userId: string, settings: any): Promise<any> {
        try {
            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Update settings
            const updatedSettings = {
                ...user.settings,
                ...settings
            };

            await this.userRepository.updateUser(userId, {
                settings: updatedSettings,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'settings_updated', {
                type: 'settings',
                updatedFields: Object.keys(settings)
            });

            return updatedSettings;
        } catch (error) {
            logger.error('Error updating user settings:', error);
            throw error;
        }
    }

    /**
     * Get user preferences
     */
    async getUserPreferences(userId: string): Promise<UserPreferences> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            return user.preferences;
        } catch (error) {
            logger.error('Error getting user preferences:', error);
            throw error;
        }
    }

    /**
     * Get user settings
     */
    async getUserSettings(userId: string): Promise<any> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            return user.settings;
        } catch (error) {
            logger.error('Error getting user settings:', error);
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    async getUserStatistics(userId: string): Promise<UserStatistics> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            return user.statistics;
        } catch (error) {
            logger.error('Error getting user statistics:', error);
            throw error;
        }
    }

    /**
     * Update user statistics
     */
    async updateUserStatistics(userId: string, updates: Partial<UserStatistics>): Promise<UserStatistics> {
        try {
            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Update statistics
            const updatedStatistics = {
                ...user.statistics,
                ...updates
            };

            await this.userRepository.updateUser(userId, {
                statistics: updatedStatistics,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            return updatedStatistics;
        } catch (error) {
            logger.error('Error updating user statistics:', error);
            throw error;
        }
    }

    /**
     * Get user subscription
     */
    async getUserSubscription(userId: string): Promise<UserSubscription> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            return user.subscription;
        } catch (error) {
            logger.error('Error getting user subscription:', error);
            throw error;
        }
    }

    /**
     * Update user subscription
     */
    async updateUserSubscription(userId: string, subscription: Partial<UserSubscription>): Promise<UserSubscription> {
        try {
            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Update subscription
            const updatedSubscription = {
                ...user.subscription,
                ...subscription,
                updatedAt: new Date()
            };

            await this.userRepository.updateUser(userId, {
                subscription: updatedSubscription,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'subscription_updated', {
                previousPlan: user.subscription.plan,
                newPlan: subscription.plan,
                status: subscription.status
            });

            // Send notification
            if (subscription.plan && subscription.plan !== user.subscription.plan) {
                await this.notificationService.sendNotification(userId, {
                    type: 'info',
                    title: 'Subscription Updated',
                    message: `Your subscription has been updated to ${subscription.plan} plan.`,
                    priority: 'medium'
                });
            }

            return updatedSubscription;
        } catch (error) {
            logger.error('Error updating user subscription:', error);
            throw error;
        }
    }

    /**
     * Get user security info
     */
    async getUserSecurity(userId: string): Promise<UserSecurity> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Return security info without sensitive data
            const { twoFactorSecret, backupCodes, ...safeSecurity } = user.security;
            return safeSecurity;
        } catch (error) {
            logger.error('Error getting user security:', error);
            throw error;
        }
    }

    /**
     * Update user security settings
     */
    async updateUserSecurity(userId: string, security: Partial<UserSecurity>): Promise<UserSecurity> {
        try {
            // Get current user
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Update security settings
            const updatedSecurity = {
                ...user.security,
                ...security
            };

            await this.userRepository.updateUser(userId, {
                security: updatedSecurity,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'security_updated', {
                updatedFields: Object.keys(security)
            });

            return updatedSecurity;
        } catch (error) {
            logger.error('Error updating user security:', error);
            throw error;
        }
    }

    /**
     * Enable two-factor authentication
     */
    async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (user.security.twoFactorEnabled) {
                throw new BadRequestException('Two-factor authentication is already enabled');
            }

            // Generate secret
            const secret = authenticator.generateSecret();
            const appName = 'AI Planner';

            // Generate QR code URL
            const qrCode = authenticator.keyuri(user.email, appName, secret);

            // Generate backup codes
            const backupCodes = Array.from({ length: 10 }, () =>
                Math.random().toString(36).substring(2, 8).toUpperCase()
            );

            // Update user security
            await this.userRepository.updateUser(userId, {
                security: {
                    ...user.security,
                    twoFactorEnabled: true,
                    twoFactorSecret: secret,
                    backupCodes
                },
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'two_factor_enabled');

            // Send notification
            await this.notificationService.sendNotification(userId, {
                type: 'info',
                title: 'Two-Factor Authentication Enabled',
                message: 'Two-factor authentication has been enabled for your account.',
                priority: 'high'
            });

            return { secret, qrCode };
        } catch (error) {
            logger.error('Error enabling two-factor authentication:', error);
            throw error;
        }
    }

    /**
     * Disable two-factor authentication
     */
    async disableTwoFactor(userId: string, code: string): Promise<void> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (!user.security.twoFactorEnabled) {
                throw new BadRequestException('Two-factor authentication is not enabled');
            }

            // Verify code
            const isValid = authenticator.verify({
                token: code,
                secret: user.security.twoFactorSecret!
            });

            if (!isValid) {
                throw new BadRequestException('Invalid authentication code');
            }

            // Update user security
            await this.userRepository.updateUser(userId, {
                security: {
                    ...user.security,
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    backupCodes: []
                },
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);

            // Log activity
            await this.logUserActivity(userId, 'two_factor_disabled');

            // Send notification
            await this.notificationService.sendNotification(userId, {
                type: 'warning',
                title: 'Two-Factor Authentication Disabled',
                message: 'Two-factor authentication has been disabled for your account.',
                priority: 'high'
            });
        } catch (error) {
            logger.error('Error disabling two-factor authentication:', error);
            throw error;
        }
    }

    /**
     * Verify two-factor code
     */
    async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (!user.security.twoFactorEnabled) {
                return true; // 2FA not enabled, so verification passes
            }

            // Try authenticator code first
            const isValid = authenticator.verify({
                token: code,
                secret: user.security.twoFactorSecret!
            });

            if (isValid) {
                return true;
            }

            // Try backup codes
            if (user.security.backupCodes.includes(code)) {
                // Remove used backup code
                const updatedCodes = user.security.backupCodes.filter(c => c !== code);
                await this.userRepository.updateUser(userId, {
                    security: {
                        ...user.security,
                        backupCodes: updatedCodes
                    },
                    updatedAt: new Date()
                });

                // Invalidate cache
                await this.invalidateUserCache(userId);

                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error verifying two-factor code:', error);
            throw error;
        }
    }

    /**
     * Add login history entry
     */
    async addLoginHistory(userId: string, loginData: any): Promise<void> {
        try {
            const user = await this.getUser(userId);
            if (!user) return;

            const historyEntry = {
                id: uuidv4(),
                timestamp: new Date(),
                ipAddress: loginData.ipAddress,
                userAgent: loginData.userAgent,
                location: loginData.location,
                device: loginData.device,
                success: loginData.success,
                reason: loginData.reason
            };

            // Add to login history (keep last 50 entries)
            const updatedHistory = [
                historyEntry,
                ...user.security.loginHistory.slice(0, 49)
            ];

            await this.userRepository.updateUser(userId, {
                'security.loginHistory': updatedHistory,
                updatedAt: new Date()
            });

            // Invalidate cache
            await this.invalidateUserCache(userId);
        } catch (error) {
            logger.error('Error adding login history:', error);
        }
    }

    /**
     * Get user activity log
     */
    async getUserActivity(userId: string, limit: number = 50, offset: number = 0): Promise<UserActivity[]> {
        try {
            return await this.userRepository.getUserActivity(userId, limit, offset);
        } catch (error) {
            logger.error('Error getting user activity:', error);
            throw error;
        }
    }

    /**
     * Log user activity
     */
    async logUserActivity(userId: string, type: string, metadata?: any): Promise<void> {
        try {
            const activity: UserActivity = {
                id: uuidv4(),
                userId,
                type: type as any,
                timestamp: new Date(),
                metadata
            };

            await this.userRepository.saveUserActivity(activity);
        } catch (error) {
            logger.error('Error logging user activity:', error);
        }
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId: string): Promise<UserSession[]> {
        try {
            const sessions = await this.userRepository.getUserSessions(userId);

            // Filter out expired sessions
            const now = new Date();
            return sessions.filter(session =>
                session.isActive &&
                session.expiresAt > now &&
                session.isValid
            );
        } catch (error) {
            logger.error('Error getting user sessions:', error);
            throw error;
        }
    }

    /**
     * Create user session
     */
    async createUserSession(userId: string, sessionData: any): Promise<UserSession> {
        try {
            const session: UserSession = {
                id: uuidv4(),
                userId,
                token: sessionData.token,
                refreshToken: sessionData.refreshToken,
                deviceInfo: sessionData.deviceInfo,
                location: sessionData.location,
                ipAddress: sessionData.ipAddress,
                userAgent: sessionData.userAgent,
                startedAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + this.sessionTimeout),
                isActive: true,
                isValid: true
            };

            await this.userRepository.saveUserSession(session);

            // Log activity
            await this.logUserActivity(userId, 'login', {
                sessionId: session.id,
                device: sessionData.deviceInfo
            });

            return session;
        } catch (error) {
            logger.error('Error creating user session:', error);
            throw error;
        }
    }

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId: string): Promise<void> {
        try {
            await this.userRepository.updateUserSession(sessionId, {
                lastActivity: new Date(),
                updatedAt: new Date()
            });
        } catch (error) {
            logger.error('Error updating session activity:', error);
        }
    }

    /**
     * Invalidate user session
     */
    async invalidateSession(sessionId: string): Promise<void> {
        try {
            await this.userRepository.updateUserSession(sessionId, {
                isValid: false,
                isActive: false,
                updatedAt: new Date()
            });
        } catch (error) {
            logger.error('Error invalidating session:', error);
        }
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(
        userId: string,
        unreadOnly: boolean = false,
        limit: number = 20,
        offset: number = 0
    ): Promise<UserNotification[]> {
        try {
            const notifications = await this.userRepository.getUserNotifications(userId, unreadOnly, limit, offset);

            // Filter out expired notifications
            const now = new Date();
            return notifications.filter(notification =>
                !notification.expiresAt || notification.expiresAt > now
            );
        } catch (error) {
            logger.error('Error getting user notifications:', error);
            throw error;
        }
    }

    /**
     * Create user notification
     */
    async createUserNotification(userId: string, notification: Partial<UserNotification>): Promise<UserNotification> {
        try {
            const newNotification: UserNotification = {
                id: uuidv4(),
                userId,
                type: notification.type || 'info',
                title: notification.title!,
                message: notification.message!,
                actionUrl: notification.actionUrl,
                actionText: notification.actionText,
                icon: notification.icon,
                priority: notification.priority || 'medium',
                read: false,
                dismissed: false,
                createdAt: new Date(),
                expiresAt: notification.expiresAt,
                metadata: notification.metadata
            };

            await this.userRepository.saveUserNotification(newNotification);

            // Send email notification if enabled
            const user = await this.getUser(userId);
            if (user && user.preferences.notifications.email) {
                await this.emailService.sendEmail({
                    to: user.email,
                    subject: notification.title!,
                    template: 'notification',
                    context: {
                        userName: user.displayName || user.email,
                        title: notification.title!,
                        message: notification.message!,
                        actionUrl: notification.actionUrl,
                        actionText: notification.actionText
                    }
                });
            }

            return newNotification;
        } catch (error) {
            logger.error('Error creating user notification:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
        try {
            await this.userRepository.updateUserNotification(notificationId, {
                read: true,
                readAt: new Date()
            });
        } catch (error) {
            logger.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Dismiss notification
     */
    async dismissNotification(userId: string, notificationId: string): Promise<void> {
        try {
            await this.userRepository.updateUserNotification(notificationId, {
                dismissed: true,
                dismissedAt: new Date()
            });
        } catch (error) {
            logger.error('Error dismissing notification:', error);
            throw error;
        }
    }

    /**
     * Search users (admin only)
     */
    async searchUsers(filters: UserSearchFilters): Promise<UserSearchResult> {
        try {
            return await this.userRepository.searchUsers(filters);
        } catch (error) {
            logger.error('Error searching users:', error);
            throw error;
        }
    }

    /**
     * Get user analytics (admin only)
     */
    async getUserAnalytics(): Promise<any> {
        try {
            return await this.userRepository.getUserAnalytics();
        } catch (error) {
            logger.error('Error getting user analytics:', error);
            throw error;
        }
    }

    /**
     * Perform bulk operation on users (admin only)
     */
    async performBulkOperation(operation: UserBulkOperation): Promise<void> {
        try {
            // Validate operation
            if (!operation.userIds || operation.userIds.length === 0) {
                throw new BadRequestException('User IDs are required');
            }

            // Perform operation based on type
            switch (operation.operation) {
                case 'activate':
                    await this.activateUsers(operation.userIds, operation.performedBy);
                    break;
                case 'deactivate':
                    await this.deactivateUsers(operation.userIds, operation.performedBy);
                    break;
                case 'send_notification':
                    await this.sendBulkNotification(operation.userIds, operation.data, operation.performedBy);
                    break;
                case 'update_subscription':
                    await this.updateBulkSubscription(operation.userIds, operation.data, operation.performedBy);
                    break;
                default:
                    throw new BadRequestException(`Unsupported operation: ${operation.operation}`);
            }

            // Log bulk operation
            await this.userRepository.saveBulkOperation(operation);
        } catch (error) {
            logger.error('Error performing bulk operation:', error);
            throw error;
        }
    }

    /**
     * Export user data
     */
    async exportUserData(userId: string): Promise<UserExportData> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Get user data
            const [planners, activities, history] = await Promise.all([
                this.getUserPlanners(userId),
                this.getUserActivities(userId),
                this.getUserActivity(userId, 1000) // Last 1000 activities
            ]);

            return {
                profile: await this.getUserProfile(userId),
                planners,
                activities,
                settings: user.settings,
                history,
                statistics: user.statistics
            };
        } catch (error) {
            logger.error('Error exporting user data:', error);
            throw error;
        }
    }

    /**
     * Import user data
     */
    async importUserData(userId: string, importData: UserImportData): Promise<void> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Update profile if provided
            if (importData.profile) {
                await this.updateUserProfile(userId, importData.profile);
            }

            // Update preferences if provided
            if (importData.preferences) {
                await this.updateUserPreferences(userId, importData.preferences);
            }

            // Update settings if provided
            if (importData.settings) {
                await this.updateUserSettings(userId, importData.settings);
            }

            // Log activity
            await this.logUserActivity(userId, 'import_completed', {
                importedFields: Object.keys(importData)
            });
        } catch (error) {
            logger.error('Error importing user data:', error);
            throw error;
        }
    }

    /**
     * Delete user account
     */
    async deleteUserAccount(userId: string, reason?: string): Promise<void> {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Log deletion reason
            if (reason) {
                await this.logUserActivity(userId, 'account_deleted', { reason });
            }

            // Delete user data
            await this.userRepository.deleteUser(userId);

            // Send confirmation email
            await this.emailService.sendEmail({
                to: user.email,
                subject: 'Account Deleted - AI Planner',
                template: 'account-deleted',
                context: {
                    userName: user.displayName || user.email,
                    deletionDate: new Date().toISOString()
                }
            });

            // Invalidate all caches
            await this.invalidateUserCache(userId);
        } catch (error) {
            logger.error('Error deleting user account:', error);
            throw error;
        }
    }

    /**
     * Validate user data
     */
    async validateUserData(userData: any): Promise<UserValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Email validation
        if (userData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                errors.push('Invalid email format');
            }
        }

        // Display name validation
        if (userData.displayName) {
            if (userData.displayName.length < 2) {
                errors.push('Display name must be at least 2 characters long');
            }
            if (userData.displayName.length > 50) {
                errors.push('Display name must not exceed 50 characters');
            }
        }

        // Phone number validation
        if (userData.phoneNumber) {
            const phoneRegex = /^\+?[1-9]\d{1,14}$/;
            if (!phoneRegex.test(userData.phoneNumber)) {
                warnings.push('Phone number format may be invalid');
            }
        }

        // Preferences validation
        if (userData.preferences) {
            const validThemes = ['light', 'dark', 'auto'];
            if (userData.preferences.theme && !validThemes.includes(userData.preferences.theme)) {
                errors.push('Invalid theme preference');
            }

            const validViews = ['planner', 'calendar', 'tasks', 'dashboard'];
            if (userData.preferences.defaultView && !validViews.includes(userData.preferences.defaultView)) {
                errors.push('Invalid default view preference');
            }

            const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
            if (userData.preferences.language && !validLanguages.includes(userData.preferences.language)) {
                warnings.push('Language code may not be supported');
            }
        }

        // Suggestions
        if (!userData.displayName) {
            suggestions.push('Consider adding a display name for a more personalized experience');
        }

        if (!userData.preferences?.timezone) {
            suggestions.push('Consider setting your timezone for accurate scheduling');
        }

        if (!userData.preferences?.language) {
            suggestions.push('Consider setting your preferred language');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            suggestions
        };
    }

    /**
     * Helper methods
     */

    private isUserOnline(lastActivity: Date): boolean {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastActivity > fiveMinutesAgo;
    }

    private async invalidateUserCache(userId: string): Promise<void> {
        await Promise.all([
            this.cacheService.delete(`${this.userCachePrefix}${userId}`),
            this.cacheService.delete(`${this.profileCachePrefix}${userId}`)
        ]);
    }

    private async getUserPlanners(userId: string): Promise<any[]> {
        // This would be implemented in the planner service
        // For now, return empty array
        return [];
    }

    private async getUserActivities(userId: string): Promise<any[]> {
        // This would be implemented in the activity service
        // For now, return empty array
        return [];
    }

    private async activateUsers(userIds: string[], performedBy: string): Promise<void> {
        for (const userId of userIds) {
            await this.userRepository.updateUser(userId, {
                disabled: false,
                updatedAt: new Date()
            });
            await this.invalidateUserCache(userId);
        }
    }

    private async deactivateUsers(userIds: string[], performedBy: string): Promise<void> {
        for (const userId of userIds) {
            await this.userRepository.updateUser(userId, {
                disabled: true,
                updatedAt: new Date()
            });
            await this.invalidateUserCache(userId);
        }
    }

    private async sendBulkNotification(userIds: string[], data: any, performedBy: string): Promise<void> {
        for (const userId of userIds) {
            await this.createUserNotification(userId, {
                type: data.type || 'info',
                title: data.title,
                message: data.message,
                priority: data.priority || 'medium'
            });
        }
    }

    private async updateBulkSubscription(userIds: string[], data: any, performedBy: string): Promise<void> {
        for (const userId of userIds) {
            await this.updateUserSubscription(userId, {
                plan: data.plan,
                status: data.status
            });
        }
    }
}