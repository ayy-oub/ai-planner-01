import { ApiProperty } from '@nestjs/swagger';

export class HandwritingResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true
    })
    success: boolean;

    @ApiProperty({
        description: 'Handwriting recognition result data',
        type: 'object'
    })
    data: {
        text: string;
        confidence: number;
        processingTime: number;
        language: string;
        segments: Array<{
            text: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }>;
        metadata: {
            originalFileName: string;
            fileSize: number;
            mimeType: string;
            processedAt: Date;
            userId: string;
        };
    };
}