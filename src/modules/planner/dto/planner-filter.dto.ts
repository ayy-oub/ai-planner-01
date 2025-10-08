// src/modules/planner/dto/planner-filter.dto.ts
import { IsOptional, IsString, IsBoolean, IsArray, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class PlannerFilterDto {
    @ApiProperty({
        description: 'Search query for planner title or description',
        required: false,
        example: 'project'
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Filter by tags',
        required: false,
        type: [String],
        example: ['work', 'important']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiProperty({
        description: 'Filter by archived status',
        required: false,
        example: false
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isArchived?: boolean;

    @ApiProperty({
        description: 'Filter by public status',
        required: false,
        example: true
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isPublic?: boolean;

    @ApiProperty({
        description: 'Sort field',
        required: false,
        enum: ['createdAt', 'updatedAt', 'title', 'lastActivityAt'],
        example: 'updatedAt'
    })
    @IsOptional()
    @IsIn(['createdAt', 'updatedAt', 'title', 'lastActivityAt'])
    sortBy?: string;

    @ApiProperty({
        description: 'Sort order',
        required: false,
        enum: ['asc', 'desc'],
        example: 'desc'
    })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: string;

    @ApiProperty({
        description: 'Page number',
        required: false,
        minimum: 1,
        example: 1
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(({ value }) => parseInt(value))
    page?: number;

    @ApiProperty({
        description: 'Number of items per page',
        required: false,
        minimum: 1,
        maximum: 100,
        example: 20
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value))
    limit?: number;
}