import { ApiProperty } from '@nestjs/swagger';

export class UserExportRequestDto {
    @ApiProperty({
        description: 'Include user profile data',
        example: true,
    })
    includeProfile: boolean;

    @ApiProperty({
        description: 'Include user preferences',
        example: true,
    })
    includePreferences: boolean;

    @ApiProperty({
        description: 'Include user settings',
        example: true,
    })
    includeSettings: boolean;

    @ApiProperty({
        description: 'Include user activity history',
        example: true,
    })
    includeActivity: boolean;

    @ApiProperty({
        description: 'Include user planners',
        example: true,
    })
    includePlanners: boolean;

    @ApiProperty({
        description: 'Include user activities',
        example: true,
    })
    includeActivities: boolean;

    @ApiProperty({
        description: 'Include user statistics',
        example: true,
    })
    includeStatistics: boolean;

    @ApiProperty({
        description: 'Include user notifications',
        example: false,
    })
    includeNotifications: boolean;

    @ApiProperty({
        description: 'Include user sessions',
        example: false,
    })
    includeSessions: boolean;

    @ApiProperty({
        description: 'Date range for activity export',
        type: Object,
        example: {
            start: '2024-01-01',
            end: '2024-12-31'
        }
    })
    dateRange?: {
        start: string;
        end: string;
    };

    @ApiProperty({
        description: 'Export format',
        enum: ['json', 'csv', 'pdf'],
        example: 'json',
    })
    format: 'json' | 'csv' | 'pdf';
}

export class UserImportRequestDto {
    @ApiProperty({
        description: 'User profile data to import',
        type: Object,
    })
    profile?: any;

    @ApiProperty({
        description: 'User preferences to import',
        type: Object,
    })
    preferences?: any;

    @ApiProperty({
        description: 'User settings to import',
        type: Object,
    })
    settings?: any;

    @ApiProperty({
        description: 'User planners to import',
        type: [Object],
    })
    planners?: any[];

    @ApiProperty({
        description: 'User activities to import',
        type: [Object],
    })
    activities?: any[];

    @ApiProperty({
        description: 'Import mode',
        enum: ['merge', 'replace'],
        example: 'merge',
    })
    mode: 'merge' | 'replace';

    @ApiProperty({
        description: 'Validate data before importing',
        example: true,
    })
    validate: boolean;

    @ApiProperty({
        description: 'Skip duplicates',
        example: true,
    })
    skipDuplicates: boolean;
}

export class UserExportResponseDto {
    @ApiProperty({
        description: 'Export ID',
        example: 'export_123abc',
    })
    exportId: string;

    @ApiProperty({
        description: 'Download URL',
        example: 'https://storage.example.com/exports/user_123abc_20240115.json',
    })
    downloadUrl: string;

    @ApiProperty({
        description: 'Export file size in bytes',
        example: 1048576,
    })
    fileSize: number;

    @ApiProperty({
        description: 'Export created date',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: string;

    @ApiProperty({
        description: 'Export expires date',
        example: '2024-01-22T10:30:00Z',
    })
    expiresAt: string;

    @ApiProperty({
        description: 'Exported data summary',
        type: Object,
        example: {
            profile: true,
            preferences: true,
            settings: true,
            planners: 25,
            activities: 150,
            activityHistory: 1000
        }
    })
    summary: any;
}