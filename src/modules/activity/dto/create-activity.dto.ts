// src/modules/activity/dto/create-activity.dto.ts
import { IsString, IsOptional, IsIn, IsArray, IsDate, IsObject, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateActivityDto {
    @ApiProperty({
        description: 'Title of the activity',
        example: 'Complete project documentation',
        required: true,
        minLength: 1,
        maxLength: 200
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Description of the activity',
        example: 'Write comprehensive documentation for the new API endpoints',
        required: false,
        maxLength: 2000
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Type of activity',
        example: 'task',
        enum: ['task', 'event', 'note', 'goal', 'habit', 'milestone'],
        required: false,
        default: 'task'
    })
    @IsOptional()
    @IsIn(['task', 'event', 'note', 'goal', 'habit', 'milestone'])
    type?: string;

    @ApiProperty({
        description: 'Status of the activity',
        example: 'pending',
        enum: ['pending', 'in-progress', 'completed', 'cancelled', 'archived'],
        required: false,
        default: 'pending'
    })
    @IsOptional()
    @IsIn(['pending', 'in-progress', 'completed', 'cancelled', 'archived'])
    status?: string;

    @ApiProperty({
        description: 'Priority of the activity',
        example: 'medium',
        enum: ['low', 'medium', 'high', 'urgent'],
        required: false,
        default: 'medium'
    })
    @IsOptional()
    @IsIn(['low', 'medium', 'high', 'urgent'])
    priority?: string;

    @ApiProperty({
        description: 'Due date for the activity',
        example: '2024-12-31T23:59:59Z',
        required: false
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    dueDate?: Date;

    @ApiProperty({
        description: 'Tags for the activity',
        required: false,
        type: [String],
        example: ['work', 'documentation', 'api']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiProperty({
        description: 'User ID of the assignee',
        example: 'user-123',
        required: false
    })
    @IsOptional()
    @IsString()
    assignee?: string;

    @ApiProperty({
        description: 'Activity IDs this activity depends on',
        required: false,
        type: [String],
        example: ['activity-1', 'activity-2']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    dependencies?: string[];

    @ApiProperty({
        description: 'Recurring settings for the activity',
        required: false,
        type: 'object'
    })
    @IsOptional()
    @IsObject()
    recurring?: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
        interval: number;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        months?: number[];
        endDate?: Date;
        occurrences?: number;
    };

    @ApiProperty({
        description: 'Reminders for the activity',
        required: false,
        type: [Object]
    })
    @IsOptional()
    @IsArray()
    reminders?: Array<{
        type: 'email' | 'push' | 'sms';
        timeBefore: number;
        message?: string;
    }>;

    @ApiProperty({
        description: 'Additional metadata for the activity',
        required: false,
        type: 'object'
    })
    @IsOptional()
    @IsObject()
    metadata?: {
        estimatedDuration?: number;
        difficulty?: number;
        energyLevel?: number;
        location?: string;
        cost?: number;
        customFields?: Record<string, any>;
    };
}