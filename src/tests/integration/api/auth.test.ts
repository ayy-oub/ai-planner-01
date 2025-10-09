import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabases, cleanupTestDatabases, clearTestData, createTestUser, deleteTestUser } from '../../../utils/test-database';
import { mockUsers } from '../../../utils/mock-data';
import { createApp } from '../../../../src/app';

describe('Auth API Integration Tests', () => {
    let app: Express;
    let server: any;
    let testUserUid: string;

    beforeAll(async () => {
        await initializeTestDatabases();
        app = createApp();
        server = app.listen(0); // Use random port
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
        await cleanupTestDatabases();
    });

    beforeEach(async () => {
        await clearTestData();
    });

    afterEach(async () => {
        if (testUserUid) {
            await deleteTestUser(testUserUid);
            testUserUid = '';
        }
    });

    describe('POST /api/v1/auth/register', () => {
        it('should successfully register a new user', async () => {
            const registrationData = {
                email: 'newuser@example.com',
                password: 'SecurePass123!',
                displayName: 'New User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(registrationData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    user: {
                        email: registrationData.email,
                        displayName: registrationData.displayName,
                        emailVerified: false
                    },
                    tokens: {
                        accessToken: expect.any(String),
                        refreshToken: expect.any(String)
                    }
                }
            });

            testUserUid = response.body.data.user.uid;
        });

        it('should fail with invalid email', async () => {
            const invalidData = {
                email: 'invalid-email',
                password: 'SecurePass123!',
                displayName: 'Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'email',
                        message: expect.stringContaining('valid email')
                    })
                ])
            });
        });

        it('should fail with weak password', async () => {
            const weakPasswordData = {
                email: 'test@example.com',
                password: '123',
                displayName: 'Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(weakPasswordData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'password',
                        message: expect.stringContaining('stronger password')
                    })
                ])
            });
        });

        it('should fail with duplicate email', async () => {
            // First registration
            const registrationData = {
                email: 'duplicate@example.com',
                password: 'SecurePass123!',
                displayName: 'First User'
            };

            await request(app)
                .post('/api/v1/auth/register')
                .send(registrationData)
                .expect(201);

            // Second registration with same email
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    ...registrationData,
                    displayName: 'Second User'
                })
                .expect(409);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Email already exists')
            });
        });

        it('should handle missing required fields', async () => {
            const incompleteData = {
                email: 'test@example.com'
                // missing password and displayName
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(incompleteData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({ field: 'password' }),
                    expect.objectContaining({ field: 'displayName' })
                ])
            });
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            // Create a test user
            testUserUid = await createTestUser({
                uid: 'test-login-user',
                email: 'login@example.com',
                password: 'TestPass123!',
                displayName: 'Login Test User',
                emailVerified: true
            });
        });

        it('should successfully login with correct credentials', async () => {
            const loginData = {
                email: 'login@example.com',
                password: 'TestPass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    user: {
                        email: loginData.email,
                        displayName: 'Login Test User'
                    },
                    tokens: {
                        accessToken: expect.any(String),
                        refreshToken: expect.any(String)
                    }
                }
            });
        });

        it('should fail with incorrect password', async () => {
            const loginData = {
                email: 'login@example.com',
                password: 'WrongPassword123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid credentials')
            });
        });

        it('should fail with non-existent user', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'SomePass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid credentials')
            });
        });

        it('should handle rate limiting', async () => {
            const loginData = {
                email: 'login@example.com',
                password: 'WrongPassword123!'
            };

            // Make multiple failed attempts
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/v1/auth/login')
                    .send(loginData)
                    .expect(401);
            }

            // 6th attempt should be rate limited
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(429);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Too many attempts')
            });
        });

        it('should require email verification for login', async () => {
            // Create unverified user
            const unverifiedUid = await createTestUser({
                uid: 'unverified-user',
                email: 'unverified@example.com',
                password: 'TestPass123!',
                displayName: 'Unverified User',
                emailVerified: false
            });

            const loginData = {
                email: 'unverified@example.com',
                password: 'TestPass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Email verification required')
            });

            await deleteTestUser(unverifiedUid);
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        let refreshToken: string;

        beforeEach(async () => {
            // Create user and get refresh token
            testUserUid = await createTestUser({
                uid: 'test-refresh-user',
                email: 'refresh@example.com',
                password: 'TestPass123!',
                displayName: 'Refresh Test User',
                emailVerified: true
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'refresh@example.com',
                    password: 'TestPass123!'
                });

            refreshToken = loginResponse.body.data.tokens.refreshToken;
        });

        it('should successfully refresh access token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    accessToken: expect.any(String)
                }
            });

            expect(response.body.data.accessToken).not.toBe(refreshToken);
        });

        it('should fail with invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: 'invalid-token' })
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid refresh token')
            });
        });

        it('should fail with expired refresh token', async () => {
            // This would require manipulating token expiration
            // For now, we'll test with a malformed token
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: 'expired-token-format' })
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid refresh token')
            });
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        let accessToken: string;
        let refreshToken: string;

        beforeEach(async () => {
            // Create user and login
            testUserUid = await createTestUser({
                uid: 'test-logout-user',
                email: 'logout@example.com',
                password: 'TestPass123!',
                displayName: 'Logout Test User',
                emailVerified: true
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'logout@example.com',
                    password: 'TestPass123!'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
            refreshToken = loginResponse.body.data.tokens.refreshToken;
        });

        it('should successfully logout user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ refreshToken })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Logged out successfully')
            });
        });

        it('should fail without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .send({ refreshToken })
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should fail with invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ refreshToken: 'invalid-token' })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid refresh token')
            });
        });
    });

    describe('GET /api/v1/auth/me', () => {
        let accessToken: string;

        beforeEach(async () => {
            // Create user and login
            testUserUid = await createTestUser({
                uid: 'test-me-user',
                email: 'me@example.com',
                password: 'TestPass123!',
                displayName: 'Me Test User',
                emailVerified: true
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'me@example.com',
                    password: 'TestPass123!'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should successfully get user profile', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    user: {
                        email: 'me@example.com',
                        displayName: 'Me Test User',
                        emailVerified: true
                    }
                }
            });
        });

        it('should fail without authentication', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid access token')
            });
        });
    });

    describe('PATCH /api/v1/auth/update-profile', () => {
        let accessToken: string;

        beforeEach(async () => {
            // Create user and login
            testUserUid = await createTestUser({
                uid: 'test-update-user',
                email: 'update@example.com',
                password: 'TestPass123!',
                displayName: 'Update Test User',
                emailVerified: true
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'update@example.com',
                    password: 'TestPass123!'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should successfully update user profile', async () => {
            const updateData = {
                displayName: 'Updated Name',
                photoURL: 'https://example.com/new-photo.jpg'
            };

            const response = await request(app)
                .patch('/api/v1/auth/update-profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    user: {
                        displayName: updateData.displayName,
                        photoURL: updateData.photoURL
                    }
                }
            });
        });

        it('should update only provided fields', async () => {
            const updateData = {
                displayName: 'Only Name Updated'
            };

            const response = await request(app)
                .patch('/api/v1/auth/update-profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.data.user.displayName).toBe(updateData.displayName);
            expect(response.body.data.user.email).toBe('update@example.com');
        });

        it('should fail with invalid data', async () => {
            const invalidData = {
                displayName: '', // Empty display name
                photoURL: 'not-a-valid-url'
            };

            const response = await request(app)
                .patch('/api/v1/auth/update-profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });

        it('should fail without authentication', async () => {
            const updateData = {
                displayName: 'Updated Name'
            };

            const response = await request(app)
                .patch('/api/v1/auth/update-profile')
                .send(updateData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });
    });

    describe('POST /api/v1/auth/change-password', () => {
        let accessToken: string;

        beforeEach(async () => {
            // Create user and login
            testUserUid = await createTestUser({
                uid: 'test-change-password-user',
                email: 'changepass@example.com',
                password: 'OldPass123!',
                displayName: 'Change Password User',
                emailVerified: true
            });

            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'changepass@example.com',
                    password: 'OldPass123!'
                });

            accessToken = loginResponse.body.data.tokens.accessToken;
        });

        it('should successfully change password', async () => {
            const passwordData = {
                currentPassword: 'OldPass123!',
                newPassword: 'NewSecurePass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(passwordData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Password changed successfully')
            });

            // Verify new password works
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'changepass@example.com',
                    password: 'NewSecurePass123!'
                });

            expect(loginResponse.status).toBe(200);
        });

        it('should fail with incorrect current password', async () => {
            const passwordData = {
                currentPassword: 'WrongCurrentPass123!',
                newPassword: 'NewSecurePass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(passwordData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Current password is incorrect')
            });
        });

        it('should fail when new password is same as current', async () => {
            const passwordData = {
                currentPassword: 'OldPass123!',
                newPassword: 'OldPass123!'
            };

            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(passwordData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('must be different from current password')
            });
        });

        it('should fail with weak new password', async () => {
            const passwordData = {
                currentPassword: 'OldPass123!',
                newPassword: 'weak'
            };

            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send(passwordData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('stronger password')
            });
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        beforeEach(async () => {
            // Create test user
            testUserUid = await createTestUser({
                uid: 'test-forgot-password-user',
                email: 'forgotpass@example.com',
                password: 'TestPass123!',
                displayName: 'Forgot Password User',
                emailVerified: true
            });
        });

        it('should successfully send password reset email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'forgotpass@example.com'
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Password reset email sent')
            });
        });

        it('should not fail for non-existent user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'nonexistent@example.com'
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('If the email exists')
            });
        });

        it('should fail with invalid email format', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'invalid-email-format'
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });

        it('should implement rate limiting', async () => {
            const email = 'forgotpass@example.com';

            // First request
            await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email })
                .expect(200);

            // Immediate second request should be rate limited
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email })
                .expect(429);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Too many requests')
            });
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        let resetToken: string;

        beforeEach(async () => {
            // Create user and request password reset
            testUserUid = await createTestUser({
                uid: 'test-reset-password-user',
                email: 'resetpass@example.com',
                password: 'OldPass123!',
                displayName: 'Reset Password User',
                emailVerified: true
            });

            // Request password reset to get token
            await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'resetpass@example.com' });

            // In a real scenario, you'd extract the token from the email
            // For testing, we'll use a mock token
            resetToken = 'mock-reset-token';
        });

        it('should successfully reset password with valid token', async () => {
            // This test would require integration with email service
            // For now, we'll test the endpoint structure
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: resetToken,
                    newPassword: 'NewSecurePass123!'
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Password reset successfully')
            });
        });

        it('should fail with invalid reset token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    newPassword: 'NewSecurePass123!'
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid or expired token')
            });
        });

        it('should fail with weak new password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: resetToken,
                    newPassword: 'weak'
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('stronger password')
            });
        });
    });
});