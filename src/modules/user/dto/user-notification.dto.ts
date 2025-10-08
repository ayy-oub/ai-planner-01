import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
    @ApiProperty({
        description: 'Notification type',
        enum: ['info', 'warning', 'error', 'success', 'reminder', 'alert'],
        example: 'info',
    })
    @IsEnum(['info', 'warning', 'error', 'success', 'reminder', 'alert'])
    type: 'info' | 'warning' | 'error' | 'success' | 'reminder' | 'alert';

    @ApiProperty({
        description: 'Notification title',
        example: 'Task Reminder',
        maxLength: 100,
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Notification message',
        example: 'You have a task due in 30 minutes',
        maxLength: 500,
    })
    @IsString()
    message: string;

    @ApiPropertyOptional({
        description: 'Action URL',
        example: 'https://app.example.com/tasks/123',
    })
    @IsString()
    @IsOptional()
    actionUrl?: string;

    @ApiPropertyOptional({
        description: 'Action text',
        example: 'View Task',
    })
    @IsString()
    @IsOptional()
    actionText?: string;

    @ApiPropertyOptional({
        description: 'Notification icon',
        example: '🔔',
    })
    @IsString()
    @IsOptional()
    icon?: string;

    @ApiProperty({
        description: 'Notification priority',
        enum: ['low', 'medium', 'high', 'urgent'],
        example: 'medium',
    })
    @IsEnum(['low', 'medium', 'high', 'urgent'])
    priority: 'low' | 'medium' | 'high' | 'urgent';

    @ApiPropertyOptional({
        description: 'Notification expires date (ISO string)',
        example: '2024-01-15T23:59:59Z',
    })
    @IsString()
    @IsOptional()
    expiresAt?: string;

    @ApiPropertyOptional({
        description: 'Additional metadata',
        type: Object,
    })
    @IsObject()
    @IsOptional()
    metadata?: any;
}

export class UpdateNotificationDto {
    @ApiPropertyOptional({
        description: 'Mark as read',
        example: true,
    })
    @IsOptional()
    read?: boolean;

    @ApiPropertyOptional({
        description: 'Dismiss notification',
        example: true,
    })
    @IsOptional()
    dismissed?: boolean;
}

export class BulkNotificationDto {
    @ApiProperty({
        description: 'User IDs to send notification to',
        type: [String],
        example: ['user_123abc', 'user_456def'],
    })
    @IsArray()
    userIds: string[];

    @ApiProperty({
        description: 'Notification data',
        type: CreateNotificationDto,
    })
    notification: CreateNotificationDto;

    @ApiPropertyOptional({
        description: 'Send immediately',
        example: true,
    })
    @IsOptional()
    immediate?: boolean;

    @ApiPropertyOptional({
        description: 'Schedule for later (ISO string)',
        example: '2024-01-15T10:00:00Z',
    })
    @IsString()
    @IsOptional()
    scheduleFor?: string;
}