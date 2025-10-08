import { IsString, IsObject, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AIContextDto {
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

    @ApiProperty({
        description: 'User ID',
        example: 'user_789ghi',
    })
    @IsString()
    userId: string;
}

class AIEntityDto {
    @ApiProperty({
        description: 'Entity type',
        example: 'task',
    })
    @IsString()
    type: string;

    @ApiProperty({
        description: 'Entity value',
        example: 'Complete project report',
    })
    @IsString()
    value: string;

    @ApiProperty({
        description: 'Confidence score',
        example: 0.92,
    })
    confidence: number;
}

export class AINaturalLanguageQueryDto {
    @ApiProperty({
        description: 'Natural language query',
        example: 'Create 3 high priority tasks for my project due next week',
    })
    @IsString()
    query: string;

    @ApiPropertyOptional({
        description: 'Context for the query',
        type: AIContextDto,
    })
    @IsObject()
    @IsOptional()
    @Type(() => AIContextDto)
    context?: AIContextDto;

    @ApiProperty({
        description: 'Intent of the query',
        enum: ['create', 'update', 'delete', 'query', 'analyze', 'optimize'],
        example: 'create',
    })
    @IsEnum(['create', 'update', 'delete', 'query', 'analyze', 'optimize'])
    intent: 'create' | 'update' | 'delete' | 'query' | 'analyze' | 'optimize';

    @ApiPropertyOptional({
        description: 'Extracted entities from the query',
        type: [AIEntityDto],
    })
    @IsArray()
    @IsOptional()
    entities?: AIEntityDto[];
}