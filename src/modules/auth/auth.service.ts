// src/modules/auth/auth.service.ts
import { injectable, inject } from 'tsyringe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const { v4: uuidv4 } = require('uuid');
import { config } from '../../shared/config';
import { AuthRepository } from './auth.repository';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { AuditService } from '../../shared/services/audit.service';
import { QueueService } from '../../shared/services/queue.service';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  AuthTokens,
  SecurityLog,
  UpdateProfileRequest
} from './auth.types';
import {
  UserProfile,
  SubscriptionStatus,
  User,
  UserSubscriptionPlan,
} from '../user/user.types';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';

@injectable()
export class AuthService {
  constructor(
    @inject('AuthRepository') private authRepository: AuthRepository,
    @inject('CacheService') private cacheService: CacheService,
    @inject('EmailService') private emailService: EmailService,
    @inject('AuditService') private auditService: AuditService,
    @inject('QueueService') private queueService: QueueService
  ) { }

  /* ------------------------------------------------------------------ */
  /*  Public Auth Methods                                               */
  /* ------------------------------------------------------------------ */

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const existingUser = await this.authRepository.findByEmail(data.email);
      if (existingUser) throw new BadRequestError('User already exists with this email');

      const hashedPassword = await bcrypt.hash(data.password, config.security.bcryptRounds);
      const userData: Partial<User> = {
        email: data.email.toLowerCase(),
        displayName: data.displayName,
        photoURL: undefined,
        emailVerified: false,
        preferences: {
          theme: 'light' as const,
          accentColor: '#3B82F6',
          defaultView: 'grid' as const,
          notifications: {
            email: true,
            push: true,
            sms: false,
            frequency: 'daily',
            categories: {
              taskReminders: true,
              deadlineAlerts: false,
              productivityInsights: false,
              marketing: false,
              updates: false,
            }
          },
          language: 'en',
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY' as const,
          timeFormat: '12h' as const,
          weekStartsOn: 0,
          compactMode: false,
          showCompleted: true,
          autoSave: true,
          soundEnabled: true,
        },
        subscription: {
          plan: UserSubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: undefined,
          features: ['basic-planning', 'basic-export'],
          limits: {
            maxPlanners: 5,
            maxCollaborators: 3,
            maxStorage: 104857600,
            maxAIRequests: 50,
          },
        },
        statistics: {
          totalPlanners: 0,
          totalTasks: 0,
          completedTasks: 0,
          streakDays: 0,
          longestStreak: 0,
          lastActiveDate: undefined,
          lastActivity: undefined,
          totalLoginTime: 0,
          aiSuggestionsUsed: 0,
          accountAge: 0,
          loginCount: 0,
          totalTimeSpent: 0,
          productivityScore: 0,
        },
        security: {
          twoFactorEnabled: false,
          backupCodes: [],
          sessions: [],
          loginHistory: [],
          failedLoginAttempts: 0,
          lockedUntil: undefined,
          passwordChangedAt: new Date(),
          trustedDevices: [],
          recentActivity: [],
          password: hashedPassword, // internal only
        },
        lastLogin: undefined,
        emailVerifiedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        isActive: true,
        isDeleted: false,
      };
      const user = await this.authRepository.create(userData);
      const tokens = await this.generateTokens(user.uid, user.email);
      await this.sendVerificationEmail(user.email, user.displayName ?? 'Client', tokens.accessToken);

      await this.logSecurityEvent(user.uid, 'USER_REGISTERED', {
        email: user.email,
        ip: data.ip,
        userAgent: data.userAgent,
      });

      await this.queueService.addJob(
        'emails', // queue name
        'sendWelcomeEmail', // job type
        {
          email: user.email,
          displayName: user.displayName ?? 'User',
        }
      );

      logger.info(`User registered successfully: ${user.email}`);
      // Strip internal fields before returning
      const { password, ...safeUser } = user;
      return {
        user: safeUser as User, // ✅ full User shape
        tokens,
        message: 'Registration successful. Please check your email to verify your account.',
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const { email, password, ip, userAgent } = data;
      const user = await this.authRepository.findByEmail(email.toLowerCase());
      if (!user) throw new UnauthorizedError('Invalid credentials');

      const hash = user.security.password;
      if (!hash) throw new UnauthorizedError('Invalid credentials');

      const isPasswordValid = await bcrypt.compare(password, hash);
      if (!isPasswordValid) {
        await this.handleFailedLogin(user);
        throw new UnauthorizedError('Invalid credentials');
      }

      if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
        throw new ForbiddenError('Account is locked. Please try again later.');
      }

      if (!user.emailVerified) throw new ForbiddenError('Please verify your email before logging in');

      const tokens = await this.generateTokens(user.uid, user.email);
      await this.authRepository.update(user.uid, {
        lastLogin: new Date(),
        updatedAt: new Date(),
        security: {
          ...user.security,          // keep existing fields
          failedLoginAttempts: 0,
          lockedUntil: undefined,
        },
      });

