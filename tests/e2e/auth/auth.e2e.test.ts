import request from 'supertest';
import app from '@/app';
import { FirebaseService } from '@shared/services/firebase.service';
import { EmailService } from '@shared/services/email.service';

describe('Auth E2E Tests', () => {
    let firebaseService: FirebaseService;
    let emailService: EmailService;
    let testUserEmail: string;

    beforeAll(async () => {
        firebaseService = new FirebaseService();
        emailService = new EmailService();
        testUserEmail = `e2e.test.${Date.now()}@example.com`;
    });

    afterAll(async () => {
        // Clean up test users
        try {
            const user = await firebaseService.getUserByEmail(testUserEmail);
            if (user) {
                await firebaseService.deleteUser(user.uid);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Complete Authentication Flow', () => {
        const testUser = {
            email: testUserEmail,
            password: 'E2ETest123!@#',
            displayName: 'E2E Test User',
        };

        it('should complete full authentication flow', async () => {
            let accessToken: string;
            let refreshToken: string;

            // Step 1: Register new user
            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    ...testUser,
                    acceptTerms: true,
                })
                .expect(201);

            expect(registerResponse.body.success).toBe(true);
            accessToken = registerResponse.body.data.tokens.accessToken;
            refreshToken = registerResponse.body.data.tokens.refreshToken;

            // Step 2: Get user profile
            const profileResponse = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(profileResponse.body.data.user.email).toBe(testUser.email);
            expect(profileResponse.body.data.user.displayName).toBe(testUser.displayName);

            // Step 3: Update profile
            const updatedDisplayName = 'Updated E2E User';
            const updateResponse = await request(app)
                .patch('/api/v1/auth/update-profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    displayName: updatedDisplayName,
                })
                .expect(200);

            expect(updateResponse.body.data.user.displayName).toBe(updatedDisplayName);

            // Step 4: Refresh token
            const refreshResponse = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            const newAccessToken = refreshResponse.body.data.tokens.accessToken;
            const newRefreshToken = refreshResponse.body.data.tokens.refreshToken;

            // Step 5: Verify new token works
            const newProfileResponse = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${newAccessToken}`)
                .expect(200);

            expect(newProfileResponse.body.data.user.displayName).toBe(updatedDisplayName);

            // Step 6: Logout
            await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${newAccessToken}`)
                .expect(200);

            // Step 7: Verify old refresh token doesn't work
            await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(401);

            // Step 8: Verify new refresh token still works
            const finalRefreshResponse = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: newRefreshToken })
                .expect(200);

            expect(finalRefreshResponse.body.success).toBe(true);
        });

        it('should handle password reset flow', async () => {
            // Request password reset
            const forgotResponse = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: testUser.email,
                })
                .expect(200);

            expect(forgotResponse.body.success).toBe(true);

            // In a real E2E test, you would:
            // 1. Check email inbox for reset token
            // 2. Extract token from email
            // 3. Use token to reset password
            // For now, we'll mock this part

            const mockResetToken = 'mock-reset-token-from-email';

            // Mock the email service to return our test token
            jest.spyOn(emailService, 'sendPasswordResetEmail').mockImplementation(async () => {
                // In real E2E, this would send actual email
                return Promise.resolve();
            });

            // Reset password
            const newPassword = 'NewE2EPassword123!@#';
            const resetResponse = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: mockResetToken,
                    newPassword,
                })
                .expect(200);

            expect(resetResponse.body.success).toBe(true);

            // Verify new password works
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: testUser.email,
                    password: newPassword,
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
        });
    });

    describe('Security Tests', () => {
        it('should prevent brute force attacks', async () => {
            const targetEmail = `brute.force.${Date.now()}@example.com`;
            const wrongPassword = 'WrongPassword123!';

            // Create a test user
            await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: targetEmail,
                    password: 'CorrectPassword123!',
                    displayName: 'Brute Force Test',
                    acceptTerms: true,
                });

            // Attempt multiple failed logins
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .post('/api/v1/auth/login')
                    .send({
                        email: targetEmail,
                        password: wrongPassword,
                    });

                if (i < 4) {
                    expect(response.status).toBe(401);
                } else {
                    expect(response.status).toBe(423); // Account locked
                }
            }
        });

        it('should enforce rate limiting across endpoints', async () => {
            const testEmail = `rate.limit.${Date.now()}@example.com`;

            // Test registration rate limiting
            const registrationRequests = Array(6).fill(null).map((_, i) =>
                request(app)
                    .post('/api/v1/auth/register')
                    .send({
                        email: `rate${i}.${testEmail}`,
                        password: 'Test123!@#',
                        displayName: `Rate Test ${i}`,
                        acceptTerms: true,
                    })
            );

            // First 5 should succeed
            for (let i = 0; i < 5; i++) {
                const response = await registrationRequests[i];
                expect([201, 409]).toContain(response.status); // 201 for success, 409 for duplicate
            }

            // 6th should be rate limited
            const rateLimitedResponse = await registrationRequests[5];
            expect(rateLimitedResponse.status).toBe(429);
        });

        it('should validate token integrity', async () => {
            const malformedTokens = [
                'invalid-token-format',
                'Bearer malformed',
                'Bearer ',
                '',
                'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload',
            ];

            for (const token of malformedTokens) {
                const response = await request(app)
                    .get('/api/v1/auth/me')
                    .set('Authorization', token)
                    .expect(401);

                expect(response.body.error.code).toBe('UNAUTHORIZED');
            }
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should handle concurrent login requests', async () => {
            const concurrentEmail = `concurrent.${Date.now()}@example.com`;
            const password = 'Concurrent123!@#';

            // Create user
            await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: concurrentEmail,
                    password,
                    displayName: 'Concurrent Test',
                    acceptTerms: true,
                });

            // Send concurrent login requests
            const loginPromises = Array(10).fill(null).map(() =>
                request(app)
                    .post('/api/v1/auth/login')
                    .send({
                        email: concurrentEmail,
                        password,
                    })
            );

            const responses = await Promise.all(loginPromises);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.tokens).toBeDefined();
            });
        });

        it('should handle concurrent profile updates', async () => {
            const updateEmail = `update.concurrent.${Date.now()}@example.com`;
            const password = 'UpdateConcurrent123!@#';

            // Create and login user
            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: updateEmail,
                    password,
                    displayName: 'Update Concurrent Test',
                    acceptTerms: true,
                });

            const accessToken = registerResponse.body.data.tokens.accessToken;

            // Send concurrent update requests
            const updatePromises = Array(5).fill(null).map((_, i) =>
                request(app)
                    .patch('/api/v1/auth/update-profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        displayName: `Updated Name ${i}`,
                        preferences: {
                            theme: i % 2 === 0 ? 'light' : 'dark',
                        },
                    })
            );

            const responses = await Promise.all(updatePromises);

            // All should succeed (last write wins)
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });
        });
    });
});