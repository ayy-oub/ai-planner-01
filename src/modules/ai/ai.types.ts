import { Timestamp } from 'firebase-admin/firestore';

export interface AISuggestion {
    id: string;
    type: 'task' | 'schedule' | 'priority' | 'category';
    suggestion: string;
    confidence: number;
    reasoning: string;
    metadata?: Record<string, any>;
    accepted?: boolean;
    rejected?: boolean;
    createdAt: Timestamp;
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
    generatedAt: Timestamp;
    expiresAt: Timestamp;
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
    createdAt: Timestamp;
}

export interface AIRequest {
    userId: string;
    plannerId?: string;
    sectionId?: string;
    activityIds?: string[];
    type: 'suggestion' | 'optimization' | 'analysis' | 'insights';
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
        peakProductivityHours: number[];
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
    generatedAt: Timestamp;
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
    windowStart: Timestamp;
    windowDuration: number; // minutes
    maxRequests: number;
}