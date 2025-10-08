import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SearchUsersDto {
    @ApiPropertyOptional({
        description: 'Search query (searches in name, email, etc.)',
        example: 'john',
    })
    @IsString()
    @IsOptional()
    query?: string;

    @ApiPropertyOptional({
        description: 'Filter by user status',
        enum: ['active', 'inactive', 'suspended'],
        isArray: true,
        example: ['active'],
    })
    @IsArray()
    @IsEnum(['active', 'inactive', 'suspended'], { each: true })
    @IsOptional()
    status?: ('active' | 'inactive' | 'suspended')[];

    @ApiPropertyOptional({
        description: 'Filter by subscription plan',
        enum: ['free', 'premium', 'enterprise'],
        isArray: true,
        example: ['premium', 'enterprise'],
    })
    @IsArray()
    @IsEnum(['free', 'premium', 'enterprise'], { each: true })
    @IsOptional()
    subscriptionPlan?: ('free' | 'premium' | 'enterprise')[];

    @ApiPropertyOptional({
        description: 'Filter by user roles',
        isArray: true,
        example: ['admin', 'user'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    roles?: string[];

    @ApiPropertyOptional({
        description: 'Filter by creation date (after)',
        example: '2024-01-01',
    })
    @IsDateString()
    @IsOptional()
    createdAfter?: string;

    @ApiPropertyOptional({
        description: 'Filter by creation date (before)',
        example: '2024-12-31',
    })
    @IsDateString()
    @IsOptional()
    createdBefore?: string;

    @ApiPropertyOptional({
        description: 'Filter by last activity date (after)',
        example: '2024-01-01',
    })
    @IsDateString()
    @IsOptional()
    lastActiveAfter?: string;

    @ApiPropertyOptional({
        description: 'Filter by last activity date (before)',
        example: '2024-12-31',
    })
    @IsDateString()
    @IsOptional()
    lastActiveBefore?: string;

    @ApiPropertyOptional({
        description: 'Filter by email verification status',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    hasVerifiedEmail?: boolean;

    @ApiPropertyOptional({
        description: 'Filter by two-factor authentication status',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    twoFactorEnabled?: boolean;

    @ApiPropertyOptional({
        description: 'Filter by minimum login count',
        example: 5,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    minLoginCount?: number;

    @ApiPropertyOptional({
        description: 'Filter by maximum login count',
        example: 100,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    maxLoginCount?: number;

    @ApiPropertyOptional({
        description: 'Sort by field',
        enum: ['createdAt', 'lastActivity', 'loginCount', 'subscriptionPlan', 'displayName', 'email'],
        example: 'createdAt',
    })
    @IsEnum(['createdAt', 'lastActivity', 'loginCount', 'subscriptionPlan', 'displayName', 'email'])
    @IsOptional()
    sortBy?: string;

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        example: 'desc',
    })
    @IsEnum(['asc', 'desc'])
    @IsOptional()
    sortOrder?: 'asc' | 'desc';

    @ApiPropertyOptional({
        description: 'Number of results to return',
        example: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsNumber()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Number of results to skip',
        example: 0,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    offset?: number = 0;

    @ApiPropertyOptional({
        description: 'Include deleted users',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    includeDeleted?: boolean;

    @ApiPropertyOptional({
        description: 'Include user statistics',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    includeStats?: boolean;

    @ApiPropertyOptional({
        description: 'Include subscription details',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    includeSubscription?: boolean;
}