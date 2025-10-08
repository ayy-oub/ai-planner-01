// src/modules/planner/dto/create-planner.dto.ts
import { IsString, IsOptional, IsBoolean, IsArray, IsObject, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlannerDto {
    @ApiProperty({
        description: 'Title of the planner',
        example: 'My Project Planner',
        required: true,
        minLength: 1,
        maxLength: 100
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Description of the planner',
        example: 'A comprehensive planner for managing my project',
        required: false,
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Color theme for the planner (hex color code)',
        example: '#3B82F6',
        required: false,
        pattern: '^#[0-9A-F]{6}$'
    })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({
        description: 'Icon identifier for the planner',
        example: 'project',
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
        example: ['project', 'work', 'important']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiProperty({
        description: 'Initial sections to create',
        required: false,
        type: [Object]
    })
    @IsOptional()
    @IsArray()
    sections?: Array<{
        title: string;
        description?: string;
        type: 'tasks' | 'notes' | 'goals' | 'habits';
        order?: number;
    }>;
}