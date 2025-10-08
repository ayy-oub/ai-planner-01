// src/modules/section/dto/create-section.dto.ts
import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSectionDto {
    @ApiProperty({
        description: 'Title of the section',
        example: 'To Do',
        required: true,
        minLength: 1,
        maxLength: 100
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Description of the section',
        example: 'Tasks that need to be completed',
        required: false,
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Type of section',
        example: 'tasks',
        enum: ['tasks', 'notes', 'goals', 'habits', 'milestones'],
        required: true
    })
    @IsIn(['tasks', 'notes', 'goals', 'habits', 'milestones'])
    type: string;

    @ApiProperty({
        description: 'Display order of the section',
        example: 1,
        required: false,
        minimum: 0
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number;

    @ApiProperty({
        description: 'Section settings',
        required: false,
        type: 'object'
    })
    @IsOptional()
    settings?: {
        collapsed?: boolean;
        color?: string;
        icon?: string;
        visibility?: 'visible' | 'hidden' | 'collapsed';
        maxActivities?: number;
        autoArchiveCompleted?: boolean;
        defaultActivityType?: string;
    };
}