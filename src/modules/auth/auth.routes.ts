import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  changePasswordValidation,
  verifyEmailValidation,
} from './auth.validation';
import { asyncHandler } from '../../shared/utils/async-handler';
import { authRateLimiter } from '@/shared/middleware/rate-limit.middleware';

const router = Router();
const authController = container.resolve(AuthController);

//router.use(authRateLimiter)

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and account management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - acceptTerms
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               acceptTerms:
 *                 type: boolean
 *               marketingEmails:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', validate(registerValidation), asyncHandler(authController.register));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
router.post('/login', validate(loginValidation), asyncHandler(authController.login));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', validate(refreshTokenValidation), asyncHandler(authController.refreshToken));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authMiddleware.authenticate, authMiddleware.logActivity('USER_LOGOUT'), asyncHandler(authController.logout));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authMiddleware.authenticate, asyncHandler(authController.getProfile));

/**
 * @swagger
 * /auth/update-profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Authentication]
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
 *               photoURL:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/update-profile', authMiddleware.authenticate, validate(updateProfileValidation), authMiddleware.logActivity('PROFILE_UPDATED'), asyncHandler(authController.updateProfile));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 */
router.post('/change-password', authMiddleware.authenticate, validate(changePasswordValidation), authMiddleware.logActivity('PASSWORD_CHANGED'), asyncHandler(authController.changePassword));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', validate(forgotPasswordValidation), asyncHandler(authController.forgotPassword));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', validate(resetPasswordValidation), asyncHandler(authController.resetPassword));

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', validate(verifyEmailValidation), asyncHandler(authController.verifyEmail));

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */
router.post('/resend-verification', authMiddleware.authenticate, asyncHandler(authController.resendVerificationEmail));

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get active sessions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved
 */
router.get('/sessions', authMiddleware.authenticate, asyncHandler(authController.getSessions));

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Terminate specific session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session terminated
 */
router.delete('/sessions/:sessionId', authMiddleware.authenticate, asyncHandler(authController.terminateSession));

/**
 * @swagger
 * /auth/sessions/terminate-all:
 *   post:
 *     summary: Terminate all other sessions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Other sessions terminated
 */
router.post('/sessions/terminate-all', authMiddleware.authenticate, asyncHandler(authController.terminateAllOtherSessions));

export default router;