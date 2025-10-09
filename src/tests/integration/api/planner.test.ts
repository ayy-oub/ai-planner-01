import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabases, cleanupTestDatabases, clearTestData, createTestUser, deleteTestUser } from '../../../utils/test-database';
import { createApp } from '../../../../src/app';

describe('Planner API Integration Tests', () => {
    let app: Express;
    let server: any;
    let authToken: string;
    let refreshToken: string;
    let testUserUid: string;

    beforeAll(async () => {
        await initializeTestDatabases();
        app = createApp();
        server = app.listen(0);
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
        await cleanupTestDatabases();
    });

    beforeEach(async () => {
        await clearTestData();

        // Create test user and login
        testUserUid = await createTestUser({
            uid: 'test-planner-user',
            email: 'planner@example.com',
            password: 'TestPass123!',
            displayName: 'Planner Test User',
            emailVerified: true
        });

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'planner@example.com',
                password: 'TestPass123!'
            });

        authToken = loginResponse.body.data.tokens.accessToken;
        refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    afterEach(async () => {
        if (testUserUid) {
            await deleteTestUser(testUserUid);
            testUserUid = '';
        }
    });

    describe('POST /api/v1/planners', () => {
        it('should successfully create a new planner', async () => {
            const plannerData = {
                title: 'My Test Planner',
                description: 'A test planner for integration testing',
                color: '#FF5733',
                icon: '📝'
            };

            const response = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send(plannerData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: {
                    id: expect.any(String),
                    title: plannerData.title,
                    description: plannerData.description,
                    color: plannerData.color,
                    icon: plannerData.icon,
                    userId: testUserUid,
                    sections: [],
                    collaborators: [],
                    tags: [],
                    settings: expect.objectContaining({
                        isPublic: 'private',
                        allowCollaboration: false,
                        autoArchive: false,
                        reminderEnabled: true
                    }),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String)
                }
            });
        });

        it('should fail without authentication', async () => {
            const plannerData = {
                title: 'Test Planner',
                description: 'Test description',
                color: '#FF5733',
                icon: '📝'
            };

            const response = await request(app)
                .post('/api/v1/planners')
                .send(plannerData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should validate required fields', async () => {
            const invalidData = {
                description: 'Missing title'
            };

            const response = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'title',
                        message: expect.stringContaining('required')
                    })
                ])
            });
        });

        it('should enforce plan limits for free users', async () => {
            // Create multiple planners to reach free limit
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .post('/api/v1/planners')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `Planner ${i}`,
                        description: `Test planner ${i}`,
                        color: '#FF5733',
                        icon: '📝'
                    });
            }

            // 4th planner should fail
            const response = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Limit Exceeded Planner',
                    description: 'This should fail',
                    color: '#FF5733',
                    icon: '📝'
                })
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('plan limit reached')
            });
        });

        it('should handle invalid color format', async () => {
            const plannerData = {
                title: 'Test Planner',
                description: 'Test description',
                color: 'invalid-color',
                icon: '📝'
            };

            const response = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send(plannerData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'color',
                        message: expect.stringContaining('valid hex color')
                    })
                ])
            });
        });
    });

    describe('GET /api/v1/planners', () => {
        beforeEach(async () => {
            // Create multiple planners for testing
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/v1/planners')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `Test Planner ${i}`,
                        description: `Description ${i}`,
                        color: '#FF5733',
                        icon: '📝'
                    });
            }
        });

        it('should successfully retrieve user planners', async () => {
            const response = await request(app)
                .get('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        title: expect.stringMatching(/Test Planner \d/),
                        userId: testUserUid
                    })
                ]),
                pagination: expect.objectContaining({
                    total: 5,
                    page: 1,
                    limit: 10,
                    totalPages: 1
                })
            });
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/v1/planners?page=1&limit=2')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data).toHaveLength(2);
            expect(response.body.pagination).toMatchObject({
                total: 5,
                page: 1,
                limit: 2,
                totalPages: 3,
                hasNext: true,
                hasPrev: false
            });
        });

        it('should support sorting', async () => {
            const response = await request(app)
                .get('/api/v1/planners?sortBy=title&sortOrder=asc')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const titles = response.body.data.map((p: any) => p.title);
            expect(titles).toEqual([
                'Test Planner 0',
                'Test Planner 1',
                'Test Planner 2',
                'Test Planner 3',
                'Test Planner 4'
            ]);
        });

        it('should filter by search query', async () => {
            const response = await request(app)
                .get('/api/v1/planners?search=Planner 2')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].title).toBe('Test Planner 2');
        });

        it('should filter by tags', async () => {
            // Add tags to some planners
            const plannersResponse = await request(app)
                .get('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`);

            const plannerId = plannersResponse.body.data[0].id;

            await request(app)
                .patch(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    tags: ['important', 'work']
                });

            const response = await request(app)
                .get('/api/v1/planners?tags=important')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0].tags).toContain('important');
        });

        it('should handle invalid pagination parameters', async () => {
            const response = await request(app)
                .get('/api/v1/planners?page=invalid&limit=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });
    });

    describe('GET /api/v1/planners/:id', () => {
        let plannerId: string;

        beforeEach(async () => {
            // Create a planner
            const createResponse = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Specific Planner',
                    description: 'Planner for get by id test',
                    color: '#FF5733',
                    icon: '📝'
                });

            plannerId = createResponse.body.data.id;
        });

        it('should successfully retrieve planner by id', async () => {
            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: plannerId,
                    title: 'Specific Planner',
                    description: 'Planner for get by id test'
                })
            });
        });

        it('should fail for non-existent planner', async () => {
            const response = await request(app)
                .get('/api/v1/planners/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Planner not found')
            });
        });

        it('should check access permissions', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-planner-user',
                email: 'other@example.com',
                password: 'TestPass123!',
                displayName: 'Other User',
                emailVerified: true
            });

            const otherUserLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'other@example.com',
                    password: 'TestPass123!'
                });

            const otherUserToken = otherUserLogin.body.data.tokens.accessToken;

            // Try to access planner owned by first user
            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });

        it('should allow access to shared planners', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'shared-planner-user',
                email: 'shared@example.com',
                password: 'TestPass123!',
                displayName: 'Shared User',
                emailVerified: true
            });

            const otherUserLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'shared@example.com',
                    password: 'TestPass123!'
                });

            const otherUserToken = otherUserLogin.body.data.tokens.accessToken;

            // Share the planner
            await request(app)
                .post(`/api/v1/planners/${plannerId}/share`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: 'shared@example.com',
                    role: 'viewer'
                });

            // Try to access shared planner
            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(plannerId);

            await deleteTestUser(otherUserUid);
        });

        it('should include sections and activities when requested', async () => {
            // Add a section
            const sectionResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Section',
                    description: 'Test section',
                    type: 'tasks'
                });

            const sectionId = sectionResponse.body.data.id;

            // Add an activity
            await request(app)
                .post(`/api/v1/sections/${sectionId}/activities`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Activity',
                    description: 'Test activity',
                    type: 'task'
                });

            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}?includeSections=true&includeActivities=true`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.sections).toHaveLength(1);
            expect(response.body.data.sections[0].activities).toHaveLength(1);
        });
    });

    describe('PATCH /api/v1/planners/:id', () => {
        let plannerId: string;

        beforeEach(async () => {
            // Create a planner
            const createResponse = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Original Planner',
                    description: 'Original description',
                    color: '#FF5733',
                    icon: '📝'
                });

            plannerId = createResponse.body.data.id;
        });

        it('should successfully update planner', async () => {
            const updateData = {
                title: 'Updated Planner',
                description: 'Updated description',
                color: '#4285F4',
                icon: '📋'
            };

            const response = await request(app)
                .patch(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: plannerId,
                    title: updateData.title,
                    description: updateData.description,
                    color: updateData.color,
                    icon: updateData.icon
                })
            });
        });

        it('should update only provided fields', async () => {
            const updateData = {
                title: 'Only Title Updated'
            };

            const response = await request(app)
                .patch(`/api/v1/planners/${plannerId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.data.title).toBe(updateData.title);
            expect(response.body.data.description).toBe('Original description');
            expect(response.body.data.color).toBe('#FF5733');
        });

        it('should fail for non