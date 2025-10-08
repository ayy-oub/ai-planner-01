// src/modules/activity/dto/activity-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Activity, ActivityStatistics, ActivityStatus, ActivityPriority, ActivityType } from '../activity.types';

export class ActivityResponseDto {
    @ApiProperty({
        description: 'The activity data',
        type: 'object'
    })
    activity: Activity;

    @ApiProperty({
        description: 'Statistics for the activity',
        type: 'object',
        required: false
    })
    statistics?: ActivityStatistics;

    @ApiProperty({
        description: 'Dependency activities',
        type: [Object],
        required: false
    })
    dependencies?: Activity[];

    @ApiProperty({
        description: 'Assignee information',
        type: 'object',
        required: false
    })
    assigneeInfo?: {
        userId: string;
        displayName: string;
        photoURL?: string;
    };
}

export class ActivityListResponseDto {
    @ApiProperty({
        description: 'List of activities',
        type: [Object]
    })
    activities: Activity[];

    @ApiProperty({
        description: 'Total number of activities',
        example: 50
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1
    })
    page: number;

    @ApiProperty({
        description: 'Number of items per page',
        example: 20
    })
    limit: number;

    @ApiProperty({
        description: 'Whether there are more pages',
        example: true
    })
    hasNext: boolean;

    @ApiProperty({
        description: 'Whether there are previous pages',
        example: false
    })
    hasPrev: boolean;

    @ApiProperty({
        description: 'Applied filters',
        type: 'object'
    })
    filters: any;
}

export class BulkActivityUpdateDto {
    @ApiProperty({
        description: 'Activity IDs to update',
        type: [String],
        required: true
    })
    activityIds: string[];

    @ApiProperty({
        description: 'Updates to apply',
        type: 'object',
        required: true
    })
    updates: Partial<Activity>;
}

export class ActivityReorderDto {
    @ApiProperty({
        description: 'Activities with new order positions',
        type: [Object],
        required: true
    })
    activities: Array<{
        id: string;
        order: number;
    }>;
}