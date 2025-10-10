// src/modules/auth/auth.service.ts
import { injectable, inject } from 'tsyringe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../shared/config';
import { AuthRepository } from './auth.repository';
import { UserRepository } from '../user/user.repository';
import { CacheService } from '../../shared/services/cache.service';
import { EmailService } from '../../shared/services/email.service';
import { AuditService } from '../../shared/services/audit.service';
import { QueueService } from '../../shared/services/queue.service';
import { FirebaseService } from '../../shared/services/firebase.service';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UserProfile,
  AuthTokens,
  SecurityLog,
} from './auth.types';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { validateEmail, validatePassword } from '../../shared/utils/validators';

@injectable()
export class AuthService {
  constructor(
    @inject('AuthRepository') private authRepository: AuthRepository,
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('CacheService') private cacheService: CacheService,
    @inject('EmailService') private emailService: EmailService,
    @inject('AuditService') private auditService: AuditService,
    @inject('QueueService') private queueService: QueueService,
    @inject('FirebaseService') private firebaseService: FirebaseService
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Public Auth Methods                                               */
  /* ------------------------------------------------------------------ */

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      this.validateRegistrationData(data);
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) throw new BadRequestError('User already exists with this email');

      const hashedPassword = await bcrypt.hash(data.password, config.security.bcryptRounds);
      const uid = uuidv4();
      const userData = {
        uid,
        email: data.email.toLowerCase(),
        displayName: data.displayName,
        photoURL: data.photoURL || null,
        emailVerified: false,
        preferences: {
          theme: 'light',
          accentColor: '#3B82F6',
          defaultView: 'grid',
          notifications: true,
          language: 'en',
        },
        subscription: {
          plan: 'free',
          status: 'active',
          expiresAt: null,
        },
        statistics: {
          totalPlanners: 0,
          totalTasks: 0,
          completedTasks: 0,
          streakDays: 0,
        },
        security: {
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
          twoFactorEnabled: false,
          sessions: [],
          loginHistory: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      await this.firebaseService.createUser({
        uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        password: data.password,
      });

      const user = await this.userRepository.create(userData);
      const tokens = await this.generateTokens(user.uid, user.email);
      await this.sendVerificationEmail(user.email, user.displayName, tokens.accessToken);

      await this.logSecurityEvent(user.uid, 'USER_REGISTERED', {
        email: user.email,
        ip: data.ip,
        userAgent: data.userAgent,
      });

      await this.queueService.addJob('sendWelcomeEmail', {
        email: user.email,
        displayName: user.displayName,
      });

      logger.info(`User registered successfully: ${user.email}`);
      return {
        user: this.mapUserToProfile(user),
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
      const user = await this.userRepository.findByEmail(email.toLowerCase());
      if (!user) throw new UnauthorizedError('Invalid credentials');

      if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
        throw new ForbiddenError('Account is locked. Please try again later.');
      }

      const isPasswordValid = await bcrypt.compare(password, user.security.password);
      if (!isPasswordValid) {
        await this.handleFailedLogin(user);
        throw new UnauthorizedError('Invalid credentials');
      }

      if (!user.emailVerified) throw new ForbiddenError('Please verify your email before logging in');

      const tokens = await this.generateTokens(user.uid, user.email);
      await this.userRepository.update(user.uid, {
        lastLogin: new Date(),
        'security.failedLoginAttempts': 0,
        'security.lockedUntil': null,
        updatedAt: new Date(),
      });

      await this.cacheService.set(`session:${user.uid}`, { userId: user.uid, tokens }, config.security.sessionTimeout);
      await this.logSecurityEvent(user.uid, 'USER_LOGIN', { email: user.email, ip, userAgent });

      logger.info(`User logged in successfully: ${user.email}`);
      return {
        user: this.mapUserToProfile(user),
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

      const user = await this.userRepository.findById(payload.userId);
      if (!user) throw new UnauthorizedError('User not found');

      const tokens = await this.generateTokens(user.uid, user.email);
      await this.cacheService.set(`blacklist:${refreshToken}`, true, config.security.refreshTokenExpiry);
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
        await this.cacheService.set(`blacklist:${refreshToken}`, true, config.security.refreshTokenExpiry);
      }
      await this.logSecurityEvent(userId, 'USER_LOGOUT', {});
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return this.mapUserToProfile(user);
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile> {
    const updateData = { ...data, updatedAt: new Date() };
    const updatedUser = await this.userRepository.update(userId, updateData);

    if (data.displayName || data.photoURL) {
      await this.firebaseService.updateUser(userId, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      });
    }

    await this.logSecurityEvent(userId, 'PROFILE_UPDATED', { updatedFields: Object.keys(data) });
    logger.info(`Profile updated for user: ${userId}`);
    return this.mapUserToProfile(updatedUser);
  }

  async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = data;
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.security.password);
    if (!isCurrentPasswordValid) throw new BadRequestError('Current password is incorrect');
    if (!validatePassword(newPassword)) throw new BadRequestError('New password does not meet security requirements');

