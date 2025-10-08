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
    TokenPayload,
    AuthTokens,
    SecurityLog
} from './auth.types';
import {
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    TooManyRequestsError
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
    ) { }

    /**
     * Register a new user
     */
    async register(data: RegisterRequest): Promise<AuthResponse> {
        try {
            // Validate input
            this.validateRegistrationData(data);

            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(data.email);
            if (existingUser) {
                throw new BadRequestError('User already exists with this email');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(data.password, config.security.bcryptRounds);

            // Create user data
            const userData = {
                uid: uuidv4(),
                email: data.email.toLowerCase(),
                displayName: data.displayName,
                photoURL: data.photoURL || null,
                emailVerified: false,
                preferences: {
                    theme: 'light',
                    accentColor: '#3B82F6',
                    defaultView: 'grid',
                    notifications: true,
                    language: 'en'
                },
                subscription: {
                    plan: 'free',
                    status: 'active',
                    expiresAt: null
                },
                statistics: {
                    totalPlanners: 0,
                    totalTasks: 0,
                    completedTasks: 0,
                    streakDays: 0
                },
                security: {
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                    passwordChangedAt: new Date(),
                    twoFactorEnabled: false
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLogin: null
            };

            // Create user in Firebase
            const firebaseUser = await this.firebaseService.createUser({
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                password: data.password
            });

            // Save user to database
            const user = await this.userRepository.create(userData);

            // Generate tokens
            const tokens = await this.generateTokens(user.uid, user.email);

            // Send verification email
            await this.sendVerificationEmail(user.email, user.displayName, tokens.accessToken);

            // Log security event
            await this.logSecurityEvent(user.uid, 'USER_REGISTERED', {
                email: user.email,
                ip: data.ip,
                userAgent: data.userAgent
            });

            // Queue welcome email
            await this.queueService.addJob('sendWelcomeEmail', {
                email: user.email,
                displayName: user.displayName
            });

            logger.info(`User registered successfully: ${user.email}`);

            return {
                user: this.mapUserToProfile(user),
                tokens,
                message: 'Registration successful. Please check your email to verify your account.'
            };

        } catch (error) {
            logger.error('Registration failed:', error);
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(data: LoginRequest): Promise<AuthResponse> {
        try {
            const { email, password, ip, userAgent } = data;

            // Find user by email
            const user = await this.userRepository.findByEmail(email.toLowerCase());
            if (!user) {
                throw new UnauthorizedError('Invalid credentials');
            }

            // Check if account is locked
            if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
                throw new ForbiddenError('Account is locked. Please try again later.');
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.security.password);
            if (!isPasswordValid) {
                await this.handleFailedLogin(user);
                throw new UnauthorizedError('Invalid credentials');
            }

            // Check if email is verified
            if (!user.emailVerified) {
                throw new ForbiddenError('Please verify your email before logging in');
            }

            // Generate tokens
            const tokens = await this.generateTokens(user.uid, user.email);

            // Update last login and reset failed attempts
            await this.userRepository.update(user.uid, {
                lastLogin: new Date(),
                'security.failedLoginAttempts': 0,
                'security.lockedUntil': null,
                updatedAt: new Date()
            });

            // Cache user session
            await this.cacheService.set(
                `session:${user.uid}`,
                { userId: user.uid, tokens },
                config.security.sessionTimeout
            );

            // Log security event
            await this.logSecurityEvent(user.uid, 'USER_LOGIN', {
                email: user.email,
                ip,
                userAgent
            });

            logger.info(`User logged in successfully: ${user.email}`);

            return {
                user: this.mapUserToProfile(user),
                tokens,
                message: 'Login successful'
            };

        } catch (error) {
            logger.error('Login failed:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshToken(data: RefreshTokenRequest): Promise<AuthTokens> {
        try {
            const { refreshToken } = data;

            // Verify refresh token
            const payload = jwt.verify(refreshToken, config.security.jwtSecret) as TokenPayload;

            // Check if token is in blacklist
            const isBlacklisted = await this.cacheService.get(`blacklist:${refreshToken}`);
            if (isBlacklisted) {
                throw new UnauthorizedError('Token has been revoked');
            }

            // Get user from database
            const user = await this.userRepository.findById(payload.userId);
            if (!user) {
                throw new UnauthorizedError('User not found');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user.uid, user.email);

            // Blacklist old refresh token
            await this.cacheService.set(
                `blacklist:${refreshToken}`,
                true,
                config.security.refreshTokenExpiry
            );

            logger.info(`Token refreshed for user: ${user.email}`);

            return tokens;

        } catch (error) {
            logger.error('Token refresh failed:', error);
            throw new UnauthorizedError('Invalid refresh token');
        }
    }

    /**
     * Logout user
     */
    async logout(userId: string, refreshToken?: string): Promise<void> {
        try {
            // Remove session from cache
            await this.cacheService.delete(`session:${userId}`);

            // Blacklist refresh token if provided
            if (refreshToken) {
                await this.cacheService.set(
                    `blacklist:${refreshToken}`,
                    true,
                    config.security.refreshTokenExpiry
                );
            }

            // Log security event
            await this.logSecurityEvent(userId, 'USER_LOGOUT', {});

            logger.info(`User logged out: ${userId}`);

        } catch (error) {
            logger.error('Logout failed:', error);
            throw error;
        }
    }

    /**
     * Get user profile
     */
    async getProfile(userId: string): Promise<UserProfile> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            return this.mapUserToProfile(user);

        } catch (error) {
            logger.error('Get profile failed:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile> {
        try {
            const updateData: any = {
                ...data,
                updatedAt: new Date()
            };

            // Update user profile
            const updatedUser = await this.userRepository.update(userId, updateData);

            // Update Firebase user if displayName or photoURL changed
            if (data.displayName || data.photoURL) {
                await this.firebaseService.updateUser(userId, {
                    displayName: data.displayName,
                    photoURL: data.photoURL
                });
            }

            // Log security event
            await this.logSecurityEvent(userId, 'PROFILE_UPDATED', {
                updatedFields: Object.keys(data)
            });

            logger.info(`Profile updated for user: ${userId}`);

            return this.mapUserToProfile(updatedUser);

        } catch (error) {
            logger.error('Update profile failed:', error);
            throw error;
        }
    }

    /**
     * Change password
     */
    async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
        try {
            const { currentPassword, newPassword } = data;

            // Get user
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.security.password);
            if (!isCurrentPasswordValid) {
                throw new BadRequestError('Current password is incorrect');
            }

            // Validate new password
            if (!validatePassword(newPassword)) {
                throw new BadRequestError('New password does not meet security requirements');
            }

            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

            // Update password
            await this.userRepository.update(userId, {
                'security.password': hashedNewPassword,
                'security.passwordChangedAt': new Date(),
                updatedAt: new Date()
            });

            // Invalidate all existing sessions
            await this.invalidateAllSessions(userId);

            // Send password change notification email
            await this.emailService.sendPasswordChangeNotification(user.email, user.displayName);

            // Log security event
            await this.logSecurityEvent(userId, 'PASSWORD_CHANGED', {});

            logger.info(`Password changed for user: ${userId}`);

        } catch (error) {
            logger.error('Change password failed:', error);
            throw error;
        }
    }

    /**
     * Forgot password
     */
    async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
        try {
            const { email } = data;

            // Find user by email
            const user = await this.userRepository.findByEmail(email.toLowerCase());
            if (!user) {
                // Don't reveal whether user exists
                return;
            }

            // Generate password reset token
            const resetToken = this.generateSecureToken();
            const resetTokenExpiry = new Date(Date.now() + config.security.passwordResetExpiry);

            // Save reset token
            await this.userRepository.update(user.uid, {
                'security.passwordResetToken': resetToken,
                'security.passwordResetExpiry': resetTokenExpiry,
                updatedAt: new Date()
            });

            // Send password reset email
            await this.emailService.sendPasswordResetEmail(
                user.email,
                user.displayName,
                resetToken
            );

            // Log security event
            await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_REQUESTED', {
                email: user.email
            });

            logger.info(`Password reset requested for user: ${user.email}`);

        } catch (error) {
            logger.error('Forgot password failed:', error);
            throw error;
        }
    }

    /**
     * Reset password
     */
    async resetPassword(data: ResetPasswordRequest): Promise<void> {
        try {
            const { token, newPassword } = data;

            // Find user by reset token
            const user = await this.userRepository.findByPasswordResetToken(token);
            if (!user) {
                throw new BadRequestError('Invalid or expired reset token');
            }

            // Check if token is expired
            if (!user.security.passwordResetExpiry ||
                user.security.passwordResetExpiry < new Date()) {
                throw new BadRequestError('Reset token has expired');
            }

            // Validate new password
            if (!validatePassword(newPassword)) {
                throw new BadRequestError('Password does not meet security requirements');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

            // Update password and clear reset token
            await this.userRepository.update(user.uid, {
                'security.password': hashedPassword,
                'security.passwordResetToken': null,
                'security.passwordResetExpiry': null,
                'security.passwordChangedAt': new Date(),
                updatedAt: new Date()
            });

            // Invalidate all existing sessions
            await this.invalidateAllSessions(user.uid);

            // Send password reset confirmation email
            await this.emailService.sendPasswordResetConfirmation(user.email, user.displayName);

            // Log security event
            await this.logSecurityEvent(user.uid, 'PASSWORD_RESET_COMPLETED', {});

            logger.info(`Password reset completed for user: ${user.email}`);

        } catch (error) {
            logger.error('Reset password failed:', error);
            throw error;
        }
    }

    /**
     * Verify email
     */
    async verifyEmail(token: string): Promise<void> {
        try {
            // Verify token
            const payload = jwt.verify(token, config.security.jwtSecret) as TokenPayload;

            // Get user
            const user = await this.userRepository.findById(payload.userId);
            if (!user) {
                throw new BadRequestError('Invalid verification token');
            }

            // Update email verification status
            await this.userRepository.update(user.uid, {
                emailVerified: true,
                updatedAt: new Date()
            });

            // Update Firebase user
            await this.firebaseService.updateUser(user.uid, {
                emailVerified: true
            });

            // Log security event
            await this.logSecurityEvent(user.uid, 'EMAIL_VERIFIED', {
                email: user.email
            });

            logger.info(`Email verified for user: ${user.email}`);

        } catch (error) {
            logger.error('Email verification failed:', error);
            throw new BadRequestError('Invalid or expired verification token');
        }
    }

    /**
     * Resend verification email
     */
    async resendVerificationEmail(userId: string): Promise<void> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            if (user.emailVerified) {
                throw new BadRequestError('Email is already verified');
            }

            // Generate new verification token
            const verificationToken = jwt.sign(
                { userId: user.uid, type: 'email_verification' },
                config.security.jwtSecret,
                { expiresIn: config.security.emailVerificationExpiry }
            );

            // Send verification email
            await this.emailService.sendVerificationEmail(
                user.email,
                user.displayName,
                verificationToken
            );

            // Log security event
            await this.logSecurityEvent(user.uid, 'VERIFICATION_EMAIL_RESENT', {
                email: user.email
            });

            logger.info(`Verification email resent for user: ${user.email}`);

        } catch (error) {
            logger.error('Resend verification email failed:', error);
            throw error;
        }
    }

    /**
     * Generate JWT tokens
     */
    private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
        const payload: TokenPayload = {
            userId,
            email,
            type: 'access'
        };

        const accessToken = jwt.sign(
            { ...payload, type: 'access' },
            config.security.jwtSecret,
            { expiresIn: config.security.accessTokenExpiry }
        );

        const refreshToken = jwt.sign(
            { ...payload, type: 'refresh' },
            config.security.jwtSecret,
            { expiresIn: config.security.refreshTokenExpiry }
        );

        return {
            accessToken,
            refreshToken,
            expiresIn: config.security.accessTokenExpirySeconds
        };
    }

    /**
     * Handle failed login attempt
     */
    private async handleFailedLogin(user: any): Promise<void> {
        const failedAttempts = (user.security.failedLoginAttempts || 0) + 1;

        const updateData: any = {
            'security.failedLoginAttempts': failedAttempts,
            updatedAt: new Date()
        };

        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
            updateData['security.lockedUntil'] = new Date(Date.now() + config.security.lockoutDuration);

            // Send account locked email
            await this.emailService.sendAccountLockedEmail(user.email, user.displayName);
        }

        await this.userRepository.update(user.uid, updateData);
    }

    /**
     * Invalidate all user sessions
     */
    private async invalidateAllSessions(userId: string): Promise<void> {
        // Remove main session
        await this.cacheService.delete(`session:${userId}`);

        // Add userId to global invalidation list
        await this.cacheService.set(
            `session-invalidation:${userId}`,
            Date.now(),
            config.security.refreshTokenExpiry
        );
    }

    /**
     * Validate registration data
     */
    private validateRegistrationData(data: RegisterRequest): void {
        // Validate email
        if (!validateEmail(data.email)) {
            throw new BadRequestError('Invalid email format');
        }

        // Validate password
        if (!validatePassword(data.password)) {
            throw new BadRequestError(
                'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
            );
        }

        // Validate display name
        if (!data.displayName || data.displayName.trim().length < 2) {
            throw new BadRequestError('Display name must be at least 2 characters long');
        }

        if (data.displayName.length > 50) {
            throw new BadRequestError('Display name must not exceed 50 characters');
        }
    }

    /**
     * Generate secure random token
     */
    private generateSecureToken(): string {
        return uuidv4().replace(/-/g, '');
    }

    /**
     * Map user to profile
     */
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
                passwordChangedAt: user.security.passwordChangedAt
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLogin: user.lastLogin
        };
    }

    /**
     * Send verification email
     */
    private async sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
        try {
            await this.emailService.sendVerificationEmail(email, displayName, token);
        } catch (error) {
            logger.error('Failed to send verification email:', error);
            // Don't throw error - user can request verification email later
        }
    }

    /**
     * Log security event
     */
    private async logSecurityEvent(userId: string, event: string, metadata: any): Promise<void> {
        try {
            const securityLog: SecurityLog = {
                id: uuidv4(),
                userId,
                event,
                metadata,
                timestamp: new Date(),
                ip: metadata.ip || 'unknown',
                userAgent: metadata.userAgent || 'unknown'
            };

            await this.auditService.logSecurityEvent(securityLog);
        } catch (error) {
            logger.error('Failed to log security event:', error);
            // Don't throw - logging failure shouldn't break the main flow
        }
    }

    /**
     * Check if session is invalidated
     */
    async isSessionInvalidated(userId: string, issuedAt: number): Promise<boolean> {
        const invalidationTime = await this.cacheService.get(`session-invalidation:${userId}`);
        return invalidationTime && issuedAt < invalidationTime;
    }
}