      await this.cacheService.set(`session:${user.uid}`, { userId: user.uid, tokens }, { ttl: Math.floor(config.security.sessionTimeout / 1000) });
      await this.logSecurityEvent(user.uid, 'USER_LOGIN', { email: user.email, ip, userAgent });

      logger.info(`User logged in successfully: ${user.email}`);
      const { password: _, ...safeUser } = user;
      return {
        user: safeUser as User,
        tokens,
        message: 'Login successful',
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async refreshToken(data: RefreshTokenRequest): Promise<AuthTokens> {
    try {
      const { refreshToken } = data;
      const payload = jwt.verify(refreshToken, config.security.jwtSecret) as any;
      const isBlacklisted = await this.cacheService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) throw new UnauthorizedError('Token has been revoked');

      const user = await this.authRepository.findById(payload.userId);
      if (!user) throw new UnauthorizedError('User not found');

      const tokens = await this.generateTokens(user.uid, user.email);
      await this.cacheService.set(`blacklist:${refreshToken}`, true, config.security.jwtRefreshExpire);
      logger.info(`Token refreshed for user: ${user.email}`);
      return tokens;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      await this.cacheService.delete(`session:${userId}`);
      if (refreshToken) {
        await this.cacheService.set(`blacklist:${refreshToken}`, true, config.security.jwtRefreshExpire);
      }
      await this.logSecurityEvent(userId, 'USER_LOGOUT', {});
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const { password, ...safeUser } = user;
    return safeUser as UserProfile;
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    // 1. Merge partial prefs into current full prefs
    const mergedPrefs = data.preferences
      ? { ...user.preferences, ...data.preferences }
      : user.preferences;

    // 2. Build full update payload
    const updateData: Partial<User> = {
      ...data,
      preferences: mergedPrefs, // ✅ full UserPreferences
      updatedAt: new Date(),
    };

    const updatedUser = await this.authRepository.update(userId, updateData);
    await this.logSecurityEvent(userId, 'PROFILE_UPDATED', { updatedFields: Object.keys(data) });
    logger.info(`Profile updated for user: ${userId}`);
    const { password, ...safeUser } = updatedUser;
    return safeUser as UserProfile;
  }

  async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = data;

    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const hash = user.security.password;
    if (!hash) throw new UnauthorizedError('Invalid credentials');

    const isValid = await bcrypt.compare(currentPassword, hash);
    if (!isValid) throw new BadRequestError('Current password is incorrect');

    const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    // Merge security sub-document
    await this.authRepository.update(userId, {
      updatedAt: new Date(),
      security: {
        ...user.security,
        password: hashedNewPassword,
        passwordChangedAt: new Date(),
      },
    });

    await this.invalidateAllSessions(userId);
    await this.emailService.sendPasswordChangeNotification(
      user.email,
      user.displayName ?? 'User'
    );
    await this.logSecurityEvent(userId, 'PASSWORD_CHANGED', {});
    logger.info(`Password changed for user: ${userId}`);
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    const { email } = data;
    const user = await this.authRepository.findByEmail(email.toLowerCase());
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    const resetToken = this.generateSecureToken();
    const resetTokenExpiry = new Date(Date.now() + config.security.jwtResetPasswordExpire);

    await this.authRepository.update(user.uid, {
      security: {
        ...user.security,
        passwordResetToken: resetToken,
        passwordResetExpiry: resetTokenExpiry,
      },
      updatedAt: new Date(),
    });

    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.displayName ?? 'User',
      resetToken
    );

    await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_REQUESTED', { email: user.email });
    logger.info(`Password reset requested for user: ${user.email}`);
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const { token, newPassword } = data;

    const user = await this.authRepository.findByPasswordResetToken(token);
    if (!user) throw new BadRequestError('Invalid or expired reset token');

    const expiry = user.security.passwordResetExpiry;
    if (!expiry || expiry < new Date()) {
      throw new BadRequestError('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    await this.authRepository.update(user.uid, {
      security: {
        ...user.security,
        password: hashedPassword,
        passwordResetToken: undefined,
        passwordResetExpiry: undefined,
        passwordChangedAt: new Date(),
      },
      updatedAt: new Date(),
    });

    await this.invalidateAllSessions(user.uid);
    await this.emailService.sendPasswordResetConfirmation(
      user.email,
      user.displayName ?? 'User'
    );
    await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_COMPLETED', { email: user.email });
    logger.info(`Password reset completed for user: ${user.email}`);
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const payload = jwt.verify(token, config.security.jwtSecret) as { userId: string };
      const user = await this.authRepository.findById(payload.userId);
      if (!user) throw new BadRequestError('Invalid verification token');

      await this.authRepository.update(user.uid, {
        emailVerified: true,
        updatedAt: new Date(),
      });

