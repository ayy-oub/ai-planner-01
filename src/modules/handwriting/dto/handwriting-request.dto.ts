import { IsOptional, IsString, IsBoolean, IsNumber, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HandwritingRequestDto {
    @ApiProperty({
        description: 'Language code for handwriting recognition',
        example: 'en',
        required: false,
        enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
        default: 'en'
    })
    @IsOptional()
    @IsString()
    @IsIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'])
    language?: string = 'en';

    @ApiProperty({
        description: 'Enable automatic text correction',
        example: true,
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    autoCorrect?: boolean = true;

    @ApiProperty({
        description: 'Preserve original formatting',
        example: false,
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    preserveFormatting?: boolean = false;

    @ApiProperty({
        description: 'Extract table structures if present',
        example: false,
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    extractTables?: boolean = false;

    @ApiProperty({
        description: 'Minimum confidence threshold (0-1)',
        example: 0.7,
        required: false,
        minimum: 0,
        maximum: 1,
        default: 0.5
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    confidenceThreshold?: number = 0.5;
}