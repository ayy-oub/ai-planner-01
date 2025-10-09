import { AuthService } from '../../../../src/modules/auth/auth.service';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import { JwtService } from '../../../../src/shared/services/jwt.service';
import { EmailService } from '../../../../src/shared/services/email.service';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { UserRole } from '../../../../src/shared/types/auth.types';
import { createMockUser, mockJwtToken } from '../../../utils/test-helpers';

jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/shared/services/jwt.service');
jest.mock('../../../../src/shared/services/email.service');
jest.mock('../../../../src/shared/services/cache.service');

describe('AuthService', () => {
    let authService: AuthService;
    let authRepository: jest.Mocked<AuthRepository>;
    let jwtService: jest.Mocked<JwtService>;
    let emailService: jest.Mocked<EmailService>;
    let cacheService: jest.Mocked<CacheService>;

    beforeEach(() => {
        authRepository = new AuthRepository() as jest.Mocked<AuthRepository>;
        jwtService = new JwtService() as jest.Mocked<JwtService>;
        emailService = new EmailService() as jest.Mocked<EmailService>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;

        authService = new AuthService(
            authRepository,
            jwtService,
            emailService,
            cacheService
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const registrationData = {
            email: 'test@example.com',
            password: 'SecurePass123!',
            displayName: 'Test User'
        };

        it('should successfully register a new user', async () => {
            const mockUser = createMockUser();
            authRepository.createUser.mockResolvedValue(mockUser);
            emailService.sendVerificationEmail.mockResolvedValue();

            const result = await authService.register(registrationData);

            expect(authRepository.createUser).toHaveBeenCalledWith({
                email: registrationData.email,
                password: registrationData.password,
                displayName: registrationData.displayName
            });
            expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
                registrationData.email,
                expect.any(String)
            );
            expect(result).toHaveProperty('user', mockUser);
            expect(result).toHaveProperty('tokens');
        });

        it('should throw error if email already exists', async () => {
            authRepository.createUser.mockRejectedValue(
                new AppError('Email already exists', 409)
            );

            await expect(authService.register(registrationData))
                .rejects.toThrow('Email already exists');
        });

        it('should hash password before storing', async () => {
            const mockUser = createMockUser();
            authRepository.createUser.mockResolvedValue(mockUser);

            await authService.register(registrationData);

            expect(authRepository.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    password: expect.not.stringMatching(registrationData.password)
                })
            );
        });
    });

    describe('login', () => {
        const loginData = {
            email: 'test@example.com',
            password: 'SecurePass123!'
        };

        it('should successfully login user with correct credentials', async () => {
            const mockUser = createMockUser();
            authRepository.validateCredentials.mockResolvedValue(mockUser);
            jwtService.generateTokens.mockReturnValue(mockJwtToken);
            cacheService.set.mockResolvedValue();

            const result = await authService.login(loginData);

            expect(authRepository.validateCredentials).toHaveBeenCalledWith(
                loginData.email,
                loginData.password
            );
            expect(jwtService.generateTokens).toHaveBeenCalledWith({
                uid: mockUser.uid,
                email: mockUser.email,
                role: mockUser.role
            });
            expect(result).toHaveProperty('user', mockUser);
            expect(result).toHaveProperty('tokens', mockJwtToken);
        });

        it('should throw error for invalid credentials', async () => {
            authRepository.validateCredentials.mockRejectedValue(
                new AppError('Invalid credentials', 401)
            );

            await expect(authService.login(loginData))
                .rejects.toThrow('Invalid credentials');
        });

        it('should throw error if account is locked', async () => {
            authRepository.validateCredentials.mockRejectedValue(
                new AppError('Account is locked', 423)
            );

            await expect(authService.login(loginData))
                .rejects.toThrow('Account is locked');
        });

        it('should increment failed login attempts', async () => {
            authRepository.validateCredentials.mockRejectedValue(
                new AppError('Invalid credentials', 401)
            );
            authRepository.incrementFailedAttempts.mockResolvedValue();

            await expect(authService.login(loginData))
                .rejects.toThrow('Invalid credentials');

            expect(authRepository.incrementFailedAttempts).toHaveBeenCalledWith(
                loginData.email
            );
        });
    });

    describe('refreshToken', () => {
        const refreshToken = mockJwtToken.refreshToken;

        it('should successfully refresh access token', async () => {
            const payload = {
                uid: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.USER
            };

            jwtService.verifyRefreshToken.mockReturnValue(payload);
            jwtService.generateAccessToken.mockReturnValue(mockJwtToken.accessToken);
            cacheService.get.mockResolvedValue(null); // Token not blacklisted

            const result = await authService.refreshToken(refreshToken);

            expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(jwtService.generateAccessToken).toHaveBeenCalledWith(payload);
            expect(result).toHaveProperty('accessToken', mockJwtToken.accessToken);
        });

        it('should throw error for invalid refresh token', async () => {
            jwtService.verifyRefreshToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(authService.refreshToken('invalid-token'))
                .rejects.toThrow('Invalid refresh token');
        });

        it('should throw error if refresh token is blacklisted', async () => {
            jwtService.verifyRefreshToken.mockReturnValue({
                uid: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.USER
            });
            cacheService.get.mockResolvedValue('blacklisted');

            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow('Refresh token has been revoked');
        });
    });

    describe('logout', () => {
        it('should successfully logout user', async () => {
            const userId = 'test-user-id';
            const refreshToken = mockJwtToken.refreshToken;

            cacheService.set.mockResolvedValue();

            await authService.logout(userId, refreshToken);

            expect(cacheService.set).toHaveBeenCalledWith(
                `blacklist:${refreshToken}`,
                'true',
                expect.any(Number)
            );
        });

        it('should handle logout errors gracefully', async () => {
            const userId = 'test-user-id';
            const refreshToken = mockJwtToken.refreshToken;

            cacheService.set.mockRejectedValue(new Error('Cache error'));

            await expect(authService.logout(userId, refreshToken))
                .rejects.toThrow('Logout failed');
        });
    });

    describe('forgotPassword', () => {
        const email = 'test@example.com';

        it('should successfully send password reset email', async () => {
            const mockUser = createMockUser();
            authRepository.findByEmail.mockResolvedValue(mockUser);
            authRepository.generatePasswordResetToken.mockResolvedValue('reset-token');
            emailService.sendPasswordResetEmail.mockResolvedValue();

            await authService.forgotPassword(email);

            expect(authRepository.findByEmail).toHaveBeenCalledWith(email);
            expect(authRepository.generatePasswordResetToken).toHaveBeenCalledWith(mockUser.uid);
            expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
                email,
                'reset-token'
            );
        });

        it('should not throw error if user does not exist', async () => {
            authRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.forgotPassword(email))
                .resolves.not.toThrow();

            expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        });

        it('should throw error for rate limiting', async () => {
            const mockUser = createMockUser();
            authRepository.findByEmail.mockResolvedValue(mockUser);
            cacheService.get.mockResolvedValue(Date.now()); // Recent request

            await expect(authService.forgotPassword(email))
                .rejects.toThrow('Password reset request already sent');
        });
    });

    describe('resetPassword', () => {
        const resetData = {
            token: 'reset-token',
            newPassword: 'NewSecurePass123!'
        };

        it('should successfully reset password', async () => {
            const mockUser = createMockUser();
            authRepository.verifyPasswordResetToken.mockResolvedValue(mockUser.uid);
            authRepository.updatePassword.mockResolvedValue();
            cacheService.set.mockResolvedValue();

            await authService.resetPassword(resetData);

            expect(authRepository.verifyPasswordResetToken).toHaveBeenCalledWith(
                resetData.token
            );
            expect(authRepository.updatePassword).toHaveBeenCalledWith(
                mockUser.uid,
                expect.any(String)
            );
            expect(cacheService.set).toHaveBeenCalledWith(
                `used:${resetData.token}`,
                'true',
                expect.any(Number)
            );
        });

        it('should throw error for invalid reset token', async () => {
            authRepository.verifyPasswordResetToken.mockRejectedValue(
                new AppError('Invalid or expired token', 400)
            );

            await expect(authService.resetPassword(resetData))
                .rejects.toThrow('Invalid or expired token');
        });

        it('should throw error if token already used', async () => {
            authRepository.verifyPasswordResetToken.mockResolvedValue('user-id');
            cacheService.get.mockResolvedValue('used');

            await expect(authService.resetPassword(resetData))
                .rejects.toThrow('Reset token has already been used');
        });
    });

    describe('validateToken', () => {
        it('should successfully validate access token', async () => {
            const payload = {
                uid: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.USER
            };

            jwtService.verifyAccessToken.mockReturnValue(payload);

            const result = await authService.validateToken(mockJwtToken.accessToken);

            expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(
                mockJwtToken.accessToken
            );
            expect(result).toEqual(payload);
        });

        it('should throw error for invalid token', async () => {
            jwtService.verifyAccessToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(authService.validateToken('invalid-token'))
                .rejects.toThrow('Invalid access token');
        });
    });

    describe('updateProfile', () => {
        const profileData = {
            displayName: 'Updated Name',
            photoURL: 'https://example.com/new-photo.jpg'
        };

        it('should successfully update user profile', async () => {
            const userId = 'test-user-id';
            const mockUser = createMockUser();

            authRepository.updateProfile.mockResolvedValue({
                ...mockUser,
                ...profileData
            });

            const result = await authService.updateProfile(userId, profileData);

            expect(authRepository.updateProfile).toHaveBeenCalledWith(
                userId,
                profileData
            );
            expect(result.displayName).toBe(profileData.displayName);
            expect(result.photoURL).toBe(profileData.photoURL);
        });

        it('should throw error if user not found', async () => {
            const userId = 'non-existent-user';

            authRepository.updateProfile.mockRejectedValue(
                new AppError('User not found', 404)
            );

            await expect(authService.updateProfile(userId, profileData))
                .rejects.toThrow('User not found');
        });
    });

    describe('changePassword', () => {
        const passwordData = {
            currentPassword: 'CurrentPass123!',
            newPassword: 'NewSecurePass123!'
        };

        it('should successfully change password', async () => {
            const userId = 'test-user-id';

            authRepository.validateCurrentPassword.mockResolvedValue(true);
            authRepository.updatePassword.mockResolvedValue();

            await authService.changePassword(userId, passwordData);

            expect(authRepository.validateCurrentPassword).toHaveBeenCalledWith(
                userId,
                passwordData.currentPassword
            );
            expect(authRepository.updatePassword).toHaveBeenCalledWith(
                userId,
                expect.any(String)
            );
        });

        it('should throw error if current password is incorrect', async () => {
            const userId = 'test-user-id';

            authRepository.validateCurrentPassword.mockResolvedValue(false);

            await expect(authService.changePassword(userId, passwordData))
                .rejects.toThrow('Current password is incorrect');

            expect(authRepository.updatePassword).not.toHaveBeenCalled();
        });

        it('should throw error if new password is same as current', async () => {
            const userId = 'test-user-id';
            const samePasswordData = {
                currentPassword: 'SamePass123!',
                newPassword: 'SamePass123!'
            };

            authRepository.validateCurrentPassword.mockResolvedValue(true);

            await expect(authService.changePassword(userId, samePasswordData))
                .rejects.toThrow('New password must be different from current password');
        });
    });

    describe('verifyEmail', () => {
        const verificationData = {
            token: 'verification-token'
        };

        it('should successfully verify email', async () => {
            const mockUser = createMockUser();

            authRepository.verifyEmailToken.mockResolvedValue(mockUser.uid);
            authRepository.markEmailAsVerified.mockResolvedValue({
                ...mockUser,
                emailVerified: true
            });

            const result = await authService.verifyEmail(verificationData.token);

            expect(authRepository.verifyEmailToken).toHaveBeenCalledWith(
                verificationData.token
            );
            expect(authRepository.markEmailAsVerified).toHaveBeenCalledWith(
                mockUser.uid
            );
            expect(result.emailVerified).toBe(true);
        });

        it('should throw error for invalid verification token', async () => {
            authRepository.verifyEmailToken.mockRejectedValue(
                new AppError('Invalid or expired token', 400)
            );

            await expect(authService.verifyEmail(verificationData.token))
                .rejects.toThrow('Invalid or expired token');
        });
    });

    describe('resendVerificationEmail', () => {
        const email = 'test@example.com';

        it('should successfully resend verification email', async () => {
            const mockUser = createMockUser();

            authRepository.findByEmail.mockResolvedValue(mockUser);
            authRepository.generateVerificationToken.mockResolvedValue('new-token');
            emailService.sendVerificationEmail.mockResolvedValue();

            await authService.resendVerificationEmail(email);

            expect(authRepository.findByEmail).toHaveBeenCalledWith(email);
            expect(authRepository.generateVerificationToken).toHaveBeenCalledWith(
                mockUser.uid
            );
            expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
                email,
                'new-token'
            );
        });

        it('should throw error if user not found', async () => {
            authRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.resendVerificationEmail(email))
                .rejects.toThrow('User not found');
        });

        it('should throw error if email already verified', async () => {
            const mockUser = createMockUser({ emailVerified: true });

            authRepository.findByEmail.mockResolvedValue(mockUser);

            await expect(authService.resendVerificationEmail(email))
                .rejects.toThrow('Email already verified');
        });
    });
});