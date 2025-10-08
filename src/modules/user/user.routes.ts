import { Router } from 'express';
import { container } from 'tsyringe';
import { UserController } from './user.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const userController = container.resolve(UserController);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profile operations
 */

// All routes require authentication
router.use(authMiddleware());

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/users/profile', userController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               website:
 *                 type: string
 *               socialLinks:
 *                 type: object
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 */
router.patch('/users/profile',
    validationMiddleware(userController.userValidation.updateProfile),
    userController.updateProfile
);

/**
 * @swagger
 * /users/settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get('/users/settings', userController.getSettings);

/**
 * @swagger
 * /users/settings:
 *   patch:
 *     summary: Update user settings
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *               language:
 *                 type: string
 *               timezone:
 *                 type: string
 *               notifications:
 *                 type: object
 *               privacy:
 *                 type: object
 *               accessibility:
 *                 type: object
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.patch('/users/settings',
    validationMiddleware(userController.userValidation.updateSettings),
    userController.updateSettings
);

/**
 * @swagger
 * /users/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 */
router.get('/users/preferences', userController.getPreferences);

/**
 * @swagger
 * /users/preferences:
 *   patch:
 *     summary: Update user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plannerView:
 *                 type: string
 *                 enum: [grid, list, kanban, calendar]
 *               defaultPlanner:
 *                 type: string
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               activityReminders:
 *                 type: boolean
 *               weeklyDigest:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.patch('/users/preferences',
    validationMiddleware(userController.userValidation.updatePreferences),
    userController.updatePreferences
);

/**
 * @swagger
 * /users/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: Invalid file format or size
 */
router.post('/users/avatar',
    rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
    validationMiddleware(userController.userValidation.uploadAvatar),
    userController.uploadAvatar
);

/**
 * @swagger
 * /users/avatar:
 *   delete:
 *     summary: Remove user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar removed successfully
 */
router.delete('/users/avatar', userController.removeAvatar);

/**
 * @swagger
 * /users/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/users/notifications',
    validationMiddleware(userController.userValidation.getNotifications),
    userController.getNotifications
);

/**
 * @swagger
 * /users/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.post('/users/notifications/:id/read',
    validationMiddleware(userController.userValidation.markNotificationRead),
    userController.markNotificationRead
);

/**
 * @swagger
 * /users/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/users/notifications/read-all', userController.markAllNotificationsRead);

/**
 * @swagger
 * /users/sessions:
 *   get:
 *     summary: Get user sessions
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 */
router.get('/users/sessions', userController.getSessions);

/**
 * @swagger
 * /users/sessions/{id}:
 *   delete:
 *     summary: Revoke user session
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       404:
 *         description: Session not found
 */
router.delete('/users/sessions/:id',
    validationMiddleware(userController.userValidation.revokeSession),
    userController.revokeSession
);

/**
 * @swagger
 * /users/export-data:
 *   post:
 *     summary: Export user data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *               includeData:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [profile, planners, activities, settings]
 *     responses:
 *       200:
 *         description: Data exported successfully
 *       429:
 *         description: Too many export requests
 */
router.post('/users/export-data',
    rateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 1 }), // 1 export per day
    validationMiddleware(userController.userValidation.exportData),
    userController.exportData
);

/**
 * @swagger
 * /users/delete-account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmation
 *             properties:
 *               password:
 *                 type: string
 *               confirmation:
 *                 type: string
 *               reason:
 *                 type: string
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Invalid password or confirmation
 *       401:
 *         description: Unauthorized
 */
router.delete('/users/delete-account',
    validationMiddleware(userController.userValidation.deleteAccount),
    userController.deleteAccount
);

export default router;