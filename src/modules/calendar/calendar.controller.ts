import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ValidationPipe,
    UsePipes,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { SyncCalendarDto } from './dto/sync-calendar.dto';
import { CalendarEventDto } from './dto/calendar-event.dto';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) { }

    /**
     * Sync calendar with external provider
     */
    @Post('sync')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Sync calendar with external provider',
        description: 'Sync calendar with Google Calendar, Outlook, or other supported providers',
    })
    @ApiBody({
        description: 'Calendar sync configuration',
        type: SyncCalendarDto,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Calendar synced successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        syncConfig: { type: 'object' },
                        syncResult: { type: 'object' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid provider or sync configuration',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Failed to authenticate with calendar provider',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    async syncCalendar(
        @Body() syncData: SyncCalendarDto,
        @CurrentUser() user: any
    ): Promise<any> {
        // Extract access token from user context or request
        // This is a simplified implementation - adjust based on your auth flow
        const accessToken = user.accessToken || syncData.accessToken;
        
        if (!accessToken) {
            throw new HttpException('Access token required for calendar sync', HttpStatus.BAD_REQUEST);
        }

        return this.calendarService.syncCalendar(user.uid, syncData, accessToken);
    }

    /**
     * Create calendar event
     */
    @Post('events')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create calendar event',
        description: 'Create a new calendar event with optional external sync',
    })
    @ApiBody({
        description: 'Calendar event data',
        type: CalendarEventDto,
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Calendar event created successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid event data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    async createEvent(
        @Body() eventData: CalendarEventDto,
        @CurrentUser() user: any
    ): Promise<any> {
        return this.calendarService.createEvent(user.uid, eventData);
    }

    /**
     * Get user's calendar events
     */
    @Get('events')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get calendar events',
        description: 'Get user\'s calendar events with optional date range filtering',
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for filtering events (ISO format)',
        required: false,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for filtering events (ISO format)',
        required: false,
        example: '2024-01-31',
    })
    @ApiQuery({
        name: 'plannerId',
        description: 'Filter events by planner ID',
        required: false,
        example: 'planner_123',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Calendar events retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        startDate: { type: 'string', format: 'date-time' },
                        endDate: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserEvents(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('plannerId') plannerId?: string,
        @CurrentUser() user: any
    ): Promise<any> {
        let startDateObj: Date | undefined;
        let endDateObj: Date | undefined;

        if (startDate) {
            startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
                throw new HttpException('Invalid start date format', HttpStatus.BAD_REQUEST);
            }
        }

        if (endDate) {
            endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
                throw new HttpException('Invalid end date format', HttpStatus.BAD_REQUEST);
            }
        }

        // If plannerId is provided, get events for specific planner
        if (plannerId) {
            return this.calendarService.getPlannerEvents(user.uid, plannerId, startDateObj, endDateObj);
        }

        return this.calendarService.getUserEvents(user.uid, startDateObj, endDateObj);
    }

    /**
     * Update calendar event
     */
    @Put('events/:eventId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update calendar event',
        description: 'Update an existing calendar event',
    })
    @ApiParam({
        name: 'eventId',
        description: 'Event ID',
        example: 'event_123abc',
    })
    @ApiBody({
        description: 'Updated calendar event data',
        type: CalendarEventDto,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Calendar event updated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Event not found',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid event data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    async updateEvent(
        @Param('eventId') eventId: string,
        @Body() updateData: CalendarEventDto,
        @CurrentUser() user: any
    ): Promise<any> {
        return this.calendarService.updateEvent(user.uid, eventId, updateData);
    }

    /**
     * Delete calendar event
     */
    @Delete('events/:eventId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete calendar event',
        description: 'Delete a calendar event and sync deletion with external providers if enabled',
    })
    @ApiParam({
        name: 'eventId',
        description: 'Event ID',
        example: 'event_123abc',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Calendar event deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Event not found',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async deleteEvent(
        @Param('eventId') eventId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        return this.calendarService.deleteEvent(user.uid, eventId);
    }

    /**
     * Disconnect calendar provider
     */
    @Delete('providers/:provider')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Disconnect calendar provider',
        description: 'Disconnect from a calendar provider (Google, Outlook, etc.)',
    })
    @ApiParam({
        name: 'provider',
        description: 'Calendar provider name',
        example: 'google',
        enum: ['google', 'outlook', 'apple'],
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Calendar provider disconnected successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Calendar sync not found',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async disconnectProvider(
        @Param('provider') provider: string,
        @CurrentUser() user: any
    ): Promise<any> {
        return this.calendarService.disconnectProvider(user.uid, provider);
    }

    /**
     * Get calendar sync status
     */
    @Get('sync-status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get calendar sync status',
        description: 'Get status of all connected calendar providers',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sync status retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        connectedProviders: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    provider: { type: 'string' },
                                    calendarId: { type: 'string' },
                                    lastSyncDate: { type: 'string', format: 'date-time' },
                                    isActive: { type: 'boolean' },
                                    syncDirection: { type: 'string' },
                                },
                            },
                        },
                        totalConnected: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getSyncStatus(@CurrentUser() user: any): Promise<any> {
        return this.calendarService.getSyncStatus(user.uid);
    }

    /**
     * Get calendar statistics
     */
    @Get('stats')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get calendar statistics',
        description: 'Get calendar usage statistics for a date range',
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for statistics (ISO format)',
        required: true,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for statistics (ISO format)',
        required: true,
        example: '2024-01-31',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        totalEvents: { type: 'number' },
                        syncedEvents: { type: 'number' },
                        failedSyncs: { type: 'number' },
                        averageConfidence: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getCalendarStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @CurrentUser() user: any
    ): Promise<any> {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
        }

        return this.calendarService.getCalendarStats(user.uid, startDateObj, endDateObj);
    }

    /**
     * Get planner events
     */
    @Get('planners/:plannerId/events')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get planner events',
        description: 'Get calendar events for a specific planner',
    })
    @ApiParam({
        name: 'plannerId',
        description: 'Planner ID',
        example: 'planner_123abc',
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for filtering events (ISO format)',
        required: false,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for filtering events (ISO format)',
        required: false,
        example: '2024-01-31',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Planner events retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        plannerId: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getPlannerEvents(
        @Param('plannerId') plannerId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @CurrentUser() user: any
    ): Promise<any> {
        let startDateObj: Date | undefined;
        let endDateObj: Date | undefined;

        if (startDate) {
            startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
                throw new HttpException('Invalid start date format', HttpStatus.BAD_REQUEST);
            }
        }

        if (endDate) {
            endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
                throw new HttpException('Invalid end date format', HttpStatus.BAD_REQUEST);
            }
        }

        return this.calendarService.getPlannerEvents(user.uid, plannerId, startDateObj, endDateObj);
    }
}