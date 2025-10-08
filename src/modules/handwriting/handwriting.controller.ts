import {
    Controller,
    Post,
    Get,
    UploadedFile,
    UseInterceptors,
    Body,
    Query,
    UseGuards,
    ValidationPipe,
    UsePipes,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
    ApiBody,
    ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { HandwritingService } from './handwriting.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { HandwritingRequestDto } from './dto/handwriting-request.dto';
import { HandwritingResponseDto } from './dto/handwriting-response.dto';

@ApiTags('Handwriting')
@Controller('handwriting')
export class HandwritingController {
    constructor(private readonly handwritingService: HandwritingService) { }

    /**
     * Process handwriting recognition from uploaded file
     */
    @Post('process')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({
        summary: 'Process handwriting from uploaded file',
        description: 'Upload an image or PDF file to extract handwritten text using AI recognition',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image or PDF file containing handwriting',
                },
                language: {
                    type: 'string',
                    description: 'Language code for recognition',
                    example: 'en',
                    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
                },
                autoCorrect: {
                    type: 'boolean',
                    description: 'Enable automatic text correction',
                    example: true,
                },
                preserveFormatting: {
                    type: 'boolean',
                    description: 'Preserve original formatting',
                    example: false,
                },
                extractTables: {
                    type: 'boolean',
                    description: 'Extract table structures if present',
                    example: false,
                },
                confidenceThreshold: {
                    type: 'number',
                    description: 'Minimum confidence threshold (0-1)',
                    example: 0.7,
                    minimum: 0,
                    maximum: 1,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Handwriting processed successfully',
        type: HandwritingResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid file format or processing failed',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async processHandwriting(
        @UploadedFile() file: Express.Multer.File,
        @Body() options: HandwritingRequestDto,
        @CurrentUser() user: any
    ): Promise<HandwritingResponseDto> {
        if (!file) {
            throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
        }

        return this.handwritingService.processHandwriting(file, options, user.uid);
    }

    /**
     * Process handwriting from base64 data
     */
    @Post('process-base64')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process handwriting from base64 data',
        description: 'Process handwriting recognition from base64 encoded image data',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                imageData: {
                    type: 'string',
                    description: 'Base64 encoded image data (data:image/png;base64,...)',
                    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                },
                language: {
                    type: 'string',
                    description: 'Language code for recognition',
                    example: 'en',
                    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
                },
                autoCorrect: {
                    type: 'boolean',
                    description: 'Enable automatic text correction',
                    example: true,
                },
                preserveFormatting: {
                    type: 'boolean',
                    description: 'Preserve original formatting',
                    example: false,
                },
                extractTables: {
                    type: 'boolean',
                    description: 'Extract table structures if present',
                    example: false,
                },
                confidenceThreshold: {
                    type: 'number',
                    description: 'Minimum confidence threshold (0-1)',
                    example: 0.7,
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: ['imageData'],
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Handwriting processed successfully',
        type: HandwritingResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid base64 data or processing failed',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async processHandwritingBase64(
        @Body() body: { imageData: string } & HandwritingRequestDto,
        @CurrentUser() user: any
    ): Promise<HandwritingResponseDto> {
        const { imageData, ...options } = body;

        if (!imageData) {
            throw new HttpException('No image data provided', HttpStatus.BAD_REQUEST);
        }

        return this.handwritingService.processHandwritingFromBase64(imageData, options, user.uid);
    }

    /**
     * Get handwriting processing history
     */
    @Get('history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get handwriting processing history',
        description: 'Get user\'s handwriting processing history with pagination',
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of records to return',
        required: false,
        type: Number,
        example: 10,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of records to skip',
        required: false,
        type: Number,
        example: 0,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'History retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            text: { type: 'string' },
                            confidence: { type: 'number' },
                            processedAt: { type: 'string', format: 'date-time' },
                            fileName: { type: 'string' },
                        },
                    },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getProcessingHistory(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @CurrentUser() user: any
    ): Promise<any> {
        return this.handwritingService.getProcessingHistory(user.uid, limit, offset);
    }

    /**
     * Get supported languages
     */
    @Get('languages')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get supported languages',
        description: 'Get list of supported languages for handwriting recognition',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Languages retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            code: { type: 'string' },
                            name: { type: 'string' },
                            nativeName: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    async getSupportedLanguages(): Promise<any> {
        const languages = [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'es', name: 'Spanish', nativeName: 'Español' },
            { code: 'fr', name: 'French', nativeName: 'Français' },
            { code: 'de', name: 'German', nativeName: 'Deutsch' },
            { code: 'it', name: 'Italian', nativeName: 'Italiano' },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
            { code: 'ru', name: 'Russian', nativeName: 'Русский' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' },
            { code: 'ko', name: 'Korean', nativeName: '한국어' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' },
        ];

        return {
            success: true,
            data: languages,
        };
    }

    /**
     * Get processing statistics
     */
    @Get('stats')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get handwriting processing statistics',
        description: 'Get user statistics for handwriting processing',
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for statistics (ISO format)',
        required: false,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for statistics (ISO format)',
        required: false,
        example: '2024-01-31',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        totalProcessed: { type: 'number' },
                        averageConfidence: { type: 'number' },
                        averageProcessingTime: { type: 'number' },
                        languageDistribution: { type: 'object' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getProcessingStats(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @CurrentUser() user: any
    ): Promise<any> {
        // Mock statistics - in real implementation, query database
        const stats = {
            totalProcessed: 42,
            averageConfidence: 0.87,
            averageProcessingTime: 1523,
            languageDistribution: {
                en: 25,
                es: 8,
                fr: 5,
                de: 3,
                other: 1
            }
        };

        return {
            success: true,
            data: stats,
        };
    }
}