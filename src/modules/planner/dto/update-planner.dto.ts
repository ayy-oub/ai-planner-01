// src/modules/planner/dto/update-planner.dto.ts
import { IsString, IsOptional, IsBoolean, IsArray, IsObject, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePlannerDto {
    @ApiProperty({
        description: 'Title of the planner',
        example: 'Updated Project Planner',
        required: false,
        minLength: 1,
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({
        description: 'Description of the planner',
        example: 'Updated description for my project planner',
        required: false,
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Color theme for the planner (hex color code)',
        example: '#EF4444',
        required: false,
        pattern: '^#[0-9A-F]{6}$'
    })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({
        description: 'Icon identifier for the planner',
        example: 'updated-icon',
        required: false,
        maxLength: 50
    })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiProperty({
        description: 'Planner settings',
        required: false,
        type: 'object'
    })
    @IsOptional()
    @IsObject()
    settings?: {
        isPublic?: boolean;
        allowCollaboration?: boolean;
        autoArchive?: boolean;
        reminderEnabled?: boolean;
        defaultView?: 'grid' | 'list' | 'calendar';
        theme?: 'light' | 'dark' | 'auto';
    };

    @ApiProperty({
        description: 'Tags for categorizing the planner',
        required: false,
        type: [String],
        example: ['updated', 'priority']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}