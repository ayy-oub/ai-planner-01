// src/modules/planner/dto/planner-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Planner, PlannerStatistics, UserPermissions } from '../planner.types';

export class PlannerResponseDto {
    @ApiProperty({
        description: 'The planner data',
        type: 'object'
    })
    planner: Planner;

    @ApiProperty({
        description: 'Statistics for the planner',
        type: 'object'
    })
    statistics: PlannerStatistics;

    @ApiProperty({
        description: 'User permissions for this planner',
        type: 'object'
    })
    permissions: UserPermissions;
}

export class PlannerListResponseDto {
    @ApiProperty({
        description: 'List of planners',
        type: [Object]
    })
    planners: Planner[];

    @ApiProperty({
        description: 'Total number of planners',
        example: 25
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1
    })
    page: number;

    @ApiProperty({
        description: 'Number of items per page',
        example: 20
    })
    limit: number;

    @ApiProperty({
        description: 'Whether there are more pages',
        example: true
    })
    hasNext: boolean;

    @ApiProperty({
        description: 'Whether there are previous pages',
        example: false
    })
    hasPrev: boolean;
}