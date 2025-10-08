import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsString, IsOptional } from 'class-validator';

class ExportMetadataDto {
    @ApiProperty({
        description: 'Original export request',
        type: Object,
    })
    originalRequest: any;

    @ApiPropertyOptional({
        description: 'Processing time in milliseconds',
        example: 1250,
    })
    processingTime?: number;

    @ApiPropertyOptional({
        description: 'Number of items exported',
        example: 42,
    })
    itemsExported?: number;

    @ApiPropertyOptional({
        description: 'Warning messages',
        example: ['Some items were skipped due to permissions'],
        type: [String],
    })
    warnings?: string[];

    @ApiPropertyOptional({
        description: 'Error details if export failed',
        type: Object,
    })
    errorDetails?: any;
}

export class ExportResultDto {
    @ApiProperty({
        description: 'Export ID',
        example: 'export_123abc',
    })
    id: string;

    @ApiProperty({
        description: 'User ID',
        example: 'user_456def',
    })
    userId: string;

    @ApiProperty({
        description: 'Export status',
        enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
        example: 'completed',
    })
    status: string;

    @ApiProperty({
        description: 'Export format',
        enum: ['pdf', 'csv', 'excel', 'json', 'ical', 'markdown', 'html', 'txt'],
        example: 'pdf',
    })
    format: string;

    @ApiProperty({
        description: 'Export type',
        enum: ['planner', 'section', 'activity', 'report', 'summary'],
        example: 'planner',
    })
    type: string;

    @ApiPropertyOptional({
        description: 'File URL for download',
        example: 'https://storage.googleapis.com/bucket/exports/user/file.pdf',
    })
    fileUrl?: string;

    @ApiPropertyOptional({
        description: 'File size in bytes',
        example: 102456,
    })
    fileSize?: number;

    @ApiPropertyOptional({
        description: 'Error message if export failed',
        example: 'Failed to generate PDF',
    })
    error?: string;

    @ApiProperty({
        description: 'Export metadata',
        type: ExportMetadataDto,
    })
    metadata: ExportMetadataDto;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    createdAt: Date;

    @ApiPropertyOptional({
        description: 'Completion timestamp',
        example: '2024-01-10T10:32:00Z',
    })
    completedAt?: Date;

    @ApiPropertyOptional({
        description: 'Expiration timestamp',
        example: '2024-01-17T10:32:00Z',
    })
    expiresAt?: Date;
}

export class ExportResultResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Export result data',
        type: ExportResultDto,
    })
    data: ExportResultDto;

    @ApiPropertyOptional({
        description: 'Success message',
        example: 'Export created successfully',
    })
    message?: string;
}