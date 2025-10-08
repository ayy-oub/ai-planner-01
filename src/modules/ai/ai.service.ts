import { Injectable, Logger } from '@nestjs/common';
import { AIRepository } from './ai.repository';
import { CacheService } from '../../shared/services/cache.service';
import { AISuggestion, AIInsight, AIScheduleOptimization, AIRequest, AIResponse, AITaskSuggestion, AIAnalysisResult, AINaturalLanguageQuery, AINaturalLanguageResponse, AIModelConfig } from './ai.types';
import { PlannerService } from '../planner/planner.service';
import { ActivityService } from '../activity/activity.service';
import { UserService } from '../user/user.service';
import { FirebaseService } from '../../shared/services/firebase.service';
import { EmailService } from '../../shared/services/email.service';
import { NotificationService } from '../../shared/services/notification.service';
import { BadRequestException, NotFoundException, TooManyRequestsException } from '../../shared/utils/errors';
import { validateInput } from '../../shared/utils/validators';
import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly aiModelConfig: AIModelConfig;
    private readonly rateLimitWindow = 60; // minutes
    private readonly maxRequestsPerWindow = {
        suggestion: 50,
        optimization: 20,
        analysis: 30,
        insights: 40,
        'natural-language': 100
    };

    constructor(
        private readonly aiRepository: AIRepository,
        private readonly cacheService: CacheService,
        private readonly plannerService: PlannerService,
        private readonly activityService: ActivityService,
        private readonly userService: UserService,
        private readonly firebaseService: FirebaseService,
        private readonly emailService: EmailService,
        private readonly notificationService: NotificationService
    ) {
        this.aiModelConfig = {
            model: 'gpt-4',
            maxTokens: 2000,
            temperature: 0.7,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            timeout: 30000
        };
    }

    /**
     * Generate AI-powered task suggestions
     */
    async suggestTasks(request: AIRequest): Promise<AIResponse<AITaskSuggestion[]>> {
        const startTime = Date.now();
        const requestId = uuidv4();

        try {
            // Rate limiting check
            await this.checkRateLimit(request.userId, 'suggestion');

            // Validate input
            await validateInput(request, 'aiRequest');

            // Get context data
            const contextData = await this.gatherContextData(request);

            // Check cache for similar requests
            const cacheKey = `ai:suggestions:${request.userId}:${JSON.stringify(request.context)}`;
            const cachedResult = await this.cacheService.get<AITaskSuggestion[]>(cacheKey);

            if (cachedResult) {
                return {
                    success: true,
                    data: cachedResult,
                    metadata: {
                        requestId,
                        processingTime: Date.now() - startTime,
                        modelVersion: this.aiModelConfig.model,
                        confidence: 0.85
                    }
                };
            }

            // Generate AI suggestions
            const suggestions = await this.generateTaskSuggestions(contextData, request);

            // Cache the result
            await this.cacheService.set(cacheKey, suggestions, 1800); // 30 minutes

            // Log the request
            await this.logAIRequest(request, suggestions, requestId);

            return {
                success: true,
                data: suggestions,
                metadata: {
                    requestId,
                    processingTime: Date.now() - startTime,
                    modelVersion: this.aiModelConfig.model,
                    confidence: this.calculateAverageConfidence(suggestions)
                }
            };
        } catch (error) {
            logger.error('Error generating task suggestions:', error);
            throw new BadRequestException('Failed to generate task suggestions', error.message);
        }
    }

    /**
     * Optimize schedule using AI
     */
    async optimizeSchedule(request: AIRequest): Promise<AIResponse<AIScheduleOptimization>> {
        const startTime = Date.now();
        const requestId = uuidv4();

        try {
            // Rate limiting check
            await this.checkRateLimit(request.userId, 'optimization');

            // Validate input
            await validateInput(request, 'aiRequest');

            // Get schedule data
            const scheduleData = await this.gatherScheduleData(request);

            // Generate optimized schedule
            const optimization = await this.generateScheduleOptimization(scheduleData, request);

            // Store optimization result
            await this.aiRepository.saveScheduleOptimization(optimization);

            return {
                success: true,
                data: optimization,
                metadata: {
                    requestId,
                    processingTime: Date.now() - startTime,
                    modelVersion: this.aiModelConfig.model,
                    confidence: 0.92
                }
            };
        } catch (error) {
            logger.error('Error optimizing schedule:', error);
            throw new BadRequestException('Failed to optimize schedule', error.message);
        }
    }

    /**
     * Analyze productivity patterns
     */
    async analyzeProductivity(request: AIRequest): Promise<AIResponse<AIAnalysisResult>> {
        const startTime = Date.now();
        const requestId = uuidv4();

        try {
            // Rate limiting check
            await this.checkRateLimit(request.userId, 'analysis');

            // Validate input
            await validateInput(request, 'aiRequest');

            // Get historical data
            const historicalData = await this.gatherHistoricalData(request);

            // Generate analysis
            const analysis = await this.generateProductivityAnalysis(historicalData, request);

            // Store analysis result
            await this.aiRepository.saveAnalysisResult(analysis);

            return {
                success: true,
                data: analysis,
                metadata: {
                    requestId,
                    processingTime: Date.now() - startTime,
                    modelVersion: this.aiModelConfig.model,
                    confidence: 0.88
                }
            };
        } catch (error) {
            logger.error('Error analyzing productivity:', error);
            throw new BadRequestException('Failed to analyze productivity', error.message);
        }
    }

    /**
     * Get AI insights
     */
    async getInsights(userId: string, type?: string): Promise<AIResponse<AIInsight[]>> {
        const startTime = Date.now();
        const requestId = uuidv4();

        try {
            // Rate limiting check
            await this.checkRateLimit(userId, 'insights');

            // Get cached insights
            const cacheKey = `ai:insights:${userId}:${type || 'all'}`;
            const cachedInsights = await this.cacheService.get<AIInsight[]>(cacheKey);

            if (cachedInsights) {
                return {
                    success: true,
                    data: cachedInsights,
                    metadata: {
                        requestId,
                        processingTime: Date.now() - startTime,
                        modelVersion: this.aiModelConfig.model
                    }
                };
            }

            // Generate insights
            const insights = await this.generateInsights(userId, type);

            // Cache the result
            await this.cacheService.set(cacheKey, insights, 3600); // 1 hour

            return {
                success: true,
                data: insights,
                metadata: {
                    requestId,
                    processingTime: Date.now() - startTime,
                    modelVersion: this.aiModelConfig.model
                }
            };
        } catch (error) {
            logger.error('Error generating insights:', error);
            throw new BadRequestException('Failed to generate insights', error.message);
        }
    }

    /**
     * Process natural language queries
     */
    async processNaturalLanguage(query: AINaturalLanguageQuery): Promise<AIResponse<AINaturalLanguageResponse>> {
        const startTime = Date.now();
        const requestId = uuidv4();

        try {
            // Rate limiting check
            await this.checkRateLimit(query.context.userId, 'natural-language');

            // Validate input
            await validateInput(query, 'aiNaturalLanguageQuery');

            // Process the query
            const result = await this.processNaturalLanguageQuery(query);

            return {
                success: true,
                data: result,
                metadata: {
                    requestId,
                    processingTime: Date.now() - startTime,
                    modelVersion: this.aiModelConfig.model
                }
            };
        } catch (error) {
            logger.error('Error processing natural language query:', error);
            throw new BadRequestException('Failed to process natural language query', error.message);
        }
    }

    /**
     * Get AI request history
     */
    async getRequestHistory(userId: string, limit?: number, offset?: number): Promise<AIResponse<any[]>> {
        try {
            const history = await this.aiRepository.getRequestHistory(userId, limit, offset);

            return {
                success: true,
                data: history
            };
        } catch (error) {
            logger.error('Error retrieving request history:', error);
            throw new BadRequestException('Failed to retrieve request history', error.message);
        }
    }

    /**
     * Get AI usage statistics
     */
    async getUsageStats(userId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<AIResponse<any>> {
        try {
            const stats = await this.aiRepository.getUsageStats(userId, period);

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            logger.error('Error retrieving usage stats:', error);
            throw new BadRequestException('Failed to retrieve usage statistics', error.message);
        }
    }

    /**
     * Private method to gather context data
     */
    private async gatherContextData(request: AIRequest): Promise<any> {
        const contextData: any = {
            user: null,
            planners: [],
            activities: [],
            historicalData: []
        };

        try {
            // Get user data
            contextData.user = await this.userService.getUserProfile(request.userId);

            // Get planner data if specified
            if (request.plannerId) {
                contextData.planners = [await this.plannerService.getPlanner(request.userId, request.plannerId)];
            } else {
                // Get all user planners
                contextData.planners = await this.plannerService.getUserPlanners(request.userId);
            }

            // Get activity data
            if (request.activityIds && request.activityIds.length > 0) {
                for (const activityId of request.activityIds) {
                    const activity = await this.activityService.getActivity(request.userId, activityId);
                    contextData.activities.push(activity);
                }
            } else if (request.sectionId) {
                // Get activities from section
                const activities = await this.activityService.getActivitiesBySection(request.userId, request.sectionId);
                contextData.activities = activities;
            }

            // Get historical data if requested
            if (request.context.historicalData) {
                contextData.historicalData = await this.aiRepository.getUserHistoricalData(request.userId, {
                    start: request.context.timeframe?.start,
                    end: request.context.timeframe?.end
                });
            }

            return contextData;
        } catch (error) {
            logger.error('Error gathering context data:', error);
            throw error;
        }
    }

    /**
     * Private method to generate task suggestions
     */
    private async generateTaskSuggestions(contextData: any, request: AIRequest): Promise<AITaskSuggestion[]> {
        // This is a simplified implementation
        // In a real scenario, you would integrate with an AI service like OpenAI, Claude, etc.

        const suggestions: AITaskSuggestion[] = [];

        try {
            // Analyze context and generate suggestions based on patterns
            const { planners, activities, historicalData } = contextData;

            // Generate suggestions based on existing patterns
            if (activities.length > 0) {
                // Suggest similar tasks based on completed tasks
                const completedTasks = activities.filter(a => a.status === 'completed');
                const pendingTasks = activities.filter(a => a.status === 'pending');

                // Suggest task breakdown for large tasks
                const largeTasks = pendingTasks.filter(a => a.metadata?.estimatedDuration > 120);
                largeTasks.forEach(task => {
                    suggestions.push({
                        id: uuidv4(),
                        type: 'task',
                        suggestion: `Break down "${task.title}" into smaller subtasks`,
                        confidence: 0.85,
                        reasoning: `Large tasks are more likely to be completed when broken down into manageable pieces`,
                        task: {
                            title: `Subtask: ${task.title} - Part 1`,
                            description: `First part of ${task.title}`,
                            priority: task.priority || 'medium',
                            estimatedDuration: Math.ceil(task.metadata?.estimatedDuration / 3),
                            dueDate: task.dueDate,
                            tags: [...(task.tags || []), 'subtask'],
                            dependencies: [task.id]
                        },
                        createdAt: Timestamp.now()
                    });
                });

                // Suggest time-based tasks
                const now = new Date();
                const eveningTasks = completedTasks.filter(t => {
                    const completedTime = new Date(t.completedAt?.toDate() || now);
                    return completedTime.getHours() >= 18 && completedTime.getHours() <= 22;
                });

                if (eveningTasks.length > 2) {
                    suggestions.push({
                        id: uuidv4(),
                        type: 'task',
                        suggestion: 'Schedule routine evening tasks',
                        confidence: 0.78,
                        reasoning: `Based on your pattern of completing ${eveningTasks.length} tasks in the evening`,
                        task: {
                            title: 'Evening routine review',
                            description: 'Review and plan tasks for the next day',
                            priority: 'low',
                            estimatedDuration: 15,
                            dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                            tags: ['routine', 'planning'],
                            dependencies: []
                        },
                        createdAt: Timestamp.now()
                    });
                }
            }

            // Suggest tasks based on historical patterns
            if (historicalData.length > 0) {
                const recurringPatterns = this.analyzeRecurringPatterns(historicalData);
                recurringPatterns.forEach(pattern => {
                    suggestions.push({
                        id: uuidv4(),
                        type: 'task',
                        suggestion: `Schedule recurring ${pattern.category} task`,
                        confidence: pattern.confidence,
                        reasoning: `You regularly complete ${pattern.category} tasks every ${pattern.frequency} days`,
                        task: {
                            title: `Recurring: ${pattern.suggestedTitle}`,
                            description: pattern.description,
                            priority: 'medium',
                            estimatedDuration: pattern.averageDuration,
                            dueDate: new Date(now.getTime() + pattern.frequency * 24 * 60 * 60 * 1000).toISOString(),
                            tags: [pattern.category, 'recurring'],
                            dependencies: []
                        },
                        createdAt: Timestamp.now()
                    });
                });
            }

            // Always suggest some generic productivity tasks
            if (suggestions.length < 3) {
                suggestions.push({
                    id: uuidv4(),
                    type: 'task',
                    suggestion: 'Review and prioritize your task list',
                    confidence: 0.92,
                    reasoning: 'Regular review improves task completion rates',
                    task: {
                        title: 'Weekly task review',
                        description: 'Review all pending tasks and update priorities',
                        priority: 'medium',
                        estimatedDuration: 30,
                        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        tags: ['review', 'planning'],
                        dependencies: []
                    },
                    createdAt: Timestamp.now()
                });
            }

            return suggestions;
        } catch (error) {
            logger.error('Error generating task suggestions:', error);
            throw error;
        }
    }

    /**
     * Private method to check rate limits
     */
    private async checkRateLimit(userId: string, requestType: string): Promise<void> {
        const windowStart = new Date(Date.now() - this.rateLimitWindow * 60 * 1000);
        const requestCount = await this.aiRepository.getRequestCount(userId, requestType, windowStart);

        const maxRequests = this.maxRequestsPerWindow[requestType] || 50;

        if (requestCount >= maxRequests) {
            throw new TooManyRequestsException(
                `Rate limit exceeded for ${requestType} requests. Maximum ${maxRequests} requests per ${this.rateLimitWindow} minutes.`
            );
        }
    }

    /**
     * Private method to calculate average confidence
     */
    private calculateAverageConfidence(suggestions: AISuggestion[]): number {
        if (suggestions.length === 0) return 0;
        const totalConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0);
        return totalConfidence / suggestions.length;
    }

    /**
     * Private method to log AI requests
     */
    private async logAIRequest(request: AIRequest, result: any, requestId: string): Promise<void> {
        try {
            await this.aiRepository.logAIRequest({
                requestId,
                userId: request.userId,
                requestType: request.type,
                requestData: request,
                responseData: result,
                timestamp: Timestamp.now(),
                metadata: {
                    model: this.aiModelConfig.model,
                    processingTime: Date.now()
                }
            });
        } catch (error) {
            logger.error('Error logging AI request:', error);
        }
    }

    /**
     * Additional private methods for schedule optimization, productivity analysis, etc.
     */
    private async gatherScheduleData(request: AIRequest): Promise<any> {
        // Implementation for gathering schedule data
        return {};
    }

    private async generateScheduleOptimization(scheduleData: any, request: AIRequest): Promise<AIScheduleOptimization> {
        // Implementation for schedule optimization
        return {} as AIScheduleOptimization;
    }

    private async gatherHistoricalData(request: AIRequest): Promise<any> {
        // Implementation for gathering historical data
        return {};
    }

    private async generateProductivityAnalysis(historicalData: any, request: AIRequest): Promise<AIAnalysisResult> {
        // Implementation for productivity analysis
        return {} as AIAnalysisResult;
    }

    private async generateInsights(userId: string, type?: string): Promise<AIInsight[]> {
        // Implementation for generating insights
        return [];
    }

    private async processNaturalLanguageQuery(query: AINaturalLanguageQuery): Promise<AINaturalLanguageResponse> {
        // Implementation for natural language processing
        return {} as AINaturalLanguageResponse;
    }

    private analyzeRecurringPatterns(historicalData: any[]): any[] {
        // Implementation for analyzing recurring patterns
        return [];
    }
}