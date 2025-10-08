import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    Param,
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
    ApiHeader,
} from '@nestjs/swagger';
import { AIService } from './ai.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AIRequestDto } from './dto/ai-request.dto';
import { AINaturalLanguageQueryDto } from './dto/ai-natural-language.dto';
import { AISuggestionResponseDto, AIInsightResponseDto, AIAnalysisResponseDto, AIScheduleOptimizationResponseDto, AINaturalLanguageResponseDto } from './dto/ai-response.dto';
import { AIRequest, AINaturalLanguageQuery } from './ai.types';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AuthGuard)
export class AIController {
    constructor(private readonly aiService: AIService) { }

    /**
     * Generate AI-powered task suggestions
     */
    @Post('suggest-tasks')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Generate AI task suggestions',
        description: 'Get AI-powered suggestions for tasks based on your planning patterns and context',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Task suggestions generated successfully',
        type: AISuggestionResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
    })
    @ApiHeader({
        name: 'x-api-key',
        description: 'API key for rate limiting',
        required: false,
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async suggestTasks(
        @Body() requestDto: AIRequestDto,
        @CurrentUser() user: any
    ): Promise<AISuggestionResponseDto> {
        const request: AIRequest = {
            ...requestDto,
            userId: user.uid,
            type: 'suggestion',
        };

        const result = await this.aiService.suggestTasks(request);
        return {
            success: result.success,
            data: result.data,
            metadata: result.metadata,
        };
    }

    /**
     * Optimize schedule using AI
     */
    @Post('optimize-schedule')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Optimize schedule with AI',
        description: 'Get an AI-optimized version of your schedule based on priorities, constraints, and historical patterns',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Schedule optimized successfully',
        type: AIScheduleOptimizationResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async optimizeSchedule(
        @Body() requestDto: AIRequestDto,
        @CurrentUser() user: any
    ): Promise<AIScheduleOptimizationResponseDto> {
        const request: AIRequest = {
            ...requestDto,
            userId: user.uid,
            type: 'optimization',
        };

        const result = await this.aiService.optimizeSchedule(request);
        return {
            success: result.success,
            data: result.data,
            metadata: result.metadata,
        };
    }

    /**
     * Analyze productivity patterns
     */
    @Post('analyze-productivity')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Analyze productivity patterns',
        description: 'Get detailed analysis of your productivity patterns, efficiency metrics, and improvement recommendations',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Productivity analysis completed successfully',
        type: AIAnalysisResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async analyzeProductivity(
        @Body() requestDto: AIRequestDto,
        @CurrentUser() user: any
    ): Promise<AIAnalysisResponseDto> {
        const request: AIRequest = {
            ...requestDto,
            userId: user.uid,
            type: 'analysis',
        };

        const result = await this.aiService.analyzeProductivity(request);
        return {
            success: result.success,
            data: result.data,
            metadata: result.metadata,
        };
    }

    /**
     * Get AI insights
     */
    @Get('insights')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get AI insights',
        description: 'Retrieve personalized AI insights about your planning and productivity patterns',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Insights retrieved successfully',
        type: AIInsightResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
    })
    @ApiQuery({
        name: 'type',
        description: 'Type of insights to retrieve',
        required: false,
        enum: ['productivity', 'efficiency', 'patterns', 'recommendations'],
    })
    async getInsights(
        @Query('type') type?: string,
        @CurrentUser() user: any
    ): Promise<AIInsightResponseDto> {
        const result = await this.aiService.getInsights(user.uid, type);
        return {
            success: result.success,
            data: result.data,
            metadata: result.metadata,
        };
    }

    /**
     * Process natural language queries
     */
    @Post('natural-language')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process natural language queries',
        description: 'Process natural language queries to perform actions, get information, or receive recommendations',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Query processed successfully',
        type: AINaturalLanguageResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async processNaturalLanguage(
        @Body() queryDto: AINaturalLanguageQueryDto,
        @CurrentUser() user: any
    ): Promise<AINaturalLanguageResponseDto> {
        const query: AINaturalLanguageQuery = {
            ...queryDto,
            context: {
                ...queryDto.context,
                userId: user.uid,
            },
        };

        const result = await this.aiService.processNaturalLanguage(query);
        return {
            success: result.success,
            data: result.data,
            metadata: result.metadata,
        };
    }

    /**
     * Get AI request history
     */
    @Get('history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get AI request history',
        description: 'Retrieve your history of AI requests and interactions',
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
                    items: { type: 'object' },
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
    @ApiQuery({
        name: 'limit',
        description: 'Number of records to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of records to skip',
        required: false,
        type: Number,
    })
    async getRequestHistory(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const result = await this.aiService.getRequestHistory(user.uid, limit, offset);

        return {
            success: result.success,
            data: result.data,
            metadata: {
                total: result.data?.length || 0,
                limit,
                offset,
            },
        };
    }

    /**
     * Get AI usage statistics
     */
    @Get('usage-stats')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get AI usage statistics',
        description: 'Get your AI feature usage statistics for billing and analytics purposes',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Usage statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        totalRequests: { type: 'number' },
                        requestsByType: { type: 'object' },
                        remainingQuota: { type: 'number' },
                        usageTrend: { type: 'array' },
                    },
                },
            },
        },
    })
    @ApiQuery({
        name: 'period',
        description: 'Time period for statistics',
        required: false,
        enum: ['day', 'week', 'month'],
    })
    async getUsageStats(
        @Query('period') period: 'day' | 'week' | 'month' = 'week',
        @CurrentUser() user: any
    ): Promise<any> {
        const result = await this.aiService.getUsageStats(user.uid, period);
        return {
            success: result.success,
            data: result.data,
        };
    }
}