      await this.logSecurityEvent(user.uid, 'EMAIL_VERIFIED', { email: user.email });
      logger.info(`Email verified for user: ${user.email}`);
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw new BadRequestError('Invalid or expired verification token');
    }
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.emailVerified) throw new BadRequestError('Email is already verified');

    const verificationToken = jwt.sign(
      { userId: user.uid, type: 'email_verification' },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtEmailVerifyExpire }
    );

    await this.emailService.sendVerificationEmail(
      user.email,
      user.displayName ?? 'User',
      verificationToken
    );

    await this.logSecurityEvent(user.uid, 'VERIFICATION_EMAIL_RESENT', { email: user.email });
    logger.info(`Verification email resent for user: ${user.email}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Security Log + Two-Factor                                          */
  /* ------------------------------------------------------------------ */

  async getSecurityLog(userId: string, page: number, limit: number): Promise<SecurityLog[]> {
    return this.authRepository.getSecurityLogs(userId, page, limit);
  }

  async toggleTwoFactor(userId: string, enable: boolean): Promise<{ enabled: boolean }> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (user.security.twoFactorEnabled === enable) return { enabled: enable };

    await this.authRepository.update(userId, {
      security: {
        ...user.security,
        twoFactorEnabled: enable,
      },
      updatedAt: new Date(),
    });

    await this.logSecurityEvent(
      userId,
      enable ? 'TWO_FACTOR_ENABLED' : 'TWO_FACTOR_DISABLED',
      {}
    );

    logger.info(`Two-factor authentication ${enable ? 'enabled' : 'disabled'} for user: ${userId}`);
    return { enabled: enable };
  }

  /* ------------------------------------------------------------------ */
  /*  Session Management                                                 */
  /* ------------------------------------------------------------------ */

  async getSessions(userId: string): Promise<any[]> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user.security.sessions ?? [];
  }

  async terminateSession(userId: string, sessionId: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const remainingSessions = (user.security.sessions ?? []).filter(
      (s: any) => s.id !== sessionId
    );

    await this.authRepository.update(userId, {
      security: { ...user.security, sessions: remainingSessions },
      updatedAt: new Date(),
    });

    await this.cacheService.delete(`session:${sessionId}`);
    await this.logSecurityEvent(userId, 'SESSION_TERMINATED', { sessionId });

    logger.info(`Session terminated for user: ${userId}, session: ${sessionId}`);
  }

  async terminateAllOtherSessions(userId: string, currentSessionId?: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const activeSessions = (user.security.sessions ?? []).filter(
      (s: any) => s.id === currentSessionId
    );

    await this.authRepository.update(userId, {
      security: { ...user.security, sessions: activeSessions },
      updatedAt: new Date(),
    });

    for (const session of user.security.sessions ?? []) {
      if (session.id !== currentSessionId) {
        await this.cacheService.delete(`session:${session.id}`);
      }
    }

    await this.logSecurityEvent(userId, 'OTHER_SESSIONS_TERMINATED', {
      currentSessionId,
    });

    logger.info(`All other sessions terminated for user: ${userId}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { userId, email, type: 'access' },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtAccessExpire }
    );
    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtRefreshExpire }
    );
    return { accessToken, refreshToken, expiresIn: config.security.jwtAccessExpire, tokenType: 'access'};
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const failedAttempts = (user.security.failedLoginAttempts || 0) + 1;

    const updateData: Partial<User> = {
      security: {
        ...user.security,
        failedLoginAttempts: failedAttempts,
      },
      updatedAt: new Date(),
    };

    if (failedAttempts >= 5) {
      // Ensure updateData.security exists
      updateData.security = updateData.security || {
        twoFactorEnabled: false,
        backupCodes: [],
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      };
    
      updateData.security.lockedUntil = new Date(Date.now() + config.security.lockoutDuration);
    
      await this.emailService.sendAccountLockedEmail(
        user.email,
        user.displayName ?? 'User'
      );
    }

    await this.authRepository.update(user.uid, updateData);
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.cacheService.delete(`session:${userId}`);
    await this.cacheService.set(
      `session-invalidation:${userId}`,
      Date.now(),
      config.security.jwtRefreshExpire
    );
  }

  private generateSecureToken(): string {
    return uuidv4().replace(/-/g, '');
  }

  private async sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(email, displayName, token);
    } catch (err) {
      logger.error('Failed to send verification email:', err);
    }
  }

  private async logSecurityEvent(userId: string, event: string, metadata: Record<string, any>): Promise<void> {
    try {
      const securityLog: SecurityLog = {
        id: uuidv4(),
        userId,
        event,
        metadata,
        timestamp: new Date(),
        ip: metadata?.ip ?? 'unknown',
        userAgent: metadata?.userAgent ?? 'unknown',
      };
      await this.auditService.logSecurityEvent(securityLog);
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async isSessionInvalidated(userId: string, issuedAt: number): Promise<boolean> {
    const invalidationTime = await this.cacheService.get(`session-invalidation:${userId}`);
    return Boolean(invalidationTime && issuedAt < invalidationTime);
  }
}
