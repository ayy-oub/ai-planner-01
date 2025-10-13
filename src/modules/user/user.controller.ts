import { Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { UserService } from './user.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../../modules/auth/auth.types';
import { logger } from '../../shared/utils/logger';
import { AppError, ErrorCode } from '@/shared/utils/errors';

@injectable()
export class UserController {
    constructor(@inject('UserService') private readonly userService: UserService) { }

    /* =========================================================
       Profile
    ========================================================= */
    getProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const profile = await this.userService.getProfile(req.user!.uid);
            res.json(new ApiResponse(req).success(profile, 'Profile retrieved successfully'));
        } catch (err) {
            logger.error('Get profile controller error:', err);
            next(err);
        }
    });

    updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const updated = await this.userService.updateProfile(req.user!.uid, req.body);
            res.json(new ApiResponse(req).success(updated, 'Profile updated successfully'));
        } catch (err) {
            logger.error('Update profile controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Settings
    ========================================================= */
    getSettings = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const settings = await this.userService.getSettings(req.user!.uid);
            res.json(new ApiResponse(req).success(settings, 'Settings retrieved successfully'));
        } catch (err) {
            logger.error('Get settings controller error:', err);
            next(err);
        }
    });

    updateSettings = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const updated = await this.userService.updateSettings(req.user!.uid, req.body);
            res.json(new ApiResponse(req).success(updated, 'Settings updated successfully'));
        } catch (err) {
            logger.error('Update settings controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Preferences
    ========================================================= */
    getPreferences = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const prefs = await this.userService.getPreferences(req.user!.uid);
            res.json(new ApiResponse(req).success(prefs, 'Preferences retrieved successfully'));
        } catch (err) {
            logger.error('Get preferences controller error:', err);
            next(err);
        }
    });

    updatePreferences = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const updated = await this.userService.updatePreferences(req.user!.uid, req.body);
            res.json(new ApiResponse(req).success(updated, 'Preferences updated successfully'));
        } catch (err) {
            logger.error('Update preferences controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Avatar
    ========================================================= */
    uploadAvatar = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new AppError('No file uploaded', 400, undefined, ErrorCode.FILE_UPLOAD_ERROR);
            }
            const avatar = await this.userService.uploadAvatar(req.user!.uid, req.file);
            res.json(new ApiResponse(req).success(avatar, 'Avatar uploaded successfully'));
        } catch (err) {
            logger.error('Upload avatar controller error:', err);
            next(err);
        }
    });

    removeAvatar = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.userService.removeAvatar(req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Avatar removed successfully'));
        } catch (err) {
            logger.error('Remove avatar controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Notifications
    ========================================================= */
    getNotifications = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const notifications = await this.userService.getNotifications(req.user!.uid, page, limit);
            res.json(new ApiResponse(req).success(notifications, 'Notifications retrieved successfully'));
        } catch (err) {
            logger.error('Get notifications controller error:', err);
            next(err);
        }
    });

    markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.userService.markNotificationRead(req.user!.uid, req.params.id);
            res.json(new ApiResponse(req).success(null, 'Notification marked as read'));
        } catch (err) {
            logger.error('Mark notification read controller error:', err);
            next(err);
        }
    });

    markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.userService.markAllNotificationsRead(req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'All notifications marked as read'));
        } catch (err) {
            logger.error('Mark all notifications read controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Sessions
    ========================================================= */
    getSessions = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const sessions = await this.userService.getSessions(req.user!.uid);
            res.json(new ApiResponse(req).success(sessions, 'Sessions retrieved successfully'));
        } catch (err) {
            logger.error('Get sessions controller error:', err);
            next(err);
        }
    });

    revokeSession = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.userService.revokeSession(req.user!.uid, req.params.id);
            res.json(new ApiResponse(req).success(null, 'Session revoked successfully'));
        } catch (err) {
            logger.error('Revoke session controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Data Export
    ========================================================= */
    exportData = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const exportJob = await this.userService.exportData(req.user!.uid);
            res.json(new ApiResponse(req).success(exportJob, 'Data export initiated'));
        } catch (err) {
            logger.error('Export data controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Account Management
    ========================================================= */
    deleteAccount = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.userService.deleteAccount(req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Account deleted successfully'));
        } catch (err) {
            logger.error('Delete account controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Subscription
    ========================================================= */
    updateSubscription = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const updated = await this.userService.updateSubscription(req.user!.uid, req.body.plan);
            res.json(new ApiResponse(req).success(updated, 'Subscription updated successfully'));
        } catch (err) {
            logger.error('Update subscription controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Bulk Operations
    ========================================================= */
    bulkOperation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.userService.bulkOperation(req.body);
            res.json(new ApiResponse(req).success(result, 'Bulk operation completed'));
        } catch (err) {
            logger.error('Bulk operation controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Two-Factor Authentication
    ========================================================= */
    toggleTwoFactor = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.userService.toggleTwoFactor(req.user!.uid, req.body.enable);
            res.json(new ApiResponse(req).success(result, 'Two-factor authentication updated'));
        } catch (err) {
            logger.error('Toggle two-factor controller error:', err);
            next(err);
        }
    });
}
