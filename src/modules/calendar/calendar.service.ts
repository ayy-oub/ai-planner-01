import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CalendarRepository } from './calendar.repository';
import { SyncCalendarDto } from './dto/sync-calendar.dto';
import { CalendarEventDto } from './dto/calendar-event.dto';
import {
    GoogleCalendarProvider,
    OutlookCalendarProvider,
    CalendarProviderFactory
} from './providers/calendar-provider.factory';
import { CalendarSyncStatus, CalendarEvent, SupportedCalendarProvider } from './calendar.types';

@Injectable()
export class CalendarService {
    private readonly logger = new Logger(CalendarService.name);
    private readonly providers: Map<string, any> = new Map();

    constructor(
        private readonly calendarRepository: CalendarRepository,
        private readonly providerFactory: CalendarProviderFactory,
    ) {
        // Initialize providers
        this.providers.set('google', new GoogleCalendarProvider());
        this.providers.set('outlook', new OutlookCalendarProvider());
    }

    /**
     * Sync calendar with external provider
     */
    async syncCalendar(
        userId: string,
        syncData: SyncCalendarDto,
        accessToken: string
    ): Promise<any> {
        try {
            const { provider, syncDirection, calendarId } = syncData;

            // Validate provider
            if (!this.providers.has(provider)) {
                throw new HttpException(
                    `Unsupported calendar provider: ${provider}`,
                    HttpStatus.BAD_REQUEST
                );
            }

            // Get calendar provider
            const calendarProvider = this.providers.get(provider);

            // Test connection
            const connectionTest = await calendarProvider.testConnection(accessToken);
            if (!connectionTest.success) {
                throw new HttpException(
                    'Failed to connect to calendar provider',
                    HttpStatus.UNAUTHORIZED
                );
            }

            // Save or update sync configuration
            const syncConfig = await this.calendarRepository.upsertCalendarSync({
                userId,
                provider,
                calendarId: calendarId || 'primary',
                accessToken: this.encryptToken(accessToken),
                syncDirection: syncDirection || 'bidirectional',
                lastSyncDate: new Date(),
                isActive: true
            });

            // Perform initial sync based on direction
            let syncResult;
            switch (syncDirection) {
                case 'import':
                    syncResult = await this.importFromExternal(userId, provider, accessToken);
                    break;
                case 'export':
                    syncResult = await this.exportToExternal(userId, provider, accessToken);
                    break;
                case 'bidirectional':
                default:
                    syncResult = await this.performBidirectionalSync(userId, provider, accessToken);
                    break;
            }

            return {
                success: true,
                data: {
                    syncConfig,
                    syncResult,
                    message: 'Calendar sync completed successfully'
                }
            };
        } catch (error) {
            this.logger.error(`Calendar sync failed: ${error.message}`, error.stack);
            throw new HttpException(
                `Calendar sync failed: ${error.message}`,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Create calendar event
     */
    async createEvent(userId: string, eventData: CalendarEventDto): Promise<any> {
        try {
            // Validate event data
            this.validateEventData(eventData);

            // Create event
            const event = await this.calendarRepository.createEvent({
                ...eventData,
                userId,
                syncStatus: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Sync with external providers if enabled
            if (eventData.syncEnabled) {
                await this.syncEventToExternalProviders(event);
            }

            return {
                success: true,
                data: event,
                message: 'Calendar event created successfully'
            };
        } catch (error) {
            this.logger.error(`Failed to create calendar event: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to create calendar event: ${error.message}`,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Get user's calendar events
     */
    async getUserEvents(
        userId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<any> {
        try {
            const events = await this.calendarRepository.findEventsByUserId(userId, startDate, endDate);

            return {
                success: true,
                data: events,
                metadata: {
                    total: events.length,
                    startDate,
                    endDate
                }
            };
        } catch (error) {
            this.logger.error(`Failed to fetch calendar events: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to fetch calendar events',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Update calendar event
     */
    async updateEvent(
        userId: string,
        eventId: string,
        updateData: Partial<CalendarEventDto>
    ): Promise<any> {
        try {
            // Check if event exists and belongs to user
            const existingEvent = await this.calendarRepository.findEventById(eventId);
            if (!existingEvent || existingEvent.userId !== userId) {
                throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
            }

            // Update event
            const updatedEvent = await this.calendarRepository.updateEvent(eventId, {
                ...updateData,
                updatedAt: new Date()
            });

            // Sync with external providers if enabled
            if (updatedEvent.syncEnabled) {
                await this.syncEventToExternalProviders(updatedEvent);
            }

            return {
                success: true,
                data: updatedEvent,
                message: 'Calendar event updated successfully'
            };
        } catch (error) {
            this.logger.error(`Failed to update calendar event: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to update calendar event: ${error.message}`,
                error.status || HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Delete calendar event
     */
    async deleteEvent(userId: string, eventId: string): Promise<any> {
        try {
            // Check if event exists and belongs to user
            const existingEvent = await this.calendarRepository.findEventById(eventId);
            if (!existingEvent || existingEvent.userId !== userId) {
                throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
            }

            // Delete from external providers first
            if (existingEvent.syncEnabled && existingEvent.externalId) {
                await this.deleteEventFromExternalProviders(existingEvent);
            }

            // Delete event
            const deleted = await this.calendarRepository.deleteEvent(eventId);
            if (!deleted) {
                throw new HttpException('Failed to delete event', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            return {
                success: true,
                message: 'Calendar event deleted successfully'
            };
        } catch (error) {
            this.logger.error(`Failed to delete calendar event: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to delete calendar event: ${error.message}`,
                error.status || HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Disconnect calendar provider
     */
    async disconnectProvider(userId: string, provider: string): Promise<any> {
        try {
            const sync = await this.calendarRepository.findSyncByUserAndProvider(userId, provider);
            if (!sync) {
                throw new HttpException('Calendar sync not found', HttpStatus.NOT_FOUND);
            }

            const deleted = await this.calendarRepository.deleteCalendarSync(sync.id);
            if (!deleted) {
                throw new HttpException('Failed to disconnect calendar', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            return {
                success: true,
                message: `${provider} calendar disconnected successfully`
            };
        } catch (error) {
            this.logger.error(`Failed to disconnect calendar: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to disconnect calendar: ${error.message}`,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get calendar sync status
     */
    async getSyncStatus(userId: string): Promise<any> {
        try {
            const syncs = await this.calendarRepository.findSyncsByUserId(userId);

            const status = {
                connectedProviders: syncs.map(sync => ({
                    provider: sync.provider,
                    calendarId: sync.calendarId,
                    lastSyncDate: sync.lastSyncDate,
                    isActive: sync.isActive,
                    syncDirection: sync.syncDirection
                })),
                totalConnected: syncs.length
            };

            return {
                success: true,
                data: status
            };
        } catch (error) {
            this.logger.error(`Failed to get sync status: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to get sync status',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Import events from external calendar
     */
    private async importFromExternal(userId: string, provider: string, accessToken: string): Promise<any> {
        const calendarProvider = this.providers.get(provider);
        const externalEvents = await calendarProvider.getEvents(accessToken);

        const importedEvents = [];
        for (const externalEvent of externalEvents) {
            const eventData = this.mapExternalEventToInternal(externalEvent, userId, provider);
            const createdEvent = await this.calendarRepository.createEvent(eventData);
            importedEvents.push(createdEvent);
        }

        return {
            importedCount: importedEvents.length,
            events: importedEvents
        };
    }

    /**
     * Export events to external calendar
     */
    private async exportToExternal(userId: string, provider: string, accessToken: string): Promise<any> {
        const events = await this.calendarRepository.findEventsByUserId(userId);
        const calendarProvider = this.providers.get(provider);

        const exportedEvents = [];
        for (const event of events) {
            const externalEvent = await calendarProvider.createEvent(accessToken, event);

            // Update event with external ID
            await this.calendarRepository.updateEventSyncStatus(event.id, {
                externalId: externalEvent.id,
                syncStatus: 'synced',
                lastSyncedAt: new Date()
            });

            exportedEvents.push(externalEvent);
        }

        return {
            exportedCount: exportedEvents.length,
            events: exportedEvents
        };
    }

    /**
     * Perform bidirectional sync
     */
    private async performBidirectionalSync(userId: string, provider: string, accessToken: string): Promise<any> {
        const importResult = await this.importFromExternal(userId, provider, accessToken);
        const exportResult = await this.exportToExternal(userId, provider, accessToken);

        return {
            importResult,
            exportResult,
            totalSynced: importResult.importedCount + exportResult.exportedCount
        };
    }

    /**
     * Sync event to external providers
     */
    private async syncEventToExternalProviders(event: CalendarEvent): Promise<void> {
        const syncs = await this.calendarRepository.findSyncsByUserId(event.userId);

        for (const sync of syncs) {
            if (sync.isActive && sync.provider === event.provider) {
                try {
                    const provider = this.providers.get(sync.provider);
                    const decryptedToken = this.decryptToken(sync.accessToken);

                    let externalEvent;
                    if (event.externalId) {
                        externalEvent = await provider.updateEvent(decryptedToken, event.externalId, event);
                    } else {
                        externalEvent = await provider.createEvent(decryptedToken, event);

                        // Update event with external ID
                        await this.calendarRepository.updateEventSyncStatus(event.id, {
                            externalId: externalEvent.id,
                            syncStatus: 'synced',
                            lastSyncedAt: new Date()
                        });
                    }
                } catch (error) {
                    this.logger.error(`Failed to sync event to ${sync.provider}: ${error.message}`);

                    // Update sync status to failed
                    await this.calendarRepository.updateEventSyncStatus(event.id, {
                        syncStatus: 'failed',
                        lastSyncError: error.message,
                        lastSyncedAt: new Date()
                    });
                }
            }
        }
    }

    /**
     * Delete event from external providers
     */
    private async deleteEventFromExternalProviders(event: CalendarEvent): Promise<void> {
        if (!event.externalId) return;

        const syncs = await this.calendarRepository.findSyncsByUserId(event.userId);

        for (const sync of syncs) {
            if (sync.isActive && sync.provider === event.provider) {
                try {
                    const provider = this.providers.get(sync.provider);
                    const decryptedToken = this.decryptToken(sync.accessToken);
                    await provider.deleteEvent(decryptedToken, event.externalId);
                } catch (error) {
                    this.logger.error(`Failed to delete event from ${sync.provider}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Validate event data
     */
    private validateEventData(eventData: CalendarEventDto): void {
        if (!eventData.title || eventData.title.trim().length === 0) {
            throw new Error('Event title is required');
        }

        if (eventData.startDate && eventData.endDate && eventData.startDate >= eventData.endDate) {
            throw new Error('End date must be after start date');
        }

        if (eventData.recurrenceRule && !this.isValidRecurrenceRule(eventData.recurrenceRule)) {
            throw new Error('Invalid recurrence rule format');
        }
    }

    /**
     * Check if recurrence rule is valid
     */
    private isValidRecurrenceRule(rule: string): boolean {
        // Basic validation for RRULE format
        return rule.startsWith('RRULE:') || rule.startsWith('FREQ=');
    }

    /**
     * Map external event to internal format
     */
    private mapExternalEventToInternal(externalEvent: any, userId: string, provider: string): Partial<CalendarEvent> {
        return {
            userId,
            provider,
            externalId: externalEvent.id,
            title: externalEvent.summary || 'Untitled Event',
            description: externalEvent.description,
            startDate: externalEvent.start?.dateTime || externalEvent.start?.date,
            endDate: externalEvent.end?.dateTime || externalEvent.end?.date,
            location: externalEvent.location,
            timezone: externalEvent.start?.timeZone,
            isAllDay: !externalEvent.start?.dateTime,
            syncEnabled: true,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Encrypt token (simple implementation - use proper encryption in production)
     */
    private encryptToken(token: string): string {
        // In production, use proper encryption like AES-256-GCM
        return Buffer.from(token).toString('base64');
    }

    /**
     * Decrypt token (simple implementation - use proper encryption in production)
     */
    private decryptToken(encryptedToken: string): string {
        // In production, use proper decryption
        return Buffer.from(encryptedToken, 'base64').toString();
    }
}