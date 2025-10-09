import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabases, cleanupTestDatabases, clearTestData, createTestUser, deleteTestUser } from '../../../utils/test-database';
import { createApp } from '../../../../src/app';

describe('Section API Integration Tests', () => {
    let app: Express;
    let server: any;
    let authToken: string;
    let testUserUid: string;
    let plannerId: string;

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
            uid: 'test-section-user',
            email: 'section@example.com',
            password: 'TestPass123!',
            displayName: 'Section Test User',
            emailVerified: true
        });

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'section@example.com',
                password: 'TestPass123!'
            });

        authToken = loginResponse.body.data.tokens.accessToken;

        // Create a planner for section tests
        const plannerResponse = await request(app)
            .post('/api/v1/planners')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Test Planner for Sections',
                description: 'Planner for section integration tests',
                color: '#FF5733',
                icon: '📝'
            });

        plannerId = plannerResponse.body.data.id;
    });

    afterEach(async () => {
        if (testUserUid) {
            await deleteTestUser(testUserUid);
            testUserUid = '';
        }
    });

    describe('POST /api/v1/planners/:plannerId/sections', () => {
        it('should successfully create a new section', async () => {
            const sectionData = {
                title: 'Monday Tasks',
                description: 'Tasks for Monday',
                type: 'tasks',
                order: 1
            };

            const response = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(sectionData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: expect.any(String),
                    title: sectionData.title,
                    description: sectionData.description,
                    type: sectionData.type,
                    order: sectionData.order,
                    plannerId: plannerId,
                    activities: [],
                    settings: expect.objectContaining({
                        collapsed: false,
                        color: expect.any(String),
                        icon: expect.any(String)
                    })
                })
            });
        });

        it('should fail without authentication', async () => {
            const sectionData = {
                title: 'Test Section',
                type: 'tasks'
            };

            const response = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .send(sectionData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should validate required fields', async () => {
            const invalidData = {
                description: 'Missing title and type'
            };

            const response = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed'),
                errors: expect.arrayContaining([
                    expect.objectContaining({ field: 'title' }),
                    expect.objectContaining({ field: 'type' })
                ])
            });
        });

        it('should check planner ownership', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-section-user',
                email: 'othersection@example.com',
                password: 'TestPass123!',
                displayName: 'Other User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'othersection@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const sectionData = {
                title: 'Unauthorized Section',
                type: 'tasks'
            };

            const response = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send(sectionData)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });

        it('should enforce section limits for free users', async () => {
            // Create multiple sections to reach limit
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .post(`/api/v1/planners/${plannerId}/sections`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `Section ${i}`,
                        type: 'tasks'
                    });
            }

            // 11th section should fail
            const response = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Limit Exceeded Section',
                    type: 'tasks'
                })
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Section limit reached')
            });
        });

        it('should handle different section types', async () => {
            const sectionTypes = ['tasks', 'notes', 'goals'];

            for (const type of sectionTypes) {
                const response = await request(app)
                    .post(`/api/v1/planners/${plannerId}/sections`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `${type} Section`,
                        type: type
                    });

                expect(response.body.data.type).toBe(type);
            }
        });
    });

    describe('GET /api/v1/planners/:plannerId/sections', () => {
        beforeEach(async () => {
            // Create multiple sections
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .post(`/api/v1/planners/${plannerId}/sections`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `Section ${i}`,
                        type: 'tasks',
                        order: i
                    });
            }
        });

        it('should successfully retrieve all sections for a planner', async () => {
            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        title: expect.stringMatching(/Section \d/),
                        plannerId: plannerId
                    })
                ])
            });
            expect(response.body.data).toHaveLength(3);
        });

        it('should return sections in correct order', async () => {
            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const sections = response.body.data;
            expect(sections[0].order).toBe(0);
            expect(sections[1].order).toBe(1);
            expect(sections[2].order).toBe(2);
        });

        it('should check planner access permissions', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-get-sections-user',
                email: 'otherget@example.com',
                password: 'TestPass123!',
                displayName: 'Other Get User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'otherget@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });

        it('should include activities when requested', async () => {
            // Add activities to first section
            const sectionsResponse = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`);

            const sectionId = sectionsResponse.body.data[0].id;

            await request(app)
                .post(`/api/v1/sections/${sectionId}/activities`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Activity',
                    type: 'task'
                });

            const response = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections?includeActivities=true`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data[0].activities).toHaveLength(1);
            expect(response.body.data[0].activities[0].title).toBe('Test Activity');
        });
    });

    describe('GET /api/v1/sections/:id', () => {
        let sectionId: string;

        beforeEach(async () => {
            // Create a section
            const createResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Specific Section',
                    type: 'tasks'
                });

            sectionId = createResponse.body.data.id;
        });

        it('should successfully retrieve section by id', async () => {
            const response = await request(app)
                .get(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: sectionId,
                    title: 'Specific Section',
                    type: 'tasks'
                })
            });
        });

        it('should fail for non-existent section', async () => {
            const response = await request(app)
                .get('/api/v1/sections/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Section not found')
            });
        });

        it('should check section access permissions', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-single-section-user',
                email: 'othersingle@example.com',
                password: 'TestPass123!',
                displayName: 'Other Single User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'othersingle@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .get(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });
    });

    describe('PATCH /api/v1/sections/:id', () => {
        let sectionId: string;

        beforeEach(async () => {
            // Create a section
            const createResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Original Section',
                    description: 'Original description',
                    type: 'tasks'
                });

            sectionId = createResponse.body.data.id;
        });

        it('should successfully update section', async () => {
            const updateData = {
                title: 'Updated Section',
                description: 'Updated description',
                settings: {
                    collapsed: true,
                    color: '#4285F4'
                }
            };

            const response = await request(app)
                .patch(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: sectionId,
                    title: updateData.title,
                    description: updateData.description,
                    settings: expect.objectContaining({
                        collapsed: true,
                        color: '#4285F4'
                    })
                })
            });
        });

        it('should update only provided fields', async () => {
            const updateData = {
                title: 'Only Title Updated'
            };

            const response = await request(app)
                .patch(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.data.title).toBe(updateData.title);
            expect(response.body.data.description).toBe('Original description');
        });

        it('should prevent changing section type with activities', async () => {
            // Add an activity to the section
            await request(app)
                .post(`/api/v1/sections/${sectionId}/activities`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Activity',
                    type: 'task'
                });

            const response = await request(app)
                .patch(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'notes'
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Cannot change section type when activities exist')
            });
        });

        it('should check update permissions', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-update-section-user',
                email: 'otherupdate@example.com',
                password: 'TestPass123!',
                displayName: 'Other Update User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'otherupdate@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const updateData = {
                title: 'Unauthorized Update'
            };

            const response = await request(app)
                .patch(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send(updateData)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });
    });

    describe('DELETE /api/v1/sections/:id', () => {
        let sectionId: string;

        beforeEach(async () => {
            // Create a section
            const createResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Section to Delete',
                    type: 'tasks'
                });

            sectionId = createResponse.body.data.id;
        });

        it('should successfully delete section', async () => {
            const response = await request(app)
                .delete(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Section deleted successfully')
            });

            // Verify section is deleted
            const getResponse = await request(app)
                .get(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('should prevent deleting section with activities', async () => {
            // Add an activity to the section
            await request(app)
                .post(`/api/v1/sections/${sectionId}/activities`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Activity',
                    type: 'task'
                });

            const response = await request(app)
                .delete(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Cannot delete section with activities')
            });
        });

        it('should only allow owner to delete section', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-delete-section-user',
                email: 'otherdelete@example.com',
                password: 'TestPass123!',
                displayName: 'Other Delete User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'otherdelete@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .delete(`/api/v1/sections/${sectionId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });
    });

    describe('POST /api/v1/sections/:id/reorder', () => {
        let sectionIds: string[] = [];

        beforeEach(async () => {
            // Create multiple sections
            for (let i = 0; i < 3; i++) {
                const createResponse = await request(app)
                    .post(`/api/v1/planners/${plannerId}/sections`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: `Reorder Section ${i}`,
                        type: 'tasks',
                        order: i
                    });

                sectionIds.push(createResponse.body.data.id);
            }
        });

        it('should successfully reorder sections', async () => {
            const newOrder = [sectionIds[2], sectionIds[0], sectionIds[1]];

            const response = await request(app)
                .post(`/api/v1/sections/${sectionIds[0]}/reorder`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    sectionIds: newOrder
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Sections reordered successfully')
            });

            // Verify new order
            const getResponse = await request(app)
                .get(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.body.data[0].id).toBe(newOrder[0]);
            expect(getResponse.body.data[1].id).toBe(newOrder[1]);
            expect(getResponse.body.data[2].id).toBe(newOrder[2]);
        });

        it('should validate all sections belong to same planner', async () => {
            // Create section in different planner
            const otherPlannerResponse = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Other Planner',
                    description: 'Other planner for reorder test',
                    color: '#4285F4',
                    icon: '📋'
                });

            const otherPlannerId = otherPlannerResponse.body.data.id;

            const otherSectionResponse = await request(app)
                .post(`/api/v1/planners/${otherPlannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Other Section',
                    type: 'tasks'
                });

            const otherSectionId = otherSectionResponse.body.data.id;

            const response = await request(app)
                .post(`/api/v1/sections/${sectionIds[0]}/reorder`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    sectionIds: [sectionIds[0], otherSectionId, sectionIds[1]]
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('All sections must belong to the same planner')
            });
        });
    });

    describe('POST /api/v1/sections/:id/toggle-collapse', () => {
        let sectionId: string;

        beforeEach(async () => {
            // Create a section
            const createResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Collapsible Section',
                    type: 'tasks'
                });

            sectionId = createResponse.body.data.id;
        });

        it('should successfully toggle section collapse state', async () => {
            // First toggle - should collapse
            const collapseResponse = await request(app)
                .post(`/api/v1/sections/${sectionId}/toggle-collapse`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(collapseResponse.body.data.settings.collapsed).toBe(true);

            // Second toggle - should expand
            const expandResponse = await request(app)
                .post(`/api/v1/sections/${sectionId}/toggle-collapse`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(expandResponse.body.data.settings.collapsed).toBe(false);
        });

        it('should fail for non-existent section', async () => {
            const response = await request(app)
                .post('/api/v1/sections/non-existent-id/toggle-collapse')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Section not found')
            });
        });
    });
});