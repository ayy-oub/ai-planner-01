import { IsString, IsOptional, IsBoolean, IsEnum, IsNumber, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class NotificationSettingsDto {
    @ApiPropertyOptional({
        description: 'Enable email notifications',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    email?: boolean;

    @ApiPropertyOptional({
        description: 'Enable push notifications',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    push?: boolean;

    @ApiPropertyOptional({
        description: 'Enable SMS notifications',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    sms?: boolean;

    @ApiPropertyOptional({
        description: 'Notification frequency',
        enum: ['immediate', 'daily', 'weekly'],
        example: 'daily',
    })
    @IsEnum(['immediate', 'daily', 'weekly'])
    @IsOptional()
    frequency?: 'immediate' | 'daily' | 'weekly';

    @ApiPropertyOptional({
        description: 'Notification categories',
        type: 'object',
        example: {
            taskReminders: true,
            deadlineAlerts: true,
            productivityInsights: true,
            marketing: false,
            updates: true
        }
    })
    @IsOptional()
    categories?: {
        taskReminders?: boolean;
        deadlineAlerts?: boolean;
        productivityInsights?: boolean;
        marketing?: boolean;
        updates?: boolean;
    };
}

export class UpdatePreferencesDto {
    @ApiPropertyOptional({
        description: 'Application theme',
        enum: ['light', 'dark', 'auto'],
        example: 'dark',
    })
    @IsEnum(['light', 'dark', 'auto'])
    @IsOptional()
    theme?: 'light' | 'dark' | 'auto';

    @ApiPropertyOptional({
        description: 'Accent color',
        example: '#3498db',
        maxLength: 7,
    })
    @IsString()
    @MaxLength(7)
    @IsOptional()
    accentColor?: string;

    @ApiPropertyOptional({
        description: 'Default view',
        enum: ['planner', 'calendar', 'tasks', 'dashboard'],
        example: 'planner',
    })
    @IsEnum(['planner', 'calendar', 'tasks', 'dashboard'])
    @IsOptional()
    defaultView?: 'planner' | 'calendar' | 'tasks' | 'dashboard';

    @ApiPropertyOptional({
        description: 'Notification settings',
        type: NotificationSettingsDto,
    })
    @ValidateNested()
    @Type(() => NotificationSettingsDto)
    @IsOptional()
    notifications?: NotificationSettingsDto;

    @ApiPropertyOptional({
        description: 'User language',
        example: 'en',
        maxLength: 10,
    })
    @IsString()
    @MaxLength(10)
    @IsOptional()
    language?: string;

    @ApiPropertyOptional({
        description: 'User timezone',
        example: 'America/New_York',
        maxLength: 50,
    })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    timezone?: string;

    @ApiPropertyOptional({
        description: 'Date format',
        example: 'MM/dd/yyyy',
        maxLength: 20,
    })
    @IsString()
    @MaxLength(20)
    @IsOptional()
    dateFormat?: string;

    @ApiPropertyOptional({
        description: 'Time format',
        enum: ['12h', '24h'],
        example: '24h',
    })
    @IsEnum(['12h', '24h'])
    @IsOptional()
    timeFormat?: '12h' | '24h';

    @ApiPropertyOptional({
        description: 'Week starts on',
        enum: ['sunday', 'monday'],
        example: 'monday',
    })
    @IsEnum(['sunday', 'monday'])
    @IsOptional()
    weekStartsOn?: 'sunday' | 'monday';

    @ApiPropertyOptional({
        description: 'Default planner privacy',
        enum: ['private', 'public', 'shared'],
        example: 'private',
    })
    @IsEnum(['private', 'public', 'shared'])
    @IsOptional()
    defaultPlannerPrivacy?: 'private' | 'public' | 'shared';

    @ApiPropertyOptional({
        description: 'Auto save interval in seconds',
        example: 30,
        minimum: 10,
        maximum: 300,
    })
    @IsNumber()
    @Min(10)
    @Max(300)
    @IsOptional()
    autoSaveInterval?: number;

    @ApiPropertyOptional({
        description: 'Enable sound effects',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    enableSoundEffects?: boolean;

    @ApiPropertyOptional({
        description: 'Enable animations',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    enableAnimations?: boolean;

    @ApiPropertyOptional({
        description: 'Reduce motion',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    reduceMotion?: boolean;

    @ApiPropertyOptional({
        description: 'High contrast mode',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    highContrast?: boolean;

    @ApiPropertyOptional({
        description: 'Font size',
        enum: ['small', 'medium', 'large'],
        example: 'medium',
    })
    @IsEnum(['small', 'medium', 'large'])
    @IsOptional()
    fontSize?: 'small' | 'medium' | 'large';
}