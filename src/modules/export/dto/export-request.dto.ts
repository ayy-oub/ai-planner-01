import { IsString, IsOptional, IsEnum, IsArray, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class DateRangeDto {
    @ApiProperty({
        description: 'Start date in ISO format',
        example: '2024-01-01',
    })
    @IsString()
    start: string;

    @ApiProperty({
        description: 'End date in ISO format',
        example: '2024-12-31',
    })
    @IsString()
    end: string;
}

class ExportFiltersDto {
    @ApiPropertyOptional({
        description: 'Filter by status',
        example: ['pending', 'in-progress'],
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    status?: string[];

    @ApiPropertyOptional({
        description: 'Filter by priority',
        example: ['high', 'urgent'],
        enum: ['low', 'medium', 'high', 'urgent'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    priority?: string[];

    @ApiPropertyOptional({
        description: 'Filter by tags',
        example: ['work', 'urgent'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @ApiPropertyOptional({
        description: 'Include completed items',
        example: true,
    })
    @IsOptional()
    includeCompleted?: boolean;

    @ApiPropertyOptional({
        description: 'Include archived items',
        example: false,
    })
    @IsOptional()
    includeArchived?: boolean;
}

class ExportOptionsDto {
    @ApiPropertyOptional({
        description: 'Timezone for date formatting',
        example: 'America/New_York',
    })
    @IsString()
    @IsOptional()
    timezone?: string;

    @ApiPropertyOptional({
        description: 'Date format string',
        example: 'yyyy-MM-dd',
    })
    @IsString()
    @IsOptional()
    dateFormat?: string;

    @ApiPropertyOptional({
        description: 'Include metadata in export',
        example: true,
    })
    @IsOptional()
    includeMetadata?: boolean;

    @ApiPropertyOptional({
        description: 'Include attachments in export',
        example: false,
    })
    @IsOptional()
    includeAttachments?: boolean;

    @ApiPropertyOptional({
        description: 'Custom fields to include',
        example: ['estimatedDuration', 'actualDuration'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    customFields?: string[];

    @ApiPropertyOptional({
        description: 'Template to use',
        example: 'default',
    })
    @IsString()
    @IsOptional()
    template?: string;

    @ApiPropertyOptional({
        description: 'PDF specific options',
        type: Object,
        example: {
            orientation: 'portrait',
            pageSize: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        }
    })
    @IsObject()
    @IsOptional()
    pdfOptions?: any;

    @ApiPropertyOptional({
        description: 'CSV specific options',
        type: Object,
        example: {
            delimiter: ',',
            quote: '"',
            header: true
        }
    })
    @IsObject()
    @IsOptional()
    csvOptions?: any;

    @ApiPropertyOptional({
        description: 'Excel specific options',
        type: Object,
        example: {
            sheetName: 'Activities',
            includeCharts: false
        }
    })
    @IsObject()
    @IsOptional()
    excelOptions?: any;
}

export class ExportRequestDto {
    @ApiProperty({
        description: 'Type of export',
        enum: ['planner', 'section', 'activity', 'report', 'summary'],
        example: 'planner',
    })
    @IsEnum(['planner', 'section', 'activity', 'report', 'summary'])
    type: 'planner' | 'section' | 'activity' | 'report' | 'summary';

    @ApiProperty({
        description: 'Export format',
        enum: ['pdf', 'csv', 'excel', 'json', 'ical', 'markdown', 'html', 'txt'],
        example: 'pdf',
    })
    @IsEnum(['pdf', 'csv', 'excel', 'json', 'ical', 'markdown', 'html', 'txt'])
    format: 'pdf' | 'csv' | 'excel' | 'json' | 'ical' | 'markdown' | 'html' | 'txt';

    @ApiPropertyOptional({
        description: 'Planner ID to export',
        example: 'planner_123abc',
    })
    @IsString()
    @IsOptional()
    plannerId?: string;

    @ApiPropertyOptional({
        description: 'Section IDs to export',
        example: ['section_456def', 'section_789ghi'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    sectionIds?: string[];

    @ApiPropertyOptional({
        description: 'Activity IDs to export',
        example: ['activity_012jkl', 'activity_345mno'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    activityIds?: string[];

    @ApiPropertyOptional({
        description: 'Date range for export',
        type: DateRangeDto,
    })
    @ValidateNested()
    @Type(() => DateRangeDto)
    @IsOptional()
    dateRange?: DateRangeDto;

    @ApiPropertyOptional({
        description: 'Filters to apply to the export',
        type: ExportFiltersDto,
    })
    @ValidateNested()
    @Type(() => ExportFiltersDto)
    @IsOptional()
    filters?: ExportFiltersDto;

    @ApiPropertyOptional({
        description: 'Export options',
        type: ExportOptionsDto,
    })
    @ValidateNested()
    @Type(() => ExportOptionsDto)
    @IsOptional()
    options?: ExportOptionsDto;

    @ApiPropertyOptional({
        description: 'Additional metadata for the export',
        example: { source: 'web_app', version: '1.0.0' },
        type: Object,
    })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}