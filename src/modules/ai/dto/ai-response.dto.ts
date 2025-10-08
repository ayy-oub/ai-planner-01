import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsArray, IsOptional } from 'class-validator';

class AIErrorDto {
    @ApiProperty({
        description: 'Error code',
        example: 'RATE_LIMIT_EXCEEDED',
    })
    code: string;

    @ApiProperty({
        description: 'Error message',
        example: 'Rate limit exceeded for this request type',
    })
    message: string;

    @ApiPropertyOptional({
        description: 'Additional error details',
        example: { limit: 50, window: 3600, current: 55 },
        type: Object,
    })
    details?: any;
}

class AIMetadataDto {
    @ApiProperty({
        description: 'Unique request ID',
        example: 'req_123abc456def',
    })
    requestId: string;

    @ApiProperty({
        description: 'Processing time in milliseconds',
        example: 1250,
    })
    processingTime: number;

    @ApiProperty({
        description: 'AI model version used',
        example: 'gpt-4',
    })
    modelVersion: string;

    @ApiPropertyOptional({
        description: 'Average confidence score',
        example: 0.85,
    })
    confidence?: number;
}

class AITaskSuggestionDto {
    @ApiProperty({
        description: 'Suggestion ID',
        example: 'suggestion_123abc',
    })
    id: string;

    @ApiProperty({
        description: 'Type of suggestion',
        example: 'task',
    })
    type: string;

    @ApiProperty({
        description: 'Suggestion text',
        example: 'Break down "Project Planning" into smaller subtasks',
    })
    suggestion: string;

    @ApiProperty({
        description: 'Confidence score',
        example: 0.85,
    })
    confidence: number;

    @ApiProperty({
        description: 'Reasoning behind the suggestion',
        example: 'Large tasks are more likely to be completed when broken down',
    })
    reasoning: string;

    @ApiPropertyOptional({
        description: 'Additional metadata',
        type: Object,
    })
    metadata?: Record<string, any>;

    @ApiPropertyOptional({
        description: 'Whether the suggestion was accepted',
        example: true,
    })
    accepted?: boolean;

    @ApiProperty({
        description: 'Task details',
        type: Object,
        example: {
            title: 'Subtask: Project Planning - Part 1',
            description: 'First part of Project Planning',
            priority: 'medium',
            estimatedDuration: 60,
            dueDate: '2024-01-15',
            tags: ['subtask', 'planning'],
            dependencies: ['task_123abc'],
        },
    })
    task: {
        title: string;
        description: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        estimatedDuration: number;
        dueDate?: string;
        tags: string[];
        dependencies?: string[];
    };

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    createdAt: any;
}

export class AISuggestionResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Array of task suggestions',
        type: [AITaskSuggestionDto],
    })
    data: AITaskSuggestionDto[];

    @ApiProperty({
        description: 'Response metadata',
        type: AIMetadataDto,
    })
    metadata: AIMetadataDto;
}

// Schedule Optimization Response
class AIScheduleOptimizationDto {
    @ApiProperty({
        description: 'Optimization ID',
        example: 'optimization_456def',
    })
    id: string;

    @ApiProperty({
        description: 'Original schedule',
        type: Array,
    })
    originalSchedule: Array<any>;

    @ApiProperty({
        description: 'Optimized schedule',
        type: Array,
    })
    optimizedSchedule: Array<any>;

    @ApiProperty({
        description: 'Improvement metrics',
        type: Object,
        example: {
            timeSaved: 120,
            efficiencyGain: 25,
            conflictReduction: 80,
        },
    })
    improvements: {
        timeSaved: number;
        efficiencyGain: number;
        conflictReduction: number;
    };

    @ApiProperty({
        description: 'Constraints considered',
        type: Array,
    })
    constraints: Array<any>;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    createdAt: any;
}

export class AIScheduleOptimizationResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Schedule optimization result',
        type: AIScheduleOptimizationDto,
    })
    data: AIScheduleOptimizationDto;

    @ApiProperty({
        description: 'Response metadata',
        type: AIMetadataDto,
    })
    metadata: AIMetadataDto;
}

// Analysis Response
class AIAnalysisResultDto {
    @ApiProperty({
        description: 'Analysis ID',
        example: 'analysis_789ghi',
    })
    id: string;

    @ApiProperty({
        description: 'Type of analysis',
        example: 'productivity',
    })
    type: string;

    @ApiProperty({
        description: 'Analysis period',
        type: Object,
        example: {
            start: '2024-01-01',
            end: '2024-01-31',
        },
    })
    period: {
        start: string;
        end: string;
    };

    @ApiProperty({
        description: 'Analysis metrics',
        type: Object,
        example: {
            completionRate: 0.75,
            averageTaskDuration: 45,
            peakProductivityHours: [9, 10, 14, 15],
            efficiencyScore: 82,
        },
    })
    metrics: any;

    @ApiProperty({
        description: 'Insights discovered',
        type: Array,
    })
    insights: Array<any>;

    @ApiProperty({
        description: 'Recommendations',
        type: Array,
    })
    recommendations: Array<any>;

    @ApiProperty({
        description: 'Generation timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    generatedAt: any;
}

export class AIAnalysisResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Analysis result',
        type: AIAnalysisResultDto,
    })
    data: AIAnalysisResultDto;

    @ApiProperty({
        description: 'Response metadata',
        type: AIMetadataDto,
    })
    metadata: AIMetadataDto;
}

// Insights Response
class AIInsightDto {
    @ApiProperty({
        description: 'Insight ID',
        example: 'insight_012jkl',
    })
    id: string;

    @ApiProperty({
        description: 'Type of insight',
        example: 'productivity',
    })
    type: string;

    @ApiProperty({
        description: 'Insight title',
        example: 'Your productivity peaks at 10 AM',
    })
    title: string;

    @ApiProperty({
        description: 'Insight description',
        example: 'Based on your task completion patterns, you are most productive at 10 AM on weekdays',
    })
    description: string;

    @ApiProperty({
        description: 'Insight data',
        type: Object,
    })
    data: any;

    @ApiProperty({
        description: 'Actionable items',
        type: Array,
    })
    actionableItems: Array<any>;

    @ApiProperty({
        description: 'Generation timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    generatedAt: any;

    @ApiProperty({
        description: 'Expiration timestamp',
        example: '2024-01-17T10:30:00Z',
    })
    expiresAt: any;
}

export class AIInsightResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Array of insights',
        type: [AIInsightDto],
    })
    data: AIInsightDto[];

    @ApiPropertyOptional({
        description: 'Response metadata',
        type: AIMetadataDto,
    })
    metadata?: AIMetadataDto;
}

// Natural Language Response
class AINaturalLanguageResponseDataDto {
    @ApiProperty({
        description: 'Action performed',
        type: Object,
        example: {
            type: 'created',
            description: 'Created 3 new tasks',
            affectedItems: ['task_123', 'task_124', 'task_125'],
        },
    })
    action: {
        type: string;
        description: string;
        affectedItems: string[];
    };

    @ApiProperty({
        description: 'Query result',
        type: Object,
    })
    result: any;

    @ApiPropertyOptional({
        description: 'Follow-up questions',
        type: [String],
    })
    followUpQuestions?: string[];
}

export class AINaturalLanguageResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Natural language response data',
        type: AINaturalLanguageResponseDataDto,
    })
    data: AINaturalLanguageResponseDataDto;

    @ApiPropertyOptional({
        description: 'Response metadata',
        type: AIMetadataDto,
    })
    metadata?: AIMetadataDto;
}