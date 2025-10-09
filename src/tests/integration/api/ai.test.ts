import request from 'supertest';
import { Express } from 'express';
import { initializeTestDatabases, cleanupTestDatabases, clearTestData, createTestUser, deleteTestUser } from '../../../utils/test-database';
import { createApp } from '../../../../src/app';

describe('AI API Integration Tests', () => {
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
            uid: 'test-ai-user',
            email: 'ai@example.com',
            password: 'TestPass123!',
            displayName: 'AI Test User',
            emailVerified: true
        });

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'ai@example.com',
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

    describe('POST /api/v1/ai/suggest-tasks', () => {
        it('should successfully generate task suggestions', async () => {
            const suggestionData = {
                currentTasks: ['Complete project documentation', 'Review code'],
                goals: ['Improve productivity', 'Learn new skills'],
                preferences: {
                    workHours: 8,
                    difficulty: 'medium'
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/suggest-tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(suggestionData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        task: expect.any(String),
                        priority: expect.any(String),
                        estimatedDuration: expect.any(Number),
                        reasoning: expect.any(String)
                    })
                ])
            });
        });

        it('should fail without authentication', async () => {
            const suggestionData = {
                currentTasks: ['Task 1'],
                goals: ['Goal 1']
            };

            const response = await request(app)
                .post('/api/v1/ai/suggest-tasks')
                .send(suggestionData)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('No token provided')
            });
        });

        it('should validate input data', async () => {
            const invalidData = {
                currentTasks: 'not-an-array',
                goals: ['valid goal']
            };

            const response = await request(app)
                .post('/api/v1/ai/suggest-tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Validation failed')
            });
        });

        it('should handle empty context gracefully', async () => {
            const emptyContext = {
                currentTasks: [],
                goals: [],
                preferences: {}
            };

            const response = await request(app)
                .post('/api/v1/ai/suggest-tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(emptyContext)
                .expect(200);

            expect(response.body.data).toEqual([]);
        });

        it('should implement rate limiting', async () => {
            const suggestionData = {
                currentTasks: ['Task 1'],
                goals: ['Goal 1']
            };

            // Make multiple requests quickly
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .post('/api/v1/ai/suggest-tasks')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(suggestionData);
            }

            // Next request should be rate limited
            const response = await request(app)
                .post('/api/v1/ai/suggest-tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(suggestionData)
                .expect(429);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Too many AI requests')
            });
        });
    });

    describe('POST /api/v1/ai/optimize-schedule', () => {
        it('should successfully optimize schedule', async () => {
            const scheduleData = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'High Priority Task',
                        estimatedDuration: 60,
                        priority: 'high',
                        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    },
                    {
                        id: 'activity-2',
                        title: 'Medium Priority Task',
                        estimatedDuration: 30,
                        priority: 'medium',
                        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
                    }
                ],
                constraints: {
                    workHours: {
                        start: '09:00',
                        end: '17:00'
                    },
                    breaks: ['12:00', '13:00']
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/optimize-schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send(scheduleData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    activities: expect.arrayContaining([
                        expect.objectContaining({
                            id: expect.any(String),
                            scheduledStart: expect.any(String),
                            scheduledEnd: expect.any(String)
                        })
                    ]),
                    metrics: expect.objectContaining({
                        totalTime: expect.any(Number),
                        efficiency: expect.any(Number),
                        conflicts: expect.any(Number)
                    })
                })
            });
        });

        it('should handle scheduling conflicts', async () => {
            const conflictingSchedule = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Task 1',
                        estimatedDuration: 120,
                        priority: 'high',
                        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    },
                    {
                        id: 'activity-2',
                        title: 'Task 2',
                        estimatedDuration: 90,
                        priority: 'high',
                        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    }
                ],
                constraints: {
                    workHours: {
                        start: '09:00',
                        end: '10:00' // Only 1 hour available
                    }
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/optimize-schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send(conflictingSchedule)
                .expect(200);

            expect(response.body.data.metrics.conflicts).toBeGreaterThan(0);
        });

        it('should validate time constraints', async () => {
            const invalidConstraints = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Task 1',
                        estimatedDuration: 60,
                        priority: 'high'
                    }
                ],
                constraints: {
                    workHours: {
                        start: '17:00',
                        end: '09:00' // End before start
                    }
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/optimize-schedule')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidConstraints)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid time constraints')
            });
        });
    });

    describe('POST /api/v1/ai/analyze-productivity', () => {
        it('should successfully analyze productivity', async () => {
            const analysisData = {
                timeRange: {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: new Date()
                },
                metrics: ['completionRate', 'timeManagement', 'taskDistribution']
            };

            const response = await request(app)
                .post('/api/v1/ai/analyze-productivity')
                .set('Authorization', `Bearer ${authToken}`)
                .send(analysisData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    completionRate: expect.objectContaining({
                        overall: expect.any(Number),
                        byPriority: expect.any(Object)
                    }),
                    timeManagement: expect.any(Object),
                    taskDistribution: expect.any(Object),
                    insights: expect.any(Array)
                })
            });
        });

        it('should handle different time ranges', async () => {
            const timeRanges = [
                {
                    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    end: new Date()
                },
                {
                    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    end: new Date()
                }
            ];

            for (const timeRange of timeRanges) {
                const response = await request(app)
                    .post('/api/v1/ai/analyze-productivity')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        timeRange,
                        metrics: ['completionRate']
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            }
        });

        it('should validate time range', async () => {
            const invalidTimeRange = {
                timeRange: {
                    start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future start
                    end: new Date()
                },
                metrics: ['completionRate']
            };

            const response = await request(app)
                .post('/api/v1/ai/analyze-productivity')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidTimeRange)
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                message: expect.stringContaining('Invalid time range')
            });
        });

        it('should handle insufficient data gracefully', async () => {
            // Create new user with no activity history
            const newUserUid = await createTestUser({
                uid: 'new-ai-user',
                email: 'newai@example.com',
                password: 'TestPass123!',
                displayName: 'New AI User',
                emailVerified: true
            });

            const newLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'newai@example.com',
                    password: 'TestPass123!'
                });

            const newToken = newLogin.body.data.tokens.accessToken;

            const response = await request(app)
                .post('/api/v1/ai/analyze-productivity')
                .set('Authorization', `Bearer ${newToken}`)
                .send({
                    timeRange: {
                        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        end: new Date()
                    },
                    metrics: ['completionRate']
                })
                .expect(200);

            expect(response.body.data.completionRate.overall).toBe(0);
            expect(response.body.data.insights[0]).toContain('insufficient data');

            await deleteTestUser(newUserUid);
        });
    });

    describe('GET /api/v1/ai/insights', () => {
        it('should successfully retrieve AI insights', async () => {
            const response = await request(app)
                .get('/api/v1/ai/insights')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        type: expect.any(String),
                        title: expect.any(String),
                        description: expect.any(String),
                        confidence: expect.any(Number),
                        actionable: expect.any(Boolean)
                    })
                ])
            });
        });

        it('should filter insights by type', async () => {
            const types = ['productivity', 'task-management', 'time-optimization'];

            for (const type of types) {
                const response = await request(app)
                    .get(`/api/v1/ai/insights?type=${type}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.data.every((insight: any) => insight.type === type)).toBe(true);
            }
        });

        it('should limit number of insights', async () => {
            const response = await request(app)
                .get('/api/v1/ai/insights?limit=3')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.length).toBeLessThanOrEqual(3);
        });

        it('should cache insights response', async () => {
            // First request
            const response1 = await request(app)
                .get('/api/v1/ai/insights')
                .set('Authorization', `Bearer ${authToken}`);

            // Second request should be faster (cached)
            const startTime = Date.now();
            const response2 = await request(app)
                .get('/api/v1/ai/insights')
                .set('Authorization', `Bearer ${authToken}`);
            const endTime = Date.now();

            expect(response2.body.data).toEqual(response1.body.data);
            expect(endTime - startTime).toBeLessThan(100); // Should be very fast due to caching
        });
    });

    describe('POST /api/v1/ai/generate-reminders', () => {
        it('should successfully generate smart reminders', async () => {
            const reminderData = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Important Meeting',
                        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        priority: 'high',
                        reminderSettings: {
                            enabled: true,
                            advanceNotice: 30
                        }
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: {
                        start: '22:00',
                        end: '07:00'
                    }
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/generate-reminders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(reminderData)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        activityId: expect.any(String),
                        scheduledFor: expect.any(String),
                        message: expect.any(String),
                        priority: expect.any(String),
                        channel: expect.any(String)
                    })
                ])
            });
        });

        it('should respect quiet hours', async () => {
            const nightTimeData = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Night Task',
                        dueDate: new Date(Date.now() + 23 * 60 * 60 * 1000),
                        priority: 'medium',
                        reminderSettings: {
                            enabled: true,
                            advanceNotice: 60
                        }
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: {
                        start: '22:00',
                        end: '07:00'
                    }
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/generate-reminders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(nightTimeData)
                .expect(200);

            const scheduledHour = new Date(response.body.data[0].scheduledFor).getHours();
            expect(scheduledHour).toBeGreaterThanOrEqual(7);
        });

        it('should prioritize high-priority activities', async () => {
            const mixedPriorityData = {
                activities: [
                    {
                        id: 'low-priority',
                        title: 'Low Priority Task',
                        dueDate: new Date(Date.now() + 60 * 60 * 1000),
                        priority: 'low',
                        reminderSettings: { enabled: true, advanceNotice: 30 }
                    },
                    {
                        id: 'high-priority',
                        title: 'High Priority Task',
                        dueDate: new Date(Date.now() + 60 * 60 * 1000),
                        priority: 'high',
                        reminderSettings: { enabled: true, advanceNotice: 30 }
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: { start: '22:00', end: '07:00' }
                }
            };

            const response = await request(app)
                .post('/api/v1/ai/generate-reminders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mixedPriorityData)
                .expect(200);

            const reminders = response.body.data;
            const highPriorityReminder = reminders.find((r: any) => r.activityId === 'high-priority');
            const lowPriorityReminder = reminders.find((r: any) => r.activityId === 'low-priority');

            expect(highPriorityReminder.priority).toBe('high');
            expect(highPriorityReminder.channel).toBe('push');
            expect(lowPriorityReminder.priority).toBe('low');
        });
    });
});