    const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await this.userRepository.update(userId, {
      'security.password': hashedNewPassword,
      'security.passwordChangedAt': new Date(),
      updatedAt: new Date(),
    });

    await this.invalidateAllSessions(userId);
    await this.emailService.sendPasswordChangeNotification(user.email, user.displayName);
    await this.logSecurityEvent(userId, 'PASSWORD_CHANGED', {});
    logger.info(`Password changed for user: ${userId}`);
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    const { email } = data;
    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) return;

    const resetToken = this.generateSecureToken();
    const resetTokenExpiry = new Date(Date.now() + config.security.passwordResetExpiry);
    await this.userRepository.update(user.uid, {
      'security.passwordResetToken': resetToken,
      'security.passwordResetExpiry': resetTokenExpiry,
      updatedAt: new Date(),
    });

    await this.emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken);
    await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_REQUESTED', { email: user.email });
    logger.info(`Password reset requested for user: ${user.email}`);
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const { token, newPassword } = data;
    const user = await this.authRepository.findByPasswordResetToken(token);
    if (!user) throw new BadRequestError('Invalid or expired reset token');

    if (!user.security.passwordResetExpiry || user.security.passwordResetExpiry < new Date()) {
      throw new BadRequestError('Reset token has expired');
    }

    if (!validatePassword(newPassword)) throw new BadRequestError('Password does not meet security requirements');

    const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await this.userRepository.update(user.uid, {
      'security.password': hashedPassword,
      'security.passwordResetToken': null,
      'security.passwordResetExpiry': null,
      'security.passwordChangedAt': new Date(),
      updatedAt: new Date(),
    });

    await this.invalidateAllSessions(user.uid);
    await this.emailService.sendPasswordResetConfirmation(user.email, user.displayName);
    await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_COMPLETED', {});
    logger.info(`Password reset completed for user: ${user.email}`);
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const payload = jwt.verify(token, config.security.jwtSecret) as any;
      const user = await this.userRepository.findById(payload.userId);
      if (!user) throw new BadRequestError('Invalid verification token');

      await this.userRepository.update(user.uid, { emailVerified: true, updatedAt: new Date() });
      await this.firebaseService.updateUser(user.uid, { emailVerified: true });
      await this.logSecurityEvent(user.uid, 'EMAIL_VERIFIED', { email: user.email });
      logger.info(`Email verified for user: ${user.email}`);
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw new BadRequestError('Invalid or expired verification token');
    }
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.emailVerified) throw new BadRequestError('Email is already verified');

    const verificationToken = jwt.sign(
      { userId: user.uid, type: 'email_verification' },
      config.security.jwtSecret,
      { expiresIn: config.security.emailVerificationExpiry }
    );

    await this.emailService.sendVerificationEmail(user.email, user.displayName, verificationToken);
    await this.logSecurityEvent(user.uid, 'VERIFICATION_EMAIL_RESENT', { email: user.email });
    logger.info(`Verification email resent for user: ${user.email}`);
  }

  async getSecurityLog(userId: string, page: number, limit: number): Promise<any[]> {
    return []; // Placeholder – implement pagination later
  }

  async toggleTwoFactor(userId: string, enable: boolean): Promise<{ enabled: boolean }> {
    return { enabled: enable }; // Placeholder – implement 2FA logic later
  }

  /* ------------------------------------------------------------------ */
  /*  Session Management                                                */
  /* ------------------------------------------------------------------ */

  async getSessions(userId: string): Promise<any[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user.security.sessions || [];
  }

  async terminateSession(userId: string, sessionId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const sessions = (user.security.sessions || []).filter((s: any) => s.id !== sessionId);
    await this.userRepository.update(userId, { 'security.sessions': sessions });
    await this.cacheService.delete(`session:${sessionId}`);
    logger.info(`Session terminated for user: ${userId}, session: ${sessionId}`);
  }

  async terminateAllOtherSessions(userId: string, currentSessionId?: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const sessions = (user.security.sessions || []).filter((s: any) => s.id === currentSessionId);
    await this.userRepository.update(userId, { 'security.sessions': sessions });

    const allSessionIds = (user.security.sessions || []).map((s: any) => s.id);
    for (const sid of allSessionIds) {
      if (sid !== currentSessionId) {
        await this.cacheService.delete(`session:${sid}`);
      }
    }

    logger.info(`All other sessions terminated for user: ${userId}`);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = jwt.sign({ userId, email, type: 'access' }, config.security.jwtSecret, { expiresIn: config.security.accessTokenExpiry });
    const refreshToken = jwt.sign({ userId, email, type: 'refresh' }, config.security.jwtSecret, { expiresIn: config.security.refreshTokenExpiry });
    return { accessToken, refreshToken, expiresIn: config.security.accessTokenExpirySeconds };
  }

  private async handleFailedLogin(user: any): Promise<void> {
    const failedAttempts = (user.security.failedLoginAttempts || 0) + 1;
    const updateData: any = { 'security.failedLoginAttempts': failedAttempts, updatedAt: new Date() };
    if (failedAttempts >= 5) {
      updateData['security.lockedUntil'] = new Date(Date.now() + config.security.lockoutDuration);
      await this.emailService.sendAccountLockedEmail(user.email, user.displayName);
    }
    await this.userRepository.update(user.uid, updateData);
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.cacheService.delete(`session:${userId}`);
    await this.cacheService.set(`session-invalidation:${userId}`, Date.now(), config.security.refreshTokenExpiry);
  }

  private validateRegistrationData(data: RegisterRequest): void {
    if (!validateEmail(data.email)) throw new BadRequestError('Invalid email format');
    if (!validatePassword(data.password)) throw new BadRequestError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');
    if (!data.displayName || data.displayName.trim().length < 2) throw new BadRequestError('Display name must be at least 2 characters');
    if (data.displayName.length > 50) throw new BadRequestError('Display name must not exceed 50 characters');
  }

  private generateSecureToken(): string {
    return uuidv4().replace(/-/g, '');
  }

  private mapUserToProfile(user: any): UserProfile {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      preferences: user.preferences,
      subscription: user.subscription,
      statistics: user.statistics,
      security: {
        twoFactorEnabled: user.security.twoFactorEnabled,
        passwordChangedAt: user.security.passwordChangedAt,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
    };
  }

  private async sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(email, displayName, token);
    } catch (err) {
      logger.error('Failed to send verification email:', err);
    }
  }

  private async logSecurityEvent(userId: string, event: string, metadata: any): Promise<void> {
    try {
      const securityLog: SecurityLog = {
        id: uuidv4(),
        userId,
        event,
        metadata,
        timestamp: new Date(),
        ip: metadata.ip || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
      };
      await this.auditService.logSecurityEvent(securityLog);
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async isSessionInvalidated(userId: string, issuedAt: number): Promise<boolean> {
    const invalidationTime = await this.cacheService.get(`session-invalidation:${userId}`);
    return invalidationTime && issuedAt < invalidationTime;
  }
}