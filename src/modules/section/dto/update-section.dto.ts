// src/modules/section/dto/update-section.dto.ts
import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSectionDto {
    @ApiProperty({
        description: 'Title of the section',
        example: 'Updated Section Title',
        required: false,
        minLength: 1,
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({
        description: 'Description of the section',
        example: 'Updated section description',
        required: false,
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Display order of the section',
        example: 2,
        required: false
    })
    @IsOptional()
    order?: number;

    @ApiProperty({
        description: 'Section settings',
        required: false,
        type: 'object'
    })
    @IsOptional()
    @IsObject()
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