import { IsString, IsOptional, IsEnum, IsObject, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AIContextDto {
    @ApiPropertyOptional({
        description: 'Goal or objective for the AI request',
        example: 'Improve productivity and reduce task completion time',
    })
    @IsString()
    @IsOptional()
    goal?: string;

    @ApiPropertyOptional({
        description: 'Constraints for the AI to consider',
        example: ['Must be completed within work hours', 'No more than 3 high-priority tasks per day'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    constraints?: string[];

    @ApiPropertyOptional({
        description: 'User preferences for AI processing',
        example: { preferredWorkingHours: '9-5', breakDuration: 15 },
        type: Object,
    })
    @IsObject()
    @IsOptional()
    preferences?: Record<string, any>;

    @ApiPropertyOptional({
        description: 'Timeframe for the AI analysis',
        example: { start: '2024-01-01', end: '2024-01-31' },
        type: Object,
    })
    @IsObject()
    @IsOptional()
    timeframe?: {
        start: string;
        end: string;
    };

    @ApiPropertyOptional({
        description: 'Whether to include historical data in the analysis',
        example: true,
    })
    @IsOptional()
    historicalData?: boolean;
}

export class AIRequestDto {
    @ApiPropertyOptional({
        description: 'Planner ID for context',
        example: 'planner_123abc',
    })
    @IsString()
    @IsOptional()
    plannerId?: string;

    @ApiPropertyOptional({
        description: 'Section ID for context',
        example: 'section_456def',
    })
    @IsString()
    @IsOptional()
    sectionId?: string;

    @ApiPropertyOptional({
        description: 'Activity IDs for specific context',
        example: ['activity_789ghi', 'activity_012jkl'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    activityIds?: string[];

    @ApiProperty({
        description: 'Type of AI request',
        enum: ['suggestion', 'optimization', 'analysis', 'insights'],
        example: 'suggestion',
    })
    @IsEnum(['suggestion', 'optimization', 'analysis', 'insights'])
    type: 'suggestion' | 'optimization' | 'analysis' | 'insights';

    @ApiProperty({
        description: 'Context for the AI request',
        type: AIContextDto,
    })
    @ValidateNested()
    @Type(() => AIContextDto)
    context: AIContextDto;

    @ApiPropertyOptional({
        description: 'Additional metadata for the request',
        example: { source: 'web_app', version: '1.0.0' },
        type: Object,
    })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}