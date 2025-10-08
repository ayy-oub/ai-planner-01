// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { AuthService } from './auth.service';
import { AuthValidation } from './auth.validation';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { authMiddleware } from './auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';
import {
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    ChangePasswordRequest
} from './auth.types';
import { logger } from '../../shared/utils/logger';

@injectable()
export class AuthController {
    constructor(
        @inject('AuthService') private authService: AuthService,
        @inject('AuthValidation') private authValidation: AuthValidation
    ) { }

    /**
     * Register new user
     * POST /auth/register
     */
    register = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const registrationData: RegisterRequest = {
                email: req.body.email,
                password: req.body.password,
                displayName: req.body.displayName,
                photoURL: req.body.photoURL,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };

            const result = await this.authService.register(registrationData);

            ApiResponse.success(res, {
                data: result,
                message: result.message,
                statusCode: 201
            });

        } catch (error) {
            logger.error('Registration controller error:', error);
            next(error);
        }
    });

    /**
     * Login user
     * POST /auth/login
     */
    login = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const loginData: LoginRequest = {
                email: req.body.email,
                password: req.body.password,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };

            const result = await this.authService.login(loginData);

            // Set secure HTTP-only cookie for refresh token
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            ApiResponse.success(res, {
                data: {
                    user: result.user,
                    accessToken: result.tokens.accessToken,
                    expiresIn: result.tokens.expiresIn
                },
                message: result.message
            });

        } catch (error) {
            logger.error('Login controller error:', error);
            next(error);
        }
    });

    /**
     * Refresh access token
     * POST /auth/refresh
     */
    refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

            if (!refreshToken) {
                return ApiResponse.error(res, {
                    message: 'Refresh token is required',
                    statusCode: 401
                });
            }

            const refreshData: RefreshTokenRequest = { refreshToken };
            const tokens = await this.authService.refreshToken(refreshData);

            // Update refresh token cookie
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            ApiResponse.success(res, {
                data: {
                    accessToken: tokens.accessToken,
                    expiresIn: tokens.expiresIn
                },
                message: 'Token refreshed successfully'
            });

        } catch (error) {
            logger.error('Refresh token controller error:', error);

            // Clear invalid refresh token cookie
            res.clearCookie('refreshToken');

            next(error);
        }
    });

    /**
     * Logout user
     * POST /auth/logout
     */
    logout = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.userId;
            const refreshToken = req.cookies.refreshToken;

            if (userId) {
                await this.authService.logout(userId, refreshToken);
            }

            // Clear refresh token cookie
            res.clearCookie('refreshToken');

            ApiResponse.success(res, {
                message: 'Logged out successfully'
            });

        } catch (error) {
            logger.error('Logout controller error:', error);
            next(error);
        }
    });

    /**
     * Get current user profile
     * GET /auth/me
     */
    getProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const profile = await this.authService.getProfile(userId);

            ApiResponse.success(res, {
                data: profile,
                message: 'Profile retrieved successfully'
            });

        } catch (error) {
            logger.error('Get profile controller error:', error);
            next(error);
        }
    });

    /**
     * Update user profile
     * PATCH /auth/update-profile
     */
    updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const updateData: UpdateProfileRequest = {
                displayName: req.body.displayName,
                photoURL: req.body.photoURL,
                preferences: req.body.preferences
            };

            const updatedProfile = await this.authService.updateProfile(userId, updateData);

            ApiResponse.success(res, {
                data: updatedProfile,
                message: 'Profile updated successfully'
            });

        } catch (error) {
            logger.error('Update profile controller error:', error);
            next(error);
        }
    });

    /**
     * Change password
     * POST /auth/change-password
     */
    changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const changeData: ChangePasswordRequest = {
                currentPassword: req.body.currentPassword,
                newPassword: req.body.newPassword
            };

            await this.authService.changePassword(userId, changeData);

            // Clear refresh token cookie to force re-login
            res.clearCookie('refreshToken');

            ApiResponse.success(res, {
                message: 'Password changed successfully. Please login again.'
            });

        } catch (error) {
            logger.error('Change password controller error:', error);
            next(error);
        }
    });

    /**
     * Forgot password
     * POST /auth/forgot-password
     */
    forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const forgotData: ForgotPasswordRequest = {
                email: req.body.email
            };

            await this.authService.forgotPassword(forgotData);

            ApiResponse.success(res, {
                message: 'If an account exists with this email, a password reset link has been sent.'
            });

        } catch (error) {
            logger.error('Forgot password controller error:', error);
            next(error);
        }
    });

    /**
     * Reset password
     * POST /auth/reset-password
     */
    resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const resetData: ResetPasswordRequest = {
                token: req.body.token,
                newPassword: req.body.newPassword
            };

            await this.authService.resetPassword(resetData);

            ApiResponse.success(res, {
                message: 'Password reset successfully. You can now login with your new password.'
            });

        } catch (error) {
            logger.error('Reset password controller error:', error);
            next(error);
        }
    });

    /**
     * Verify email
     * GET /auth/verify-email/:token
     */
    verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { token } = req.params;

            await this.authService.verifyEmail(token);

            // Redirect to frontend success page or return success response
            if (req.query.redirect === 'true') {
                // Redirect to your frontend success page
                return res.redirect(`${process.env.FRONTEND_URL}/auth/email-verified`);
            }

            ApiResponse.success(res, {
                message: 'Email verified successfully'
            });

        } catch (error) {
            logger.error('Verify email controller error:', error);

            if (req.query.redirect === 'true') {
                // Redirect to frontend error page
                return res.redirect(`${process.env.FRONTEND_URL}/auth/verification-failed`);
            }

            next(error);
        }
    });

    /**
     * Resend verification email
     * POST /auth/resend-verification
     */
    resendVerificationEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;

            await this.authService.resendVerificationEmail(userId);

            ApiResponse.success(res, {
                message: 'Verification email sent successfully'
            });

        } catch (error) {
            logger.error('Resend verification email controller error:', error);
            next(error);
        }
    });

    /**
     * Get security log
     * GET /auth/security-log
     */
    getSecurityLog = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            // This would typically be implemented in the service layer
            // For now, returning a placeholder
            const securityLog = await this.authService.getSecurityLog(userId, page, limit);

            ApiResponse.success(res, {
                data: securityLog,
                message: 'Security log retrieved successfully'
            });

        } catch (error) {
            logger.error('Get security log controller error:', error);
            next(error);
        }
    });

    /**
     * Enable/disable two-factor authentication
     * POST /auth/two-factor/toggle
     */
    toggleTwoFactor = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const { enable } = req.body;

            // This would typically be implemented in the service layer
            // For now, returning a placeholder response
            const result = await this.authService.toggleTwoFactor(userId, enable);

            ApiResponse.success(res, {
                data: result,
                message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`
            });

        } catch (error) {
            logger.error('Toggle two-factor controller error:', error);
            next(error);
        }
    });

    /**
     * Setup routes
     */
    setupRoutes() {
        const router = require('express').Router();

        // Public routes
        router.post('/register',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 requests per 15 minutes
            validationMiddleware(this.authValidation.register),
            this.register
        );

        router.post('/login',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 requests per 15 minutes
            validationMiddleware(this.authValidation.login),
            this.login
        );

        router.post('/refresh',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), // 30 requests per 15 minutes
            validationMiddleware(this.authValidation.refreshToken),
            this.refreshToken
        );

        router.post('/logout', this.logout);

        router.post('/forgot-password',
            rateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }), // 3 requests per 15 minutes
            validationMiddleware(this.authValidation.forgotPassword),
            this.forgotPassword
        );

        router.post('/reset-password',
            validationMiddleware(this.authValidation.resetPassword),
            this.resetPassword
        );

        router.get('/verify-email/:token', this.verifyEmail);

        // Protected routes
        router.get('/me',
            authMiddleware(),
            this.getProfile
        );

        router.patch('/update-profile',
            authMiddleware(),
            validationMiddleware(this.authValidation.updateProfile),
            this.updateProfile
        );

        router.post('/change-password',
            authMiddleware(),
            validationMiddleware(this.authValidation.changePassword),
            this.changePassword
        );

        router.post('/resend-verification',
            authMiddleware(),
            this.resendVerificationEmail
        );

        router.get('/security-log',
            authMiddleware(),
            this.getSecurityLog
        );

        router.post('/two-factor/toggle',
            authMiddleware(),
            validationMiddleware(this.authValidation.toggleTwoFactor),
            this.toggleTwoFactor
        );

        return router;
    }
}