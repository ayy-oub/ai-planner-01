import { AiService } from '../../../../src/modules/ai/ai.service';
import { AiRepository } from '../../../../src/modules/ai/ai.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { mockActivityData } from '../../../utils/test-helpers';

jest.mock('../../../../src/modules/ai/ai.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('AiService', () => {
    let aiService: AiService;
    let aiRepository: jest.Mocked<AiRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        aiRepository = new AiRepository() as jest.Mocked<AiRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        aiService = new AiService(aiRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('suggestTasks', () => {
        const contextData = {
            currentTasks: ['Current task 1', 'Current task 2'],
            goals: ['Complete project', 'Learn new skill'],
            preferences: {
                workHours: 8,
                difficulty: 'medium'
            }
        };

        it('should successfully generate task suggestions', async () => {
            const mockSuggestions = [
                {
                    task: 'Review project documentation',
                    priority: 'high',
                    estimatedDuration: 60,
                    reasoning: 'Important for project completion'
                },
                {
                    task: 'Practice coding exercises',
                    priority: 'medium',
                    estimatedDuration: 45,
                    reasoning: 'Helps learn new skills'
                }
            ];

            aiRepository.generateTaskSuggestions.mockResolvedValue(mockSuggestions);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await aiService.suggestTasks(userId, contextData);

            expect(aiRepository.generateTaskSuggestions).toHaveBeenCalledWith({
                userId,
                context: contextData
            });
            expect(cacheService.set).toHaveBeenCalledWith(
                `ai:suggestions:${userId}`,
                JSON.stringify(mockSuggestions),
                3600
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith('ai.tasks.suggested', {
                userId,
                suggestions: mockSuggestions
            });
            expect(result).toEqual(mockSuggestions);
        });

        it('should return cached suggestions if available', async () => {
            const cachedSuggestions = [
                {
                    task: 'Cached task suggestion',
                    priority: 'low',
                    estimatedDuration: 30,
                    reasoning: 'Cached reasoning'
                }
            ];

            cacheService.get.mockResolvedValue(JSON.stringify(cachedSuggestions));

            const result = await aiService.suggestTasks(userId, contextData);

            expect(aiRepository.generateTaskSuggestions).not.toHaveBeenCalled();
            expect(result).toEqual(cachedSuggestions);
        });

        it('should handle AI service failures gracefully', async () => {
            aiRepository.generateTaskSuggestions.mockRejectedValue(
                new Error('AI service unavailable')
            );

            await expect(aiService.suggestTasks(userId, contextData))
                .rejects.toThrow('Failed to generate task suggestions');
        });

        it('should validate input context', async () => {
            const invalidContext = {
                currentTasks: [], // Empty tasks
                goals: [], // Empty goals
                preferences: {} // Empty preferences
            };

            const result = await aiService.suggestTasks(userId, invalidContext);

            expect(result).toEqual([]);
        });

        it('should enforce rate limiting', async () => {
            cacheService.get.mockResolvedValue(Date.now()); // Recent request

            await expect(aiService.suggestTasks(userId, contextData))
                .rejects.toThrow('Too many AI requests. Please try again later');
        });
    });

    describe('optimizeSchedule', () => {
        const scheduleData = {
            activities: [
                {
                    id: 'activity-1',
                    title: 'Task 1',
                    estimatedDuration: 60,
                    priority: 'high',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                },
                {
                    id: 'activity-2',
                    title: 'Task 2',
                    estimatedDuration: 30,
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
                }
            ],
            constraints: {
                workHours: {
                    start: '09:00',
                    end: '17:00'
                },
                breaks: ['12:00', '13:00'],
                unavailableSlots: []
            }
        };

        it('should successfully optimize schedule', async () => {
            const mockOptimizedSchedule = {
                activities: [
                    {
                        ...scheduleData.activities[0],
                        scheduledStart: '2024-01-01T09:00:00Z',
                        scheduledEnd: '2024-01-01T10:00:00Z'
                    },
                    {
                        ...scheduleData.activities[1],
                        scheduledStart: '2024-01-01T10:00:00Z',
                        scheduledEnd: '2024-01-01T10:30:00Z'
                    }
                ],
                metrics: {
                    totalTime: 90,
                    efficiency: 85,
                    conflicts: 0
                }
            };

            aiRepository.optimizeSchedule.mockResolvedValue(mockOptimizedSchedule);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await aiService.optimizeSchedule(userId, scheduleData);

            expect(aiRepository.optimizeSchedule).toHaveBeenCalledWith({
                userId,
                activities: scheduleData.activities,
                constraints: scheduleData.constraints
            });
            expect(result).toEqual(mockOptimizedSchedule);
        });

        it('should handle scheduling conflicts', async () => {
            const conflictingSchedule = {
                ...scheduleData,
                constraints: {
                    ...scheduleData.constraints,
                    unavailableSlots: [
                        {
                            start: '2024-01-01T09:00:00Z',
                            end: '2024-01-01T12:00:00Z'
                        }
                    ]
                }
            };

            const mockScheduleWithConflicts = {
                activities: [],
                metrics: {
                    totalTime: 0,
                    efficiency: 0,
                    conflicts: 2
                }
            };

            aiRepository.optimizeSchedule.mockResolvedValue(mockScheduleWithConflicts);

            const result = await aiService.optimizeSchedule(userId, conflictingSchedule);

            expect(result.metrics.conflicts).toBeGreaterThan(0);
        });

        it('should validate activity data', async () => {
            const invalidSchedule = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Task 1',
                        estimatedDuration: -10, // Invalid duration
                        priority: 'high'
                    }
                ],
                constraints: scheduleData.constraints
            };

            await expect(aiService.optimizeSchedule(userId, invalidSchedule))
                .rejects.toThrow('Invalid activity data');
        });

        it('should handle empty activity list', async () => {
            const emptySchedule = {
                activities: [],
                constraints: scheduleData.constraints
            };

            const result = await aiService.optimizeSchedule(userId, emptySchedule);

            expect(result.activities).toEqual([]);
            expect(result.metrics.totalTime).toBe(0);
        });
    });

    describe('analyzeProductivity', () => {
        const analysisData = {
            timeRange: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            },
            metrics: ['completionRate', 'timeManagement', 'taskDistribution']
        };

        it('should successfully analyze productivity', async () => {
            const mockAnalysis = {
                completionRate: {
                    overall: 75,
                    byPriority: {
                        high: 85,
                        medium: 70,
                        low: 60
                    }
                },
                timeManagement: {
                    averageTaskTime: 45,
                    onTimeCompletion: 80,
                    overdueTasks: 5
                },
                taskDistribution: {
                    total: 20,
                    completed: 15,
                    pending: 3,
                    inProgress: 2
                },
                insights: [
                    'You complete high-priority tasks 15% more often than low-priority ones',
                    'Consider allocating more time for medium-priority tasks'
                ]
            };

            aiRepository.analyzeProductivity.mockResolvedValue(mockAnalysis);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await aiService.analyzeProductivity(userId, analysisData);

            expect(aiRepository.analyzeProductivity).toHaveBeenCalledWith({
                userId,
                timeRange: analysisData.timeRange,
                metrics: analysisData.metrics
            });
            expect(cacheService.set).toHaveBeenCalledWith(
                `ai:productivity:${userId}`,
                JSON.stringify(mockAnalysis),
                7200
            );
            expect(result).toEqual(mockAnalysis);
        });

        it('should return cached analysis if available', async () => {
            const cachedAnalysis = {
                completionRate: { overall: 80 },
                timeManagement: { averageTaskTime: 40 },
                taskDistribution: { total: 25 },
                insights: ['Cached insight']
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedAnalysis));

            const result = await aiService.analyzeProductivity(userId, analysisData);

            expect(aiRepository.analyzeProductivity).not.toHaveBeenCalled();
            expect(result).toEqual(cachedAnalysis);
        });

        it('should handle invalid time ranges', async () => {
            const invalidAnalysisData = {
                timeRange: {
                    start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future start
                    end: new Date()
                },
                metrics: analysisData.metrics
            };

            await expect(aiService.analyzeProductivity(userId, invalidAnalysisData))
                .rejects.toThrow('Invalid time range');
        });

        it('should handle analysis failures gracefully', async () => {
            aiRepository.analyzeProductivity.mockRejectedValue(
                new Error('Insufficient data')
            );

            await expect(aiService.analyzeProductivity(userId, analysisData))
                .rejects.toThrow('Failed to analyze productivity');
        });
    });

    describe('getInsights', () => {
        it('should successfully generate insights', async () => {
            const mockInsights = [
                {
                    type: 'productivity',
                    title: 'Peak Productivity Hours',
                    description: 'You are most productive between 9 AM and 11 AM',
                    confidence: 0.85,
                    actionable: true,
                    action: 'Schedule important tasks during these hours'
                },
                {
                    type: 'task-management',
                    title: 'Task Completion Rate',
                    description: 'Your task completion rate has improved by 15% this week',
                    confidence: 0.92,
                    actionable: false,
                    action: null
                }
            ];

            aiRepository.generateInsights.mockResolvedValue(mockInsights);
            cacheService.set.mockResolvedValue();

            const result = await aiService.getInsights(userId);

            expect(aiRepository.generateInsights).toHaveBeenCalledWith(userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `ai:insights:${userId}`,
                JSON.stringify(mockInsights),
                3600
            );
            expect(result).toEqual(mockInsights);
        });

        it('should filter insights by type when specified', async () => {
            const productivityInsights = [
                {
                    type: 'productivity',
                    title: 'Peak Productivity',
                    description: 'Peak hours insight',
                    confidence: 0.85,
                    actionable: true,
                    action: 'Schedule important tasks'
                }
            ];

            aiRepository.generateInsights.mockResolvedValue(productivityInsights);

            const result = await aiService.getInsights(userId, 'productivity');

            expect(aiRepository.generateInsights).toHaveBeenCalledWith(
                userId,
                'productivity'
            );
            expect(result.every(insight => insight.type === 'productivity')).toBe(true);
        });

        it('should handle no insights available', async () => {
            aiRepository.generateInsights.mockResolvedValue([]);

            const result = await aiService.getInsights(userId);

            expect(result).toEqual([]);
        });

        it('should validate insight confidence scores', async () => {
            const invalidInsights = [
                {
                    type: 'productivity',
                    title: 'Invalid Insight',
                    description: 'This insight has invalid confidence',
                    confidence: 1.5, // Invalid confidence > 1
                    actionable: true,
                    action: 'Some action'
                }
            ];

            aiRepository.generateInsights.mockResolvedValue(invalidInsights);

            const result = await aiService.getInsights(userId);

            expect(result).toEqual([]); // Should filter out invalid insights
        });
    });

    describe('generateSmartReminders', () => {
        const reminderContext = {
            activities: [
                {
                    id: 'activity-1',
                    title: 'Important Task',
                    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    priority: 'high',
                    reminderSettings: {
                        enabled: true,
                        advanceNotice: 30
                    }
                }
            ],
            userPreferences: {
                reminderFrequency: 'normal',
                quietHours: {
                    start: '22:00',
                    end: '07:00'
                }
            }
        };

        it('should successfully generate smart reminders', async () => {
            const mockReminders = [
                {
                    activityId: 'activity-1',
                    scheduledFor: new Date(Date.now() + 90 * 60 * 1000),
                    message: 'Important Task is due in 30 minutes',
                    priority: 'high',
                    channel: 'push'
                }
            ];

            aiRepository.generateSmartReminders.mockResolvedValue(mockReminders);
            eventEmitter.emit.mockReturnValue();

            const result = await aiService.generateSmartReminders(userId, reminderContext);

            expect(aiRepository.generateSmartReminders).toHaveBeenCalledWith({
                userId,
                activities: reminderContext.activities,
                userPreferences: reminderContext.userPreferences
            });
            expect(eventEmitter.emit).toHaveBeenCalledWith('ai.reminders.generated', {
                userId,
                reminders: mockReminders
            });
            expect(result).toEqual(mockReminders);
        });

        it('should respect quiet hours', async () => {
            const nightTimeContext = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Night Task',
                        dueDate: new Date(Date.now() + 23 * 60 * 60 * 1000), // Due tomorrow night
                        priority: 'medium',
                        reminderSettings: {
                            enabled: true,
                            advanceNotice: 60
                        }
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: {
                        start: '22:00',
                        end: '07:00'
                    }
                }
            };

            const mockReminders = [
                {
                    activityId: 'activity-1',
                    scheduledFor: new Date(), // Would be during quiet hours
                    message: 'Task reminder',
                    priority: 'medium',
                    channel: 'push'
                }
            ];

            aiRepository.generateSmartReminders.mockResolvedValue(mockReminders);

            const result = await aiService.generateSmartReminders(userId, nightTimeContext);

            // Should schedule reminder after quiet hours end
            const scheduledHour = new Date(result[0].scheduledFor).getHours();
            expect(scheduledHour).toBeGreaterThanOrEqual(7);
        });

        it('should handle activities without reminder settings', async () => {
            const noReminderContext = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'No Reminder Task',
                        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
                        priority: 'low'
                        // No reminderSettings
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: {
                        start: '22:00',
                        end: '07:00'
                    }
                }
            };

            aiRepository.generateSmartReminders.mockResolvedValue([]);

            const result = await aiService.generateSmartReminders(userId, noReminderContext);

            expect(result).toEqual([]);
        });

        it('should prioritize high-priority activities', async () => {
            const mixedPriorityContext = {
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Low Priority Task',
                        dueDate: new Date(Date.now() + 60 * 60 * 1000),
                        priority: 'low',
                        reminderSettings: { enabled: true, advanceNotice: 30 }
                    },
                    {
                        id: 'activity-2',
                        title: 'High Priority Task',
                        dueDate: new Date(Date.now() + 60 * 60 * 1000),
                        priority: 'high',
                        reminderSettings: { enabled: true, advanceNotice: 30 }
                    }
                ],
                userPreferences: {
                    reminderFrequency: 'normal',
                    quietHours: { start: '22:00', end: '07:00' }
                }
            };

            const mockReminders = [
                {
                    activityId: 'activity-2', // High priority first
                    scheduledFor: new Date(),
                    message: 'High priority reminder',
                    priority: 'high',
                    channel: 'push'
                },
                {
                    activityId: 'activity-1',
                    scheduledFor: new Date(Date.now() + 10 * 60 * 1000),
                    message: 'Low priority reminder',
                    priority: 'low',
                    channel: 'email'
                }
            ];

            aiRepository.generateSmartReminders.mockResolvedValue(mockReminders);

            const result = await aiService.generateSmartReminders(userId, mixedPriorityContext);

            expect(result[0].priority).toBe('high');
            expect(result[0].activityId).toBe('activity-2');
        });
    });

    describe('predictCompletionTime', () => {
        const predictionData = {
            activity: {
                title: 'Complex Task',
                description: 'This is a complex task that requires careful analysis',
                type: 'task',
                priority: 'high',
                estimatedDuration: 120 // User's estimate
            },
            historicalData: [
                {
                    title: 'Similar Task 1',
                    actualDuration: 90,
                    estimatedDuration: 60,
                    complexity: 'medium'
                },
                {
                    title: 'Similar Task 2',
                    actualDuration: 150,
                    estimatedDuration: 120,
                    complexity: 'high'
                }
            ]
        };

        it('should successfully predict completion time', async () => {
            const mockPrediction = {
                predictedDuration: 135,
                confidence: 0.82,
                factors: ['task complexity', 'historical patterns'],
                range: {
                    min: 120,
                    max: 150
                },
                explanation: 'Based on similar tasks, this will likely take 135 minutes'
            };

            aiRepository.predictCompletionTime.mockResolvedValue(mockPrediction);
            cacheService.set.mockResolvedValue();

            const result = await aiService.predictCompletionTime(userId, predictionData);

            expect(aiRepository.predictCompletionTime).toHaveBeenCalledWith({
                userId,
                activity: predictionData.activity,
                historicalData: predictionData.historicalData
            });
            expect(cacheService.set).toHaveBeenCalledWith(
                `ai:prediction:${userId}:${predictionData.activity.title}`,
                JSON.stringify(mockPrediction),
                3600
            );
            expect(result).toEqual(mockPrediction);
        });

        it('should handle insufficient historical data', async () => {
            const insufficientData = {
                ...predictionData,
                historicalData: [] // No historical data
            };

            const fallbackPrediction = {
                predictedDuration: predictionData.activity.estimatedDuration,
                confidence: 0.5,
                factors: ['user estimate'],
                range: { min: 100, max: 140 },
                explanation: 'Using user estimate due to insufficient data'
            };

            aiRepository.predictCompletionTime.mockResolvedValue(fallbackPrediction);

            const result = await aiService.predictCompletionTime(userId, insufficientData);

            expect(result.predictedDuration).toBe(predictionData.activity.estimatedDuration);
            expect(result.confidence).toBe(0.5);
        });

        it('should validate activity data', async () => {
            const invalidActivity = {
                ...predictionData,
                activity: {
                    title: '', // Empty title
                    description: 'Description',
                    type: 'task',
                    priority: 'high',
                    estimatedDuration: 120
                }
            };

            await expect(aiService.predictCompletionTime(userId, invalidActivity))
                .rejects.toThrow('Invalid activity data');
        });

        it('should handle prediction failures gracefully', async () => {
            aiRepository.predictCompletionTime.mockRejectedValue(
                new Error('Model unavailable')
            );

            await expect(aiService.predictCompletionTime(userId, predictionData))
                .rejects.toThrow('Failed to predict completion time');
        });
    });

    describe('trackUserInteraction', () => {
        it('should successfully track user interaction with AI', async () => {
            const interactionData = {
                type: 'suggestion_accepted',
                suggestionId: 'suggestion-123',
                activityId: 'activity-123',
                timestamp: new Date(),
                feedback: 'helpful'
            };

            aiRepository.saveInteraction.mockResolvedValue(true);
            eventEmitter.emit.mockReturnValue();

            const result = await aiService.trackUserInteraction(userId, interactionData);

            expect(aiRepository.saveInteraction).toHaveBeenCalledWith({
                userId,
                ...interactionData
            });
            expect(eventEmitter.emit).toHaveBeenCalledWith('ai.interaction.tracked', {
                userId,
                interaction: interactionData
            });
            expect(result).toBe(true);
        });

        it('should validate interaction type', async () => {
            const invalidInteraction = {
                type: 'invalid_type',
                suggestionId: 'suggestion-123',
                activityId: 'activity-123',
                timestamp: new Date()
            };

            await expect(aiService.trackUserInteraction(userId, invalidInteraction))
                .rejects.toThrow('Invalid interaction type');
        });

        it('should handle tracking failures', async () => {
            const interactionData = {
                type: 'suggestion_rejected',
                suggestionId: 'suggestion-123',
                activityId: 'activity-123',
                timestamp: new Date(),
                feedback: 'not_relevant'
            };

            aiRepository.saveInteraction.mockRejectedValue(
                new Error('Database error')
            );

            await expect(aiService.trackUserInteraction(userId, interactionData))
                .rejects.toThrow('Failed to track interaction');
        });

        it('should anonymize sensitive data in interactions', async () => {
            const sensitiveInteraction = {
                type: 'suggestion_viewed',
                suggestionId: 'suggestion-123',
                activityId: 'activity-123',
                timestamp: new Date(),
                context: {
                    taskTitle: 'My Secret Project Task', // Sensitive data
                    userNotes: 'Confidential information' // Sensitive data
                }
            };

            aiRepository.saveInteraction.mockResolvedValue(true);

            await aiService.trackUserInteraction(userId, sensitiveInteraction);

            expect(aiRepository.saveInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                    type: 'suggestion_viewed',
                    suggestionId: 'suggestion-123',
                    activityId: 'activity-123',
                    timestamp: sensitiveInteraction.timestamp,
                    context: {} // Sensitive data should be removed
                })
            );
        });
    });
});