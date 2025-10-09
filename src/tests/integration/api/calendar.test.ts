import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabases, cleanupTestDatabases, clearTestData, createTestUser, deleteTestUser } from '../../../utils/test-database';
import { createApp } from '../../../../src/app';

describe('Calendar API Integration Tests', () => {
    let app: Express;
    let server: any;
    let authToken: string;
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
            uid: 'test-calendar-user',
            email: 'calendar@example.com',
            password: 'TestPass123!',
            displayName: 'Calendar Test User',
            emailVerified: true
        });

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'calendar@example.com',
                password: 'TestPass123!'
            });

        authToken = loginResponse.body.data.tokens.accessToken;
    });

    afterEach(async () => {
        if (testUserUid) {
            await deleteTestUser(testUserUid);
            testUserUid = '';
        }
    });

    describe('POST /api/v1/calendar/connect', () => {
        it('should successfully connect calendar service', async () => {
            const connectionData = {
                provider: 'google',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token',
                email: 'user@gmail.com'
            };

            const response = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send(connectionData)
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: expect.any(String),
                    provider: 'google',
                    email: connectionData.email,
                    isActive: true,
                    syncEnabled: true
                })
            });
        });

        it('should fail without authentication', async () => {
            const connectionData = {
                provider: 'google',
                accessToken: 'test-token',
                email: 'user@gmail.com'
            };

            const response = await request(app)
                .post('/api/v1/calendar/connect')
                .send(connectionData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should validate provider type', async () => {
            const invalidData = {
                provider: 'invalid-provider',
                accessToken: 'test-token',
                email: 'user@example.com'
            };

            const response = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });

        it('should validate email format', async () => {
            const invalidData = {
                provider: 'google',
                accessToken: 'test-token',
                email: 'invalid-email'
            };

            const response = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });

        it('should prevent duplicate connections', async () => {
            const connectionData = {
                provider: 'google',
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token',
                email: 'duplicate@gmail.com'
            };

            // First connection
            await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send(connectionData)
                .expect(201);

            // Second connection should fail
            const response = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send(connectionData)
                .expect(409);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Calendar already connected')
            });
        });
    });

    describe('POST /api/v1/calendar/sync', () => {
        let calendarId: string;

        beforeEach(async () => {
            // Connect calendar first
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'sync@gmail.com'
                });

            calendarId = connectResponse.body.data.id;
        });

        it('should successfully sync calendar', async () => {
            const response = await request(app)
                .post('/api/v1/calendar/sync')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    syncDirection: 'bidirectional'
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    synced: expect.any(Number),
                    conflicts: expect.any(Number),
                    errors: expect.any(Number)
                })
            });
        });

        it('should fail for non-existent calendar', async () => {
            const response = await request(app)
                .post('/api/v1/calendar/sync')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: 'non-existent-calendar',
                    syncDirection: 'bidirectional'
                })
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Calendar not found')
            });
        });

        it('should check calendar ownership', async () => {
            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-calendar-user',
                email: 'othercalendar@example.com',
                password: 'TestPass123!',
                displayName: 'Other Calendar User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'othercalendar@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .post('/api/v1/calendar/sync')
                .set('Authorization', `Bearer ${otherToken}`)
                .send({
                    calendarId: calendarId,
                    syncDirection: 'bidirectional'
                })
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });

        it('should handle inactive calendar connections', async () => {
            // Update calendar to inactive
            await request(app)
                .patch(`/api/v1/calendar/${calendarId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    isActive: false
                });

            const response = await request(app)
                .post('/api/v1/calendar/sync')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    syncDirection: 'bidirectional'
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Calendar connection is inactive')
            });
        });

        it('should support different sync directions', async () => {
            const syncDirections = ['to_calendar', 'from_calendar', 'bidirectional'];

            for (const direction of syncDirections) {
                const response = await request(app)
                    .post('/api/v1/calendar/sync')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        calendarId: calendarId,
                        syncDirection: direction
                    });

                expect(response.status).toBe(200);
                expect(response.body.data).toHaveProperty('synced');
            }
        });
    });

    describe('POST /api/v1/calendar/events', () => {
        let calendarId: string;

        beforeEach(async () => {
            // Connect calendar first
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'events@gmail.com'
                });

            calendarId = connectResponse.body.data.id;
        });

        it('should successfully create calendar event', async () => {
            const eventData = {
                title: 'Team Meeting',
                description: 'Weekly team sync meeting',
                startTime: new Date(Date.now() + 60 * 60 * 1000),
                endTime: new Date(Date.now() + 90 * 60 * 1000),
                location: 'Conference Room A',
                attendees: ['user1@example.com', 'user2@example.com'],
                recurrence: 'weekly'
            };

            const response = await request(app)
                .post('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    ...eventData
                })
                .expect(201);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: expect.any(String),
                    title: eventData.title,
                    description: eventData.description,
                    startTime: expect.any(String),
                    endTime: expect.any(String),
                    isRecurring: true
                })
            });
        });

        it('should validate event times', async () => {
            const invalidEventData = {
                title: 'Invalid Event',
                description: 'Event with invalid times',
                startTime: new Date(Date.now() + 60 * 60 * 1000),
                endTime: new Date(Date.now() + 30 * 60 * 1000) // End before start
            };

            const response = await request(app)
                .post('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    ...invalidEventData
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('End time must be after start time')
            });
        });

        it('should validate attendee emails', async () => {
            const invalidAttendeesData = {
                title: 'Meeting with Invalid Attendees',
                startTime: new Date(Date.now() + 60 * 60 * 1000),
                endTime: new Date(Date.now() + 90 * 60 * 1000),
                attendees: ['invalid-email', 'valid@example.com']
            };

            const response = await request(app)
                .post('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    ...invalidAttendeesData
                })
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid attendee email format')
            });
        });

        it('should handle conflicting events', async () => {
            // Create first event
            const firstEvent = {
                title: 'First Meeting',
                startTime: new Date(Date.now() + 60 * 60 * 1000),
                endTime: new Date(Date.now() + 90 * 60 * 1000)
            };

            await request(app)
                .post('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    ...firstEvent
                });

            // Create conflicting event
            const conflictingEvent = {
                title: 'Conflicting Meeting',
                startTime: new Date(Date.now() + 60 * 60 * 1000), // Same start time
                endTime: new Date(Date.now() + 75 * 60 * 1000)
            };

            const response = await request(app)
                .post('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    ...conflictingEvent
                })
                .expect(200);

            expect(response.body.data).toHaveProperty('conflicts');
            expect(response.body.data.conflicts).toHaveLength(1);
        });
    });

    describe('GET /api/v1/calendar/events', () => {
        let calendarId: string;

        beforeEach(async () => {
            // Connect calendar and create events
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'getevents@gmail.com'
                });

            calendarId = connectResponse.body.data.id;

            // Create multiple events
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .post('/api/v1/calendar/events')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        calendarId: calendarId,
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + (i + 1) * 90 * 60 * 1000)
                    });
            }
        });

        it('should successfully retrieve calendar events', async () => {
            const dateRange = {
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const response = await request(app)
                .get('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    calendarId: calendarId,
                    startDate: dateRange.startDate.toISOString(),
                    endDate: dateRange.endDate.toISOString()
                })
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        title: expect.stringMatching(/Event \d/),
                        calendarId: calendarId
                    })
                ])
            });
            expect(response.body.data).toHaveLength(3);
        });

        it('should filter events by date range', async () => {
            const limitedRange = {
                startDate: new Date(),
                endDate: new Date(Date.now() + 2 * 60 * 60 * 1000) // Only 2 hours
            };

            const response = await request(app)
                .get('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    calendarId: calendarId,
                    startDate: limitedRange.startDate.toISOString(),
                    endDate: limitedRange.endDate.toISOString()
                })
                .expect(200);

            expect(response.body.data.length).toBeLessThanOrEqual(2);
        });

        it('should filter events by type', async () => {
            const response = await request(app)
                .get('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    calendarId: calendarId,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    type: 'meeting'
                })
                .expect(200);

            // All events should be of type 'meeting'
            expect(response.body.data.every((event: any) => event.type === 'meeting')).toBe(true);
        });

        it('should return cached events if available', async () => {
            const dateRange = {
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            // First request
            const response1 = await request(app)
                .get('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    calendarId: calendarId,
                    startDate: dateRange.startDate.toISOString(),
                    endDate: dateRange.endDate.toISOString()
                });

            // Second request should be cached
            const startTime = Date.now();
            const response2 = await request(app)
                .get('/api/v1/calendar/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    calendarId: calendarId,
                    startDate: dateRange.startDate.toISOString(),
                    endDate: dateRange.endDate.toISOString()
                });
            const endTime = Date.now();

            expect(response2.body.data).toEqual(response1.body.data);
            expect(endTime - startTime).toBeLessThan(50); // Should be very fast due to caching
        });
    });

    describe('POST /api/v1/calendar/sync-planner', () => {
        let calendarId: string;
        let plannerId: string;

        beforeEach(async () => {
            // Connect calendar
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'syncplanner@gmail.com'
                });

            calendarId = connectResponse.body.data.id;

            // Create planner
            const plannerResponse = await request(app)
                .post('/api/v1/planners')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Calendar Sync Planner',
                    description: 'Planner for calendar sync test',
                    color: '#34A853',
                    icon: '📅'
                });

            plannerId = plannerResponse.body.data.id;

            // Add some activities
            const sectionResponse = await request(app)
                .post(`/api/v1/planners/${plannerId}/sections`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Tasks Section',
                    type: 'tasks'
                });

            const sectionId = sectionResponse.body.data.id;

            await request(app)
                .post(`/api/v1/sections/${sectionId}/activities`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Meeting with Client',
                    type: 'event',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                });
        });

        it('should successfully sync planner with calendar', async () => {
            const syncConfig = {
                calendarId: calendarId,
                plannerId: plannerId,
                syncDirection: 'bidirectional',
                conflictResolution: 'planner_wins',
                fieldMapping: {
                    eventTitle: 'activityTitle',
                    eventDescription: 'activityDescription',
                    eventTime: 'activityDueDate'
                }
            };

            const response = await request(app)
                .post('/api/v1/calendar/sync-planner')
                .set('Authorization', `Bearer ${authToken}`)
                .send(syncConfig)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    syncedActivities: expect.any(Number),
                    syncedEvents: expect.any(Number),
                    conflicts: expect.any(Number),
                    resolved: expect.any(Number)
                })
            });
        });

        it('should handle sync conflicts', async () => {
            const syncConfig = {
                calendarId: calendarId,
                plannerId: plannerId,
                syncDirection: 'bidirectional',
                conflictResolution: 'manual_review'
            };

            const response = await request(app)
                .post('/api/v1/calendar/sync-planner')
                .set('Authorization', `Bearer ${authToken}`)
                .send(syncConfig)
                .expect(200);

            // There might be conflicts that need manual review
            if (response.body.data.conflicts > 0) {
                expect(response.body.data).toHaveProperty('conflictsNeedReview');
            }
        });

        it('should validate sync configuration', async () => {
            const invalidConfig = {
                calendarId: '', // Invalid calendar ID
                plannerId: plannerId,
                syncDirection: 'invalid_direction'
            };

            const response = await request(app)
                .post('/api/v1/calendar/sync-planner')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidConfig)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid sync configuration')
            });
        });
    });

    describe('DELETE /api/v1/calendar/:id', () => {
        it('should successfully disconnect calendar', async () => {
            // Connect calendar first
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'disconnect@gmail.com'
                });

            const calendarId = connectResponse.body.data.id;

            const response = await request(app)
                .delete(`/api/v1/calendar/${calendarId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('Calendar disconnected successfully')
            });
        });

        it('should fail for non-existent calendar', async () => {
            const response = await request(app)
                .delete('/api/v1/calendar/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Calendar connection not found')
            });
        });

        it('should only allow owner to disconnect calendar', async () => {
            // Create calendar with first user
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'otherdisconnect@gmail.com'
                });

            const calendarId = connectResponse.body.data.id;

            // Create another user
            const otherUserUid = await createTestUser({
                uid: 'other-disconnect-user',
                email: 'otherdisconnect@example.com',
                password: 'TestPass123!',
                displayName: 'Other Disconnect User',
                emailVerified: true
            });

            const otherLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'otherdisconnect@example.com',
                    password: 'TestPass123!'
                });

            const otherToken = otherLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .delete(`/api/v1/calendar/${calendarId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Access denied')
            });

            await deleteTestUser(otherUserUid);
        });

        it('should prevent disconnecting active calendar with active sync', async () => {
            // Connect calendar
            const connectResponse = await request(app)
                .post('/api/v1/calendar/connect')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'google',
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    email: 'activesync@gmail.com'
                });

            const calendarId = connectResponse.body.data.id;

            // Start sync
            await request(app)
                .post('/api/v1/calendar/sync')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    calendarId: calendarId,
                    syncDirection: 'bidirectional'
                });

            // Try to disconnect
            const response = await request(app)
                .delete(`/api/v1/calendar/${calendarId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Cannot delete active integration')
            });
        });
    });
});