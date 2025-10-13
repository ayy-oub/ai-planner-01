import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { AuthService } from './auth.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UserPayload,
} from './auth.types';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

type AuthRequest = Request & { user?: UserPayload };

@injectable()
export class AuthController {
  constructor(@inject('AuthService') private authService: AuthService) {}

  register = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const registrationData: RegisterRequest = {
        email: req.body.email,
        password: req.body.password,
        displayName: req.body.displayName,
        acceptTerms: req.body.acceptTerms,
        marketingEmails: req.body.marketingEmails,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };

      const result = await this.authService.register(registrationData);
      const response = new ApiResponse(req).success(result, 'Registration successful');
      (response as any).statusCode = 201;
      res.status(201).json(response);
    } catch (error) {
      logger.error('Registration controller error:', error);
      next(error);
    }
  });

  login = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginRequest = {
        email: req.body.email,
        password: req.body.password,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };

      const result = await this.authService.login(loginData);

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const response = new ApiResponse(req).success({
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }, 'Login successful');
      res.json(response);
    } catch (error) {
      logger.error('Login controller error:', error);
      next(error);
    }
  });

  refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken: RefreshTokenRequest = req.cookies.refreshToken || req.body.refreshToken;
      if (!refreshToken) {
        const err = new AppError('Refresh token is required', 401, 'UNAUTHORIZED');
        res.status(401).json(new ApiResponse(req).error(err));
        return;
      }

      const tokens = await this.authService.refreshToken(refreshToken);
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const response = new ApiResponse(req).success({
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      }, 'Token refreshed successfully');
      res.json(response);
    } catch (error) {
      logger.error('Refresh token controller error:', error);
      res.clearCookie('refreshToken');
      next(error);
    }
  });

  logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.uid;
      const refreshToken = req.cookies.refreshToken;
      if (userId) await this.authService.logout(userId, refreshToken);
      res.clearCookie('refreshToken');
      const response = new ApiResponse(req).success(null, 'Logged out successfully');
      res.json(response);
    } catch (error) {
      logger.error('Logout controller error:', error);
      next(error);
    }
  });

  getProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const profile = await this.authService.getProfile(userId);
      const response = new ApiResponse(req).success(profile, 'Profile retrieved successfully');
      res.json(response);
    } catch (error) {
      logger.error('Get profile controller error:', error);
      next(error);
    }
  });

  updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const updateData: UpdateProfileRequest = {
        displayName: req.body.displayName,
        photoURL: req.body.photoURL,
        preferences: req.body.preferences,
      };
      const updatedProfile = await this.authService.updateProfile(userId, updateData);
      const response = new ApiResponse(req).success(updatedProfile, 'Profile updated successfully');
      res.json(response);
    } catch (error) {
      logger.error('Update profile controller error:', error);
      next(error);
    }
  });

  changePassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const changeData: ChangePasswordRequest = {
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      };
      await this.authService.changePassword(userId, changeData);
      res.clearCookie('refreshToken');
      const response = new ApiResponse(req).success(null, 'Password changed successfully. Please login again.');
      res.json(response);
    } catch (error) {
      logger.error('Change password controller error:', error);
      next(error);
    }
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const forgotData: ForgotPasswordRequest = { email: req.body.email };
      await this.authService.forgotPassword(forgotData);
      const response = new ApiResponse(req).success(null, 'If an account exists with this email, a password reset link has been sent.');
      res.json(response);
    } catch (error) {
      logger.error('Forgot password controller error:', error);
      next(error);
    }
  });

  resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resetData: ResetPasswordRequest = { token: req.body.token, newPassword: req.body.newPassword };
      await this.authService.resetPassword(resetData);
      const response = new ApiResponse(req).success(null, 'Password reset successfully. You can now login with your new password.');
      res.json(response);
    } catch (error) {
      logger.error('Reset password controller error:', error);
      next(error);
    }
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      await this.authService.verifyEmail(token);
      if (req.query.redirect === 'true') return res.redirect(`${process.env.FRONTEND_URL}/auth/email-verified`);
      const response = new ApiResponse(req).success(null, 'Email verified successfully');
      res.json(response);
    } catch (error) {
      logger.error('Verify email controller error:', error);
      if (req.query.redirect === 'true') return res.redirect(`${process.env.FRONTEND_URL}/auth/verification-failed`);
      next(error);
    }
  });

  resendVerificationEmail = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      await this.authService.resendVerificationEmail(userId);
      const response = new ApiResponse(req).success(null, 'Verification email sent successfully');
      res.json(response);
    } catch (error) {
      logger.error('Resend verification email controller error:', error);
      next(error);
    }
  });

  getSecurityLog = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const securityLog = await this.authService.getSecurityLog(userId, page, limit);
      const response = new ApiResponse(req).success(securityLog, 'Security log retrieved successfully');
      res.json(response);
    } catch (error) {
      logger.error('Get security log controller error:', error);
      next(error);
    }
  });

  toggleTwoFactor = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const { enable } = req.body;
      const result = await this.authService.toggleTwoFactor(userId, enable);
      const response = new ApiResponse(req).success(result, `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`);
      res.json(response);
    } catch (error) {
      logger.error('Toggle two-factor controller error:', error);
      next(error);
    }
  });

  // ✅ NEW: Missing session methods
  getSessions = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const sessions = await this.authService.getSessions(userId);
      const response = new ApiResponse(req).success({ sessions }, 'Active sessions retrieved successfully');
      res.json(response);
    } catch (error) {
      logger.error('Get sessions controller error:', error);
      next(error);
    }
  });

  terminateSession = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const { sessionId } = req.params;
      await this.authService.terminateSession(userId, sessionId);
      const response = new ApiResponse(req).success(null, 'Session terminated successfully');
      res.json(response);
    } catch (error) {
      logger.error('Terminate session controller error:', error);
      next(error);
    }
  });

  terminateAllOtherSessions = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const currentSessionId = req.headers['x-session-id'] as string;
      await this.authService.terminateAllOtherSessions(userId, currentSessionId);
      const response = new ApiResponse(req).success(null, 'All other sessions terminated successfully');
      res.json(response);
    } catch (error) {
      logger.error('Terminate all other sessions controller error:', error);
      next(error);
    }
  });
}