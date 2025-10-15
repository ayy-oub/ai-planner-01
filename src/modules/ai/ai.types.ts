// src/modules/ai/ai.types.ts
// NOTE: use `Date` for timestamps in domain-level types (repos convert Firestore Timestamps <-> Date).
// Be aware: your planner types also declare an `AISuggestion` interface. Consider centralizing or renaming
// to avoid import collisions.

export type AISuggestionType = 'time_estimate' | 'task' | 'priority' | 'category' | 'schedule' | 'breakdown' | 'optimize';


export interface AISuggestion {
    id: string;
    type: AISuggestionType;
    suggestion: string;
    confidence: number;
    reasoning: string;
    metadata?: Record<string, any>;
    accepted?: boolean;
    rejected?: boolean;
    createdAt: Date;
}

export interface AIInsight {
    id: string;
    type: 'productivity' | 'efficiency' | 'patterns' | 'recommendations';
    title: string;
    description: string;
    data: {
        metrics: Record<string, number>;
        trends: Array<{
            period: string;
            value: number;
            change: number;
        }>;
        comparisons?: Record<string, any>;
    };
    actionableItems: Array<{
        priority: 'high' | 'medium' | 'low';
        action: string;
        expectedImpact: string;
        estimatedTime?: number;
    }>;
    generatedAt: Date;
    expiresAt: Date;
}

export interface AIScheduleOptimization {
    id: string;
    originalSchedule: Array<{
        activityId: string;
        startTime: string;
        endTime: string;
        priority: string;
    }>;
    optimizedSchedule: Array<{
        activityId: string;
        startTime: string;
        endTime: string;
        priority: string;
        reason: string;
    }>;
    improvements: {
        timeSaved: number; // minutes
        efficiencyGain: number; // percentage
        conflictReduction: number; // percentage
    };
    constraints: Array<{
        type: 'time' | 'dependency' | 'priority' | 'resource';
        description: string;
    }>;
    createdAt: Date;
}

export type AIRequestKind =
    | 'suggestion'
    | 'optimization'
    | 'analysis'
    | 'insights'
    | 'natural-language'
    | 'chat'
    | 'generate-description'
    | 'predict-duration';

export interface AIRequest {
    userId: string;
    plannerId?: string;
    sectionId?: string;
    activityIds?: string[];
    type: AIRequestKind;
    context: {
        goal?: string;
        constraints?: string[];
        preferences?: Record<string, any>;
        timeframe?: {
            start: string;
            end: string;
        };
        historicalData?: boolean;
    };
    metadata?: Record<string, any>;
}

export interface AIRequestLog extends AIRequest {
    requestId: string;
    timestamp: Date;
    requestData?: any;
    responseData?: any;
    metadata?: Record<string, any>;
    requestType: AIRequestKind;
}

export interface AIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    metadata?: {
        requestId: string;
        processingTime: number;
        modelVersion: string;
        confidence?: number;
    };
}

export interface AIPlannerSuggestion {
    type: 'optimize_schedule' | 'suggest_tasks' | 'categorize' | 'prioritize';
    suggestions: AISuggestionDetail[];
    confidence: number;
    reasoning: string;
}

export interface AISuggestionDetail {
    id: string;
    title: string;
    description: string;
    action: 'add' | 'modify' | 'delete' | 'reorder';
    targetId?: string;
    targetType: 'section' | 'activity';
    metadata?: any;
}

export interface AITaskSuggestion extends AISuggestion {
    type: 'task';
    task: {
        title: string;
        description: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        estimatedDuration: number; // minutes
        dueDate?: string;
        tags: string[];
        dependencies?: string[];
    };
}

export interface AIAnalysisResult {
    id: string;
    type: 'productivity' | 'efficiency' | 'patterns';
    period: {
        start: string;
        end: string;
    };
    metrics: {
        completionRate: number;
        averageTaskDuration: number;
        peakProductivityHours: number[]; // e.g. [9, 14, 20]
        commonDelays: Array<{
            reason: string;
            frequency: number;
            averageDelay: number;
        }>;
        efficiencyScore: number; // 0-100
    };
    insights: Array<{
        type: 'strength' | 'weakness' | 'opportunity' | 'threat';
        title: string;
        description: string;
        impact: 'high' | 'medium' | 'low';
    }>;
    recommendations: Array<{
        category: 'workflow' | 'time-management' | 'prioritization' | 'collaboration';
        title: string;
        description: string;
        implementation: string;
        expectedOutcome: string;
        difficulty: 'easy' | 'medium' | 'hard';
    }>;
    generatedAt: Date;
}

export interface AINaturalLanguageQuery {
    query: string;
    context?: {
        plannerId?: string;
        sectionId?: string;
        userId: string;
    };
    intent: 'create' | 'update' | 'delete' | 'query' | 'analyze' | 'optimize';
    entities?: Array<{
        type: 'task' | 'date' | 'time' | 'priority' | 'tag';
        value: string;
        confidence: number;
    }>;
}

export interface AINaturalLanguageResponse {
    success: boolean;
    action: {
        type: 'created' | 'updated' | 'deleted' | 'queried' | 'analyzed' | 'optimized';
        description: string;
        affectedItems: string[];
    };
    result: any;
    followUpQuestions?: string[];
}

// AI Model Configuration
export interface AIModelConfig {
    model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude' | 'custom';
    maxTokens: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    timeout: number;
}

// Rate limiting for AI requests
export interface AIRequestLimit {
    userId: string;
    requestType: string;
    count: number;
    windowStart: Date;
    windowDuration: number; // minutes
    maxRequests: number;
}
