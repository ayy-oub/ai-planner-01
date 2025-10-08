import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarSync } from './entities/calendar-sync.entity';
import { SyncCalendarDto } from './dto/sync-calendar.dto';
import { CalendarEventDto } from './dto/calendar-event.dto';

@Injectable()
export class CalendarRepository {
    private readonly logger = new Logger(CalendarRepository.name);

    constructor(
        @InjectRepository(CalendarEvent)
        private readonly calendarEventRepository: Repository<CalendarEvent>,
        @InjectRepository(CalendarSync)
        private readonly calendarSyncRepository: Repository<CalendarSync>,
    ) { }

    /**
     * Find calendar event by ID
     */
    async findEventById(eventId: string): Promise<CalendarEvent | null> {
        return this.calendarEventRepository.findOne({
            where: { id: eventId },
            relations: ['planner', 'activity']
        });
    }

    /**
     * Find calendar events by user ID
     */
    async findEventsByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
        const query = this.calendarEventRepository
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.planner', 'planner')
            .leftJoinAndSelect('event.activity', 'activity')
            .where('event.userId = :userId', { userId });

        if (startDate) {
            query.andWhere('event.startDate >= :startDate', { startDate });
        }

        if (endDate) {
            query.andWhere('event.endDate <= :endDate', { endDate });
        }

        return query.orderBy('event.startDate', 'ASC').getMany();
    }

    /**
     * Find calendar events by planner ID
     */
    async findEventsByPlannerId(plannerId: string): Promise<CalendarEvent[]> {
        return this.calendarEventRepository.find({
            where: { plannerId },
            relations: ['activity'],
            order: { startDate: 'ASC' }
        });
    }

    /**
     * Create calendar event
     */
    async createEvent(eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        const event = this.calendarEventRepository.create(eventData);
        return this.calendarEventRepository.save(event);
    }

    /**
     * Update calendar event
     */
    async updateEvent(eventId: string, updateData: Partial<CalendarEvent>): Promise<CalendarEvent> {
        await this.calendarEventRepository.update(eventId, updateData);
        return this.findEventById(eventId);
    }

    /**
     * Delete calendar event
     */
    async deleteEvent(eventId: string): Promise<boolean> {
        const result = await this.calendarEventRepository.delete(eventId);
        return result.affected > 0;
    }

    /**
     * Find calendar sync by user ID and provider
     */
    async findSyncByUserAndProvider(userId: string, provider: string): Promise<CalendarSync | null> {
        return this.calendarSyncRepository.findOne({
            where: { userId, provider }
        });
    }

    /**
     * Create or update calendar sync
     */
    async upsertCalendarSync(syncData: Partial<CalendarSync>): Promise<CalendarSync> {
        const existing = await this.findSyncByUserAndProvider(syncData.userId, syncData.provider);

        if (existing) {
            await this.calendarSyncRepository.update(existing.id, syncData);
            return this.calendarSyncRepository.findOne({ where: { id: existing.id } });
        }

        const sync = this.calendarSyncRepository.create(syncData);
        return this.calendarSyncRepository.save(sync);
    }

    /**
     * Delete calendar sync
     */
    async deleteCalendarSync(syncId: string): Promise<boolean> {
        const result = await this.calendarSyncRepository.delete(syncId);
        return result.affected > 0;
    }

    /**
     * Find all calendar syncs for a user
     */
    async findSyncsByUserId(userId: string): Promise<CalendarSync[]> {
        return this.calendarSyncRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' }
        });
    }

    /**
     * Find events that need to be synced
     */
    async findEventsForSync(userId: string, provider: string, lastSyncDate?: Date): Promise<CalendarEvent[]> {
        const query = this.calendarEventRepository
            .createQueryBuilder('event')
            .where('event.userId = :userId', { userId })
            .andWhere('event.syncEnabled = true')
            .andWhere('event.provider = :provider', { provider });

        if (lastSyncDate) {
            query.andWhere('event.updatedAt > :lastSyncDate', { lastSyncDate });
        }

        return query.getMany();
    }

    /**
     * Update event sync status
     */
    async updateEventSyncStatus(eventId: string, syncData: {
        externalId?: string;
        syncStatus?: 'pending' | 'synced' | 'failed';
        lastSyncError?: string;
        lastSyncedAt?: Date;
    }): Promise<CalendarEvent> {
        await this.calendarEventRepository.update(eventId, syncData);
        return this.findEventById(eventId);
    }

    /**
     * Bulk create or update events
     */
    async bulkUpsertEvents(events: Partial<CalendarEvent>[]): Promise<CalendarEvent[]> {
        return this.calendarEventRepository.save(events);
    }

    /**
     * Get calendar statistics
     */
    async getCalendarStats(userId: string, startDate: Date, endDate: Date): Promise<any> {
        const stats = await this.calendarEventRepository
            .createQueryBuilder('event')
            .select('COUNT(*)', 'totalEvents')
            .addSelect('COUNT(CASE WHEN event.syncEnabled = true THEN 1 END)', 'syncedEvents')
            .addSelect('COUNT(CASE WHEN event.syncStatus = :failed THEN 1 END)', 'failedSyncs')
            .addSelect('AVG(event.confidence)', 'averageConfidence')
            .where('event.userId = :userId', { userId })
            .andWhere('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .setParameter('failed', 'failed')
            .getRawOne();

        return {
            totalEvents: parseInt(stats.totalEvents) || 0,
            syncedEvents: parseInt(stats.syncedEvents) || 0,
            failedSyncs: parseInt(stats.failedSyncs) || 0,
            averageConfidence: parseFloat(stats.averageConfidence) || 0
        };
    }
}