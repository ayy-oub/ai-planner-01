import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class PrivacySettingsDto {
    @ApiPropertyOptional({
        description: 'Profile visibility',
        enum: ['public', 'private', 'connections'],
        example: 'private',
    })
    @IsEnum(['public', 'private', 'connections'])
    @IsOptional()
    profileVisibility?: 'public' | 'private' | 'connections';

    @ApiPropertyOptional({
        description: 'Show email publicly',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    showEmail?: boolean;

    @ApiPropertyOptional({
        description: 'Show activity status',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    showActivity?: boolean;

    @ApiPropertyOptional({
        description: 'Allow search engine indexing',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    allowIndexing?: boolean;

    @ApiPropertyOptional({
        description: 'Enable data sharing',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    dataSharing?: boolean;

    @ApiPropertyOptional({
        description: 'Enable analytics',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    analytics?: boolean;
}

class DataSettingsDto {
    @ApiPropertyOptional({
        description: 'Enable auto backup',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    autoBackup?: boolean;

    @ApiPropertyOptional({
        description: 'Backup frequency',
        enum: ['daily', 'weekly', 'monthly'],
        example: 'weekly',
    })
    @IsEnum(['daily', 'weekly', 'monthly'])
    @IsOptional()
    backupFrequency?: 'daily' | 'weekly' | 'monthly';

    @ApiPropertyOptional({
        description: 'Default export format',
        enum: ['json', 'csv', 'pdf'],
        example: 'json',
    })
    @IsEnum(['json', 'csv', 'pdf'])
    @IsOptional()
    exportFormat?: 'json' | 'csv' | 'pdf';

    @ApiPropertyOptional({
        description: 'Data retention days',
        example: 365,
        minimum: 30,
        maximum: 3650,
    })
    @IsNumber()
    @Min(30)
    @Max(3650)
    @IsOptional()
    retentionDays?: number;

    @ApiPropertyOptional({
        description: 'Delete account after days of inactivity',
        example: 730,
        minimum: 90,
        maximum: 3650,
    })
    @IsNumber()
    @Min(90)
    @Max(3650)
    @IsOptional()
    deleteAfter?: number;
}

class CollaborationSettingsDto {
    @ApiPropertyOptional({
        description: 'Allow collaboration invites',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    allowInvites?: boolean;

    @ApiPropertyOptional({
        description: 'Require approval for collaboration',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    requireApproval?: boolean;

    @ApiPropertyOptional({
        description: 'Maximum collaborators per planner',
        example: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsNumber()
    @Min(1)
    @Max(100)
    @IsOptional()
    maxCollaborators?: number;

    @ApiPropertyOptional({
        description: 'Default collaborator role',
        enum: ['viewer', 'editor', 'admin'],
        example: 'viewer',
    })
    @IsEnum(['viewer', 'editor', 'admin'])
    @IsOptional()
    defaultRole?: 'viewer' | 'editor' | 'admin';
}

class IntegrationSettingsDto {
    @ApiPropertyOptional({
        description: 'Enable calendar sync',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    calendarSync?: boolean;

    @ApiPropertyOptional({
        description: 'Enable email sync',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    emailSync?: boolean;

    @ApiPropertyOptional({
        description: 'Webhook URL',
        example: 'https://example.com/webhook',
    })
    @IsString()
    @IsOptional()
    webhookUrl?: string;

    @ApiPropertyOptional({
        description: 'Enable API access',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    apiAccess?: boolean;

    @ApiPropertyOptional({
        description: 'API rate limit per minute',
        example: 100,
        minimum: 10,
        maximum: 10000,
    })
    @IsNumber()
    @Min(10)
    @Max(10000)
    @IsOptional()
    rateLimit?: number;
}

export class UpdateSettingsDto {
    @ApiPropertyOptional({
        description: 'Privacy settings',
        type: PrivacySettingsDto,
    })
    @ValidateNested()
    @Type(() => PrivacySettingsDto)
    @IsOptional()
    privacy?: PrivacySettingsDto;

    @ApiPropertyOptional({
        description: 'Data settings',
        type: DataSettingsDto,
    })
    @ValidateNested()
    @Type(() => DataSettingsDto)
    @IsOptional()
    data?: DataSettingsDto;

    @ApiPropertyOptional({
        description: 'Collaboration settings',
        type: CollaborationSettingsDto,
    })
    @ValidateNested()
    @Type(() => CollaborationSettingsDto)
    @IsOptional()
    collaboration?: CollaborationSettingsDto;

    @ApiPropertyOptional({
        description: 'Integration settings',
        type: IntegrationSettingsDto,
    })
    @ValidateNested()
    @Type(() => IntegrationSettingsDto)
    @IsOptional()
    integrations?: IntegrationSettingsDto;
}