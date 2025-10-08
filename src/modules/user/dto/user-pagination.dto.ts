import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UserPaginationDto {
    @ApiPropertyOptional({
        description: 'Page number',
        example: 1,
        minimum: 1,
    })
    @IsNumber()
    @Min(1)
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
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
        description: 'Sort field',
        example: 'createdAt',
    })
    @IsOptional()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        example: 'desc',
    })
    @IsOptional()
    sortOrder?: 'asc' | 'desc' = 'desc';

    get offset(): number {
        return (this.page! - 1) * this.limit!;
    }
}