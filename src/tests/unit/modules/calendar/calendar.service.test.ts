import { CalendarService } from '../../../../src/modules/calendar/calendar.service';
import { CalendarRepository } from '../../../../src/modules/calendar/calendar.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { CalendarProvider } from '../../../../src/shared/types/calendar.types';

jest.mock('../../../../src/modules/calendar/calendar.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('CalendarService', () => {
    let calendarService: CalendarService;
    let calendarRepository: jest.Mocked<CalendarRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const calendarId = 'test-calendar-id';

    beforeEach(() => {
        calendarRepository = new CalendarRepository() as jest.Mocked<CalendarRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        calendarService = new CalendarService(calendarRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('connectCalendar', () => {
        const connectionData = {
            provider: CalendarProvider.GOOGLE,
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            email: 'user@example.com'
        };

        it('should successfully connect calendar', async () => {
            const mockConnection = {
                id: 'connection-123',
                userId,
                provider: CalendarProvider.GOOGLE,
                email: connectionData.email,
                isActive: true,
                syncEnabled: true
            };

            calendarRepository.createConnection.mockResolvedValue(mockConnection);
            calendarRepository.testConnection.mockResolvedValue(true);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.connectCalendar(userId, connectionData);

            expect(calendarRepository.createConnection).toHaveBeenCalledWith({
                userId,
                ...connectionData
            });
            expect(calendarRepository.testConnection).toHaveBeenCalledWith(
                connectionData.provider,
                connectionData.accessToken
            );
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('calendar.connected', {
                connection: mockConnection,
                userId
            });
            expect(result).toEqual(mockConnection);
        });

        it('should test connection before saving', async () => {
            calendarRepository.testConnection.mockResolvedValue(false);

            await expect(calendarService.connectCalendar(userId, connectionData))
                .rejects.toThrow('Failed to connect to calendar service');

            expect(calendarRepository.createConnection).not.toHaveBeenCalled();
        });

        it('should handle duplicate connections', async () => {
            calendarRepository.findConnection.mockResolvedValue({
                id: 'existing-connection',
                userId,
                provider: CalendarProvider.GOOGLE,
                email: connectionData.email
            });

            await expect(calendarService.connectCalendar(userId, connectionData))
                .rejects.toThrow('Calendar already connected');
        });

        it('should encrypt sensitive tokens', async () => {
            const mockConnection = {
                id: 'connection-123',
                userId,
                provider: CalendarProvider.GOOGLE,
                email: connectionData.email
            };

            calendarRepository.createConnection.mockResolvedValue(mockConnection);
            calendarRepository.testConnection.mockResolvedValue(true);

            await calendarService.connectCalendar(userId, connectionData);

            expect(calendarRepository.createConnection).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessToken: expect.not.stringMatching(connectionData.accessToken),
                    refreshToken: expect.not.stringMatching(connectionData.refreshToken)
                })
            );
        });
    });

    describe('syncCalendar', () => {
        it('should successfully sync calendar events', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    title: 'Team Meeting',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 60 * 60 * 1000),
                    description: 'Weekly team sync'
                },
                {
                    id: 'event-2',
                    title: 'Project Review',
                    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
                    description: 'Q4 project review'
                }
            ];

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                accessToken: 'encrypted-token',
                isActive: true
            });
            calendarRepository.fetchEvents.mockResolvedValue(mockEvents);
            calendarRepository.syncEvents.mockResolvedValue({
                synced: 2,
                conflicts: 0,
                errors: 0
            });
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.syncCalendar(userId, calendarId);

            expect(calendarRepository.getConnection).toHaveBeenCalledWith(calendarId, userId);
            expect(calendarRepository.fetchEvents).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                'encrypted-token'
            );
            expect(calendarRepository.syncEvents).toHaveBeenCalled();
            expect(result).toMatchObject({
                synced: 2,
                conflicts: 0,
                errors: 0
            });
        });

        it('should handle expired tokens', async () => {
            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                accessToken: 'expired-token',
                refreshToken: 'refresh-token',
                isActive: true
            });
            calendarRepository.fetchEvents.mockRejectedValue(new Error('Token expired'));
            calendarRepository.refreshToken.mockResolvedValue('new-access-token');
            calendarRepository.updateConnection.mockResolvedValue(true);

            await expect(calendarService.syncCalendar(userId, calendarId))
                .rejects.toThrow('Token refresh failed');

            expect(calendarRepository.refreshToken).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                'refresh-token'
            );
        });

        it('should validate calendar ownership', async () => {
            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId: 'different-user-id',
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });

            await expect(calendarService.syncCalendar(userId, calendarId))
                .rejects.toThrow('Calendar not found or access denied');
        });

        it('should handle inactive calendar connections', async () => {
            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: false
            });

            await expect(calendarService.syncCalendar(userId, calendarId))
                .rejects.toThrow('Calendar connection is inactive');
        });
    });

    describe('createCalendarEvent', () => {
        const eventData = {
            title: 'Team Standup',
            description: 'Daily team standup meeting',
            startTime: new Date(Date.now() + 60 * 60 * 1000),
            endTime: new Date(Date.now() + 90 * 60 * 1000),
            location: 'Conference Room A',
            attendees: ['user1@example.com', 'user2@example.com'],
            recurrence: 'daily'
        };

        it('should successfully create calendar event', async () => {
            const mockEvent = {
                id: 'event-123',
                ...eventData,
                calendarId,
                isRecurring: true
            };

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.createEvent.mockResolvedValue(mockEvent);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.createCalendarEvent(userId, calendarId, eventData);

            expect(calendarRepository.createEvent).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                calendarId,
                eventData
            );
            expect(cacheService.set).toHaveBeenCalledWith(
                `calendar:event:${mockEvent.id}`,
                JSON.stringify(mockEvent),
                3600
            );
            expect(result).toEqual(mockEvent);
        });

        it('should validate event times', async () => {
            const invalidEventData = {
                ...eventData,
                endTime: new Date(eventData.startTime.getTime() - 60 * 60 * 1000) // End before start
            };

            await expect(calendarService.createCalendarEvent(userId, calendarId, invalidEventData))
                .rejects.toThrow('End time must be after start time');
        });

        it('should validate attendee emails', async () => {
            const invalidEventData = {
                ...eventData,
                attendees: ['invalid-email', 'valid@example.com']
            };

            await expect(calendarService.createCalendarEvent(userId, calendarId, invalidEventData))
                .rejects.toThrow('Invalid attendee email format');
        });

        it('should handle conflicting events', async () => {
            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.checkConflicts.mockResolvedValue([
                {
                    id: 'conflicting-event',
                    title: 'Existing Meeting',
                    startTime: eventData.startTime,
                    endTime: eventData.endTime
                }
            ]);

            const result = await calendarService.createCalendarEvent(userId, calendarId, eventData);

            expect(result).toHaveProperty('conflicts');
            expect(result.conflicts).toHaveLength(1);
        });
    });

    describe('updateCalendarEvent', () => {
        const eventId = 'event-123';
        const updateData = {
            title: 'Updated Meeting',
            description: 'Updated description',
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000)
        };

        it('should successfully update calendar event', async () => {
            const existingEvent = {
                id: eventId,
                title: 'Original Meeting',
                description: 'Original description',
                startTime: new Date(),
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                calendarId,
                userId
            };
            const updatedEvent = { ...existingEvent, ...updateData };

            calendarRepository.findEventById.mockResolvedValue(existingEvent);
            calendarRepository.updateEvent.mockResolvedValue(updatedEvent);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.updateCalendarEvent(userId, calendarId, eventId, updateData);

            expect(calendarRepository.findEventById).toHaveBeenCalledWith(eventId, userId);
            expect(calendarRepository.updateEvent).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                eventId,
                updateData
            );
            expect(cacheService.del).toHaveBeenCalledWith(`calendar:event:${eventId}`);
            expect(result).toEqual(updatedEvent);
        });

        it('should throw error if event not found', async () => {
            calendarRepository.findEventById.mockResolvedValue(null);

            await expect(calendarService.updateCalendarEvent(userId, calendarId, eventId, updateData))
                .rejects.toThrow('Calendar event not found');
        });

        it('should validate event ownership', async () => {
            calendarRepository.findEventById.mockResolvedValue({
                id: eventId,
                userId: 'different-user-id',
                calendarId
            });

            await expect(calendarService.updateCalendarEvent(userId, calendarId, eventId, updateData))
                .rejects.toThrow('Calendar event not found or access denied');
        });

        it('should validate calendar ownership', async () => {
            calendarRepository.findEventById.mockResolvedValue({
                id: eventId,
                userId,
                calendarId: 'different-calendar-id'
            });

            await expect(calendarService.updateCalendarEvent(userId, calendarId, eventId, updateData))
                .rejects.toThrow('Event does not belong to specified calendar');
        });
    });

    describe('deleteCalendarEvent', () => {
        const eventId = 'event-123';

        it('should successfully delete calendar event', async () => {
            const existingEvent = {
                id: eventId,
                title: 'Meeting to Delete',
                userId,
                calendarId
            };

            calendarRepository.findEventById.mockResolvedValue(existingEvent);
            calendarRepository.deleteEvent.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.deleteCalendarEvent(userId, calendarId, eventId);

            expect(calendarRepository.findEventById).toHaveBeenCalledWith(eventId, userId);
            expect(calendarRepository.deleteEvent).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                eventId
            );
            expect(cacheService.del).toHaveBeenCalledWith(`calendar:event:${eventId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('calendar.event.deleted', {
                eventId,
                userId
            });
            expect(result).toBe(true);
        });

        it('should handle recurring event deletion', async () => {
            const recurringEvent = {
                id: eventId,
                title: 'Recurring Meeting',
                userId,
                calendarId,
                recurrence: 'weekly',
                isRecurring: true
            };

            calendarRepository.findEventById.mockResolvedValue(recurringEvent);
            calendarRepository.deleteRecurringEvent.mockResolvedValue({
                deletedInstances: 4,
                cancelled: true
            });

            const result = await calendarService.deleteCalendarEvent(userId, calendarId, eventId, {
                deleteAll: true
            });

            expect(calendarRepository.deleteRecurringEvent).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                eventId
            );
            expect(result.cancelled).toBe(true);
        });
    });

    describe('getCalendarEvents', () => {
        const dateRange = {
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        it('should successfully retrieve calendar events', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    title: 'Team Meeting',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 60 * 60 * 1000)
                },
                {
                    id: 'event-2',
                    title: 'Project Review',
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 25 * 60 * 60 * 1000)
                }
            ];

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.fetchEvents.mockResolvedValue(mockEvents);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await calendarService.getCalendarEvents(userId, calendarId, dateRange);

            expect(calendarRepository.fetchEvents).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                expect.any(String),
                dateRange
            );
            expect(cacheService.set).toHaveBeenCalledWith(
                `calendar:events:${calendarId}:${dateRange.startDate.toISOString()}`,
                JSON.stringify(mockEvents),
                1800
            );
            expect(result).toEqual(mockEvents);
        });

        it('should return cached events if available', async () => {
            const cachedEvents = [
                {
                    id: 'cached-event',
                    title: 'Cached Meeting',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 60 * 60 * 1000)
                }
            ];

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            cacheService.get.mockResolvedValue(JSON.stringify(cachedEvents));

            const result = await calendarService.getCalendarEvents(userId, calendarId, dateRange);

            expect(calendarRepository.fetchEvents).not.toHaveBeenCalled();
            expect(result).toEqual(cachedEvents);
        });

        it('should filter events by type', async () => {
            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.fetchEvents.mockResolvedValue([]);

            await calendarService.getCalendarEvents(userId, calendarId, dateRange, {
                type: 'meeting'
            });

            expect(calendarRepository.fetchEvents).toHaveBeenCalledWith(
                CalendarProvider.GOOGLE,
                expect.any(String),
                dateRange,
                expect.objectContaining({ type: 'meeting' })
            );
        });
    });

    describe('syncWithPlanner', () => {
        it('should successfully sync calendar events with planner', async () => {
            const syncConfig = {
                calendarId,
                plannerId: 'planner-123',
                syncDirection: 'bidirectional',
                conflictResolution: 'planner_wins',
                fieldMapping: {
                    eventTitle: 'activityTitle',
                    eventDescription: 'activityDescription',
                    eventTime: 'activityDueDate'
                }
            };

            const mockEvents = [
                {
                    id: 'event-1',
                    title: 'Project Deadline',
                    startTime: new Date(),
                    description: 'Complete project deliverables'
                }
            ];

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.fetchEvents.mockResolvedValue(mockEvents);
            calendarRepository.syncWithPlanner.mockResolvedValue({
                syncedActivities: 3,
                syncedEvents: 2,
                conflicts: 1,
                resolved: 1
            });
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.syncWithPlanner(userId, syncConfig);

            expect(calendarRepository.syncWithPlanner).toHaveBeenCalledWith(
                userId,
                syncConfig
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith('calendar.planner.synced', {
                userId,
                syncConfig,
                result
            });
            expect(result.syncedActivities).toBe(3);
            expect(result.syncedEvents).toBe(2);
        });

        it('should handle sync conflicts', async () => {
            const syncConfig = {
                calendarId,
                plannerId: 'planner-123',
                syncDirection: 'bidirectional',
                conflictResolution: 'manual_review'
            };

            calendarRepository.getConnection.mockResolvedValue({
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            });
            calendarRepository.syncWithPlanner.mockResolvedValue({
                syncedActivities: 0,
                syncedEvents: 0,
                conflicts: 2,
                conflictsNeedReview: ['conflict-1', 'conflict-2']
            });

            const result = await calendarService.syncWithPlanner(userId, syncConfig);

            expect(result.conflicts).toBe(2);
            expect(result.conflictsNeedReview).toHaveLength(2);
        });

        it('should validate sync configuration', async () => {
            const invalidConfig = {
                calendarId: '', // Invalid calendar ID
                plannerId: 'planner-123',
                syncDirection: 'invalid_direction'
            };

            await expect(calendarService.syncWithPlanner(userId, invalidConfig))
                .rejects.toThrow('Invalid sync configuration');
        });
    });

    describe('disconnectCalendar', () => {
        it('should successfully disconnect calendar', async () => {
            const existingConnection = {
                id: calendarId,
                userId,
                provider: CalendarProvider.GOOGLE,
                isActive: true
            };

            calendarRepository.findConnectionById.mockResolvedValue(existingConnection);
            calendarRepository.deleteConnection.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await calendarService.disconnectCalendar(userId, calendarId);

            expect(calendarRepository.findConnectionById).toHaveBeenCalledWith(calendarId, userId);
            expect(calendarRepository.deleteConnection).toHaveBeenCalledWith(calendarId);
            expect(cacheService.del).toHaveBeenCalledWith(`calendar:connection:${calendarId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('calendar.disconnected', {
                calendarId,
                userId
            });
            expect(result).toBe(true);
        });

        it('should throw error if connection not found', async () => {
            calendarRepository.findConnectionById.mockResolvedValue(null);

            await expect(calendarService.disconnectCalendar(userId, calendarId))
                .rejects.toThrow('Calendar connection not found');
        });

        it('should only allow owner to disconnect calendar', async () => {
            calendarRepository.findConnectionById.mockResolvedValue({
                id: calendarId,
                userId: 'different-user-id',
                provider: CalendarProvider.GOOGLE
            });

            await expect(calendarService.disconnectCalendar(userId, calendarId))
                .rejects.toThrow('Calendar connection not found or access denied');
        });
    });
});