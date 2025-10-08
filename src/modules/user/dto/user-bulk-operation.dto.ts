import { IsString, IsArray, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserBulkOperationDto {
    @ApiProperty({
        description: 'Bulk operation type',
        enum: ['activate', 'deactivate', 'suspend', 'unsuspend', 'update_role', 'update_subscription', 'send_notification', 'delete', 'export'],
        example: 'update_subscription',
    })
    @IsEnum(['activate', 'deactivate', 'suspend', 'unsuspend', 'update_role', 'update_subscription', 'send_notification', 'delete', 'export'])
    operation: string;

    @ApiProperty({
        description: 'User IDs to perform operation on',
        type: [String],
        example: ['user_123abc', 'user_456def', 'user_789ghi'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    userIds: string[];

    @ApiPropertyOptional({
        description: 'Operation data',
        type: Object,
        example: {
            plan: 'premium',
            status: 'active'
        }
    })
    @IsObject()
    @IsOptional()
    data?: any;

    @ApiPropertyOptional({
        description: 'Reason for the operation',
        example: 'Bulk upgrade to premium plan',
        maxLength: 500,
    })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    reason?: string;

    @ApiPropertyOptional({
        description: 'Send email notification to affected users',
        example: true,
    })
    @IsOptional()
    sendNotification?: boolean;
}