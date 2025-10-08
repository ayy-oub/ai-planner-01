// src/modules/section/dto/section-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Section, SectionStatistics } from '../section.types';

export class SectionResponseDto {
    @ApiProperty({
        description: 'The section data',
        type: 'object'
    })
    section: Section;

    @ApiProperty({
        description: 'Statistics for the section',
        type: 'object'
    })
    statistics: SectionStatistics;

    @ApiProperty({
        description: 'Activity IDs in this section',
        type: [String]
    })
    activities: string[];
}

export class SectionListResponseDto {
    @ApiProperty({
        description: 'List of sections',
        type: [Object]
    })
    sections: Section[];

    @ApiProperty({
        description: 'Total number of sections',
        example: 5
    })
    total: number;

    @ApiProperty({
        description: 'ID of the parent planner',
        example: 'planner-123'
    })
    plannerId: string;
}