import { ActivityService } from '../../../../src/modules/activity/activity.service';
import { ActivityRepository } from '../../../../src/modules/activity/activity.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { ActivityStatus, ActivityType, Priority } from '../../../../src/shared/types/common.types';
import { mockActivityData } from '../../../utils/test-helpers';

jest.mock('../../../../src/modules/activity/activity.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('ActivityService', () => {
    let activityService: ActivityService;
    let activityRepository: jest.Mocked<ActivityRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const activityId = 'test-activity-id';
    const sectionId = 'test-section-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        activityRepository = new ActivityRepository() as jest.Mocked<ActivityRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        activityService = new ActivityService(
            activityRepository,
            cacheService,
            eventEmitter
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createActivity', () => {
        const createData = {
            title: 'New Task',
            description: 'A new task to complete',
            type: ActivityType.TASK,
            priority: Priority.MEDIUM,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        it('should successfully create a new activity', async () => {
            const mockActivity = { ...mockActivityData, ...createData };

            activityRepository.create.mockResolvedValue(mockActivity);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await activityService.createActivity(
                userId,
                sectionId,
                plannerId,
                createData
            );

            expect(activityRepository.create).toHaveBeenCalledWith({
                userId,
                sectionId,
                plannerId,
                ...createData,
                status: ActivityStatus.PENDING,
                completedAt: null,
                tags: [],
                attachments: [],
                aiSuggestions: []
            });
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('activity.created', {
                activity: mockActivity,
                userId
            });
            expect(result).toEqual(mockActivity);
        });

        it('should validate due date is in the future', async () => {
            const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

            await expect(
                activityService.createActivity(userId, sectionId, plannerId, {
                    ...createData,
                    dueDate: pastDueDate
                })
            ).rejects.toThrow('Due date must be in the future');
        });

        it('should enforce activity limits for free users', async () => {
            activityRepository.getSectionActivityCount.mockResolvedValue(25);

            await expect(
                activityService.createActivity(userId, sectionId, plannerId, createData)
            ).rejects.toThrow('Activity limit reached for this section');
        });

        it('should validate section exists and user has access', async () => {
            activityRepository.validateSectionAccess.mockResolvedValue(false);

            await expect(
                activityService.createActivity(userId, sectionId, plannerId, createData)
            ).rejects.toThrow('Section not found or access denied');
        });
    });

    describe('getActivityById', () => {
        it('should return activity from cache if available', async () => {
            const cachedActivity = mockActivityData;
            cacheService.get.mockResolvedValue(JSON.stringify(cachedActivity));

            const result = await activityService.getActivityById(activityId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(activityRepository.findById).not.toHaveBeenCalled();
            expect(result).toEqual(cachedActivity);
        });

        it('should fetch from database if not in cache', async () => {
            const mockActivity = mockActivityData;
            cacheService.get.mockResolvedValue(null);
            activityRepository.findById.mockResolvedValue(mockActivity);
            cacheService.set.mockResolvedValue();

            const result = await activityService.getActivityById(activityId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `activity:${activityId}`,
                JSON.stringify(mockActivity),
                300
            );
            expect(result).toEqual(mockActivity);
        });

        it('should throw error if activity not found', async () => {
            cacheService.get.mockResolvedValue(null);
            activityRepository.findById.mockResolvedValue(null);

            await expect(activityService.getActivityById(activityId, userId))
                .rejects.toThrow('Activity not found');
        });

        it('should check user permissions', async () => {
            const mockActivity = {
                ...mockActivityData,
                userId: 'different-user-id'
            };
            cacheService.get.mockResolvedValue(null);
            activityRepository.findById.mockResolvedValue(mockActivity);

            await expect(activityService.getActivityById(activityId, userId))
                .rejects.toThrow('Access denied');
        });
    });

    describe('getActivitiesBySection', () => {
        const filters = {
            page: 1,
            limit: 20,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            status: undefined,
            priority: undefined
        };

        it('should return activities for a section', async () => {
            const mockActivities = [mockActivityData];
            const totalCount = 1;

            activityRepository.findBySectionId.mockResolvedValue({
                data: mockActivities,
                total: totalCount,
                page: filters.page,
                totalPages: 1
            });

            const result = await activityService.getActivitiesBySection(
                sectionId,
                userId,
                filters
            );

            expect(activityRepository.findBySectionId).toHaveBeenCalledWith(
                sectionId,
                userId,
                filters
            );
            expect(result).toEqual({
                data: mockActivities,
                pagination: {
                    total: totalCount,
                    page: filters.page,
                    limit: filters.limit,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                }
            });
        });

        it('should filter by status', async () => {
            const filtersWithStatus = {
                ...filters,
                status: ActivityStatus.COMPLETED
            };

            activityRepository.findBySectionId.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                totalPages: 0
            });

            await activityService.getActivitiesBySection(sectionId, userId, filtersWithStatus);

            expect(activityRepository.findBySectionId).toHaveBeenCalledWith(
                sectionId,
                userId,
                expect.objectContaining({
                    status: ActivityStatus.COMPLETED
                })
            );
        });

        it('should filter by priority', async () => {
            const filtersWithPriority = {
                ...filters,
                priority: Priority.HIGH
            };

            activityRepository.findBySectionId.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                totalPages: 0
            });

            await activityService.getActivitiesBySection(sectionId, userId, filtersWithPriority);

            expect(activityRepository.findBySectionId).toHaveBeenCalledWith(
                sectionId,
                userId,
                expect.objectContaining({
                    priority: Priority.HIGH
                })
            );
        });

        it('should validate section access', async () => {
            activityRepository.validateSectionAccess.mockResolvedValue(false);

            await expect(
                activityService.getActivitiesBySection(sectionId, userId, filters)
            ).rejects.toThrow('Section not found or access denied');
        });
    });

    describe('updateActivity', () => {
        const updateData = {
            title: 'Updated Task',
            description: 'Updated description',
            priority: Priority.HIGH
        };

        it('should successfully update activity', async () => {
            const existingActivity = mockActivityData;
            const updatedActivity = { ...existingActivity, ...updateData };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.update.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await activityService.updateActivity(
                activityId,
                userId,
                updateData
            );

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.update).toHaveBeenCalledWith(
                activityId,
                updateData
            );
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('activity.updated', {
                activity: updatedActivity,
                userId
            });
            expect(result).toEqual(updatedActivity);
        });

        it('should throw error if activity not found', async () => {
            activityRepository.findById.mockResolvedValue(null);

            await expect(
                activityService.updateActivity(activityId, userId, updateData)
            ).rejects.toThrow('Activity not found');
        });

        it('should check user permissions for update', async () => {
            const existingActivity = {
                ...mockActivityData,
                userId: 'different-user-id'
            };

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.updateActivity(activityId, userId, updateData)
            ).rejects.toThrow('Access denied');
        });

        it('should validate due date is in the future', async () => {
            const existingActivity = mockActivityData;
            const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.updateActivity(activityId, userId, {
                    dueDate: pastDueDate
                })
            ).rejects.toThrow('Due date must be in the future');
        });

        it('should handle status transitions', async () => {
            const existingActivity = {
                ...mockActivityData,
                status: ActivityStatus.PENDING
            };
            const updatedActivity = {
                ...existingActivity,
                status: ActivityStatus.COMPLETED
            };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.update.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await activityService.updateActivity(activityId, userId, {
                status: ActivityStatus.COMPLETED
            });

            expect(result.status).toBe(ActivityStatus.COMPLETED);
            expect(result.completedAt).toBeInstanceOf(Date);
            expect(eventEmitter.emit).toHaveBeenCalledWith('activity.completed', {
                activity: updatedActivity,
                userId
            });
        });
    });

    describe('deleteActivity', () => {
        it('should successfully delete activity', async () => {
            const existingActivity = mockActivityData;

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.delete.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await activityService.deleteActivity(activityId, userId);

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.delete).toHaveBeenCalledWith(activityId);
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('activity.deleted', {
                activityId,
                userId
            });
            expect(result).toBe(true);
        });

        it('should throw error if activity not found', async () => {
            activityRepository.findById.mockResolvedValue(null);

            await expect(activityService.deleteActivity(activityId, userId))
                .rejects.toThrow('Activity not found');
        });

        it('should only allow owner to delete activity', async () => {
            const existingActivity = {
                ...mockActivityData,
                userId: 'different-user-id'
            };

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(activityService.deleteActivity(activityId, userId))
                .rejects.toThrow('Access denied');
        });
    });

    describe('bulkUpdateActivities', () => {
        const activityIds = ['activity-1', 'activity-2', 'activity-3'];
        const bulkUpdateData = {
            status: ActivityStatus.COMPLETED,
            priority: Priority.HIGH
        };

        it('should successfully bulk update activities', async () => {
            const existingActivities = activityIds.map(id => ({
                ...mockActivityData,
                id,
                userId
            }));

            activityRepository.findByIds.mockResolvedValue(existingActivities);
            activityRepository.bulkUpdate.mockResolvedValue(true);

            activityIds.forEach(id => {
                cacheService.del.mockResolvedValue();
            });

            const result = await activityService.bulkUpdateActivities(
                activityIds,
                userId,
                bulkUpdateData
            );

            expect(activityRepository.findByIds).toHaveBeenCalledWith(
                activityIds,
                userId
            );
            expect(activityRepository.bulkUpdate).toHaveBeenCalledWith(
                activityIds,
                bulkUpdateData
            );
            expect(cacheService.del).toHaveBeenCalledTimes(activityIds.length);
            expect(result).toBe(true);
        });

        it('should validate all activities exist and belong to user', async () => {
            const existingActivities = [
                { ...mockActivityData, id: 'activity-1', userId },
                { ...mockActivityData, id: 'activity-2', userId: 'different-user' }
            ];

            activityRepository.findByIds.mockResolvedValue(existingActivities);

            await expect(
                activityService.bulkUpdateActivities(activityIds, userId, bulkUpdateData)
            ).rejects.toThrow('Some activities not found or access denied');
        });

        it('should handle partial updates gracefully', async () => {
            const existingActivities = activityIds.map(id => ({
                ...mockActivityData,
                id,
                userId
            }));

            activityRepository.findByIds.mockResolvedValue(existingActivities);
            activityRepository.bulkUpdate.mockResolvedValue(false);

            const result = await activityService.bulkUpdateActivities(
                activityIds,
                userId,
                bulkUpdateData
            );

            expect(result).toBe(false);
        });
    });

    describe('reorderActivities', () => {
        const reorderData = {
            activityIds: ['activity-1', 'activity-2', 'activity-3']
        };

        it('should successfully reorder activities', async () => {
            const existingActivities = reorderData.activityIds.map((id, index) => ({
                ...mockActivityData,
                id,
                userId,
                order: index
            }));

            activityRepository.findByIds.mockResolvedValue(existingActivities);
            activityRepository.updateOrder.mockResolvedValue(true);

            reorderData.activityIds.forEach(id => {
                cacheService.del.mockResolvedValue();
            });

            const result = await activityService.reorderActivities(
                sectionId,
                userId,
                reorderData.activityIds
            );

            expect(activityRepository.findByIds).toHaveBeenCalledWith(
                reorderData.activityIds,
                userId
            );
            expect(activityRepository.updateOrder).toHaveBeenCalledWith(
                reorderData.activityIds
            );
            expect(cacheService.del).toHaveBeenCalledTimes(reorderData.activityIds.length);
            expect(result).toBe(true);
        });

        it('should validate all activities belong to the same section', async () => {
            const existingActivities = reorderData.activityIds.map((id, index) => ({
                ...mockActivityData,
                id,
                userId,
                sectionId: index === 0 ? 'different-section' : sectionId,
                order: index
            }));

            activityRepository.findByIds.mockResolvedValue(existingActivities);

            await expect(
                activityService.reorderActivities(sectionId, userId, reorderData.activityIds)
            ).rejects.toThrow('All activities must belong to the same section');
        });

        it('should validate section access', async () => {
            activityRepository.validateSectionAccess.mockResolvedValue(false);

            await expect(
                activityService.reorderActivities(sectionId, userId, reorderData.activityIds)
            ).rejects.toThrow('Section not found or access denied');
        });
    });

    describe('getActivityStats', () => {
        it('should return activity statistics for user', async () => {
            const mockStats = {
                total: 10,
                completed: 7,
                pending: 2,
                inProgress: 1,
                overdue: 1,
                completionRate: 70,
                averageCompletionTime: 2.5
            };

            activityRepository.getUserStats.mockResolvedValue(mockStats);

            const result = await activityService.getActivityStats(userId);

            expect(activityRepository.getUserStats).toHaveBeenCalledWith(userId);
            expect(result).toEqual(mockStats);
        });

        it('should return stats for specific planner', async () => {
            const mockStats = {
                total: 5,
                completed: 3,
                pending: 2,
                inProgress: 0,
                overdue: 0,
                completionRate: 60,
                averageCompletionTime: 1.5
            };

            activityRepository.getPlannerStats.mockResolvedValue(mockStats);

            const result = await activityService.getActivityStats(userId, plannerId);

            expect(activityRepository.getPlannerStats).toHaveBeenCalledWith(
                userId,
                plannerId
            );
            expect(result).toEqual(mockStats);
        });

        it('should return stats for specific section', async () => {
            const mockStats = {
                total: 3,
                completed: 2,
                pending: 1,
                inProgress: 0,
                overdue: 0,
                completionRate: 66.67,
                averageCompletionTime: 1.0
            };

            activityRepository.getSectionStats.mockResolvedValue(mockStats);

            const result = await activityService.getActivityStats(
                userId,
                plannerId,
                sectionId
            );

            expect(activityRepository.getSectionStats).toHaveBeenCalledWith(
                userId,
                sectionId
            );
            expect(result).toEqual(mockStats);
        });
    });

    describe('addAttachment', () => {
        const attachmentData = {
            name: 'document.pdf',
            url: 'https://storage.example.com/documents/document.pdf',
            type: 'application/pdf',
            size: 1024000
        };

        it('should successfully add attachment to activity', async () => {
            const existingActivity = mockActivityData;
            const updatedActivity = {
                ...existingActivity,
                attachments: [...existingActivity.attachments, attachmentData]
            };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.addAttachment.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();

            const result = await activityService.addAttachment(
                activityId,
                userId,
                attachmentData
            );

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.addAttachment).toHaveBeenCalledWith(
                activityId,
                attachmentData
            );
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(result).toEqual(updatedActivity);
        });

        it('should validate file size limits', async () => {
            const largeAttachment = {
                ...attachmentData,
                size: 10 * 1024 * 1024 // 10MB
            };

            const existingActivity = mockActivityData;
            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.addAttachment(activityId, userId, largeAttachment)
            ).rejects.toThrow('File size exceeds limit');
        });

        it('should validate file type', async () => {
            const invalidAttachment = {
                ...attachmentData,
                type: 'application/exe'
            };

            const existingActivity = mockActivityData;
            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.addAttachment(activityId, userId, invalidAttachment)
            ).rejects.toThrow('File type not allowed');
        });

        it('should enforce attachment limits', async () => {
            const existingActivity = {
                ...mockActivityData,
                attachments: new Array(10).fill(attachmentData)
            };

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.addAttachment(activityId, userId, attachmentData)
            ).rejects.toThrow('Maximum number of attachments reached');
        });
    });

    describe('removeAttachment', () => {
        const attachmentId = 'attachment-123';

        it('should successfully remove attachment from activity', async () => {
            const existingActivity = {
                ...mockActivityData,
                attachments: [{
                    id: attachmentId,
                    name: 'document.pdf',
                    url: 'https://storage.example.com/documents/document.pdf',
                    type: 'application/pdf',
                    size: 1024000
                }]
            };
            const updatedActivity = {
                ...existingActivity,
                attachments: []
            };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.removeAttachment.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();

            const result = await activityService.removeAttachment(
                activityId,
                userId,
                attachmentId
            );

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.removeAttachment).toHaveBeenCalledWith(
                activityId,
                attachmentId
            );
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(result).toEqual(updatedActivity);
        });

        it('should throw error if attachment not found', async () => {
            const existingActivity = mockActivityData;

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.removeAttachment(activityId, userId, attachmentId)
            ).rejects.toThrow('Attachment not found');
        });
    });

    describe('addAiSuggestion', () => {
        const suggestionData = {
            suggestion: 'Consider breaking this task into smaller subtasks',
            confidence: 0.85
        };

        it('should successfully add AI suggestion to activity', async () => {
            const existingActivity = mockActivityData;
            const aiSuggestion = {
                id: 'ai-suggestion-123',
                ...suggestionData,
                accepted: false
            };
            const updatedActivity = {
                ...existingActivity,
                aiSuggestions: [...existingActivity.aiSuggestions, aiSuggestion]
            };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.addAiSuggestion.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();

            const result = await activityService.addAiSuggestion(
                activityId,
                userId,
                suggestionData
            );

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.addAiSuggestion).toHaveBeenCalledWith(
                activityId,
                expect.objectContaining({
                    ...suggestionData,
                    id: expect.any(String),
                    accepted: false
                })
            );
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(result).toEqual(updatedActivity);
        });

        it('should validate confidence score', async () => {
            const existingActivity = mockActivityData;
            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.addAiSuggestion(activityId, userId, {
                    suggestion: 'Test suggestion',
                    confidence: 1.5 // Invalid confidence > 1
                })
            ).rejects.toThrow('Confidence score must be between 0 and 1');
        });

        it('should enforce AI suggestions limits', async () => {
            const existingActivity = {
                ...mockActivityData,
                aiSuggestions: new Array(5).fill({
                    id: 'existing-suggestion',
                    suggestion: 'Existing suggestion',
                    confidence: 0.8,
                    accepted: false
                })
            };

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.addAiSuggestion(activityId, userId, suggestionData)
            ).rejects.toThrow('Maximum number of AI suggestions reached');
        });
    });

    describe('acceptAiSuggestion', () => {
        const suggestionId = 'ai-suggestion-123';

        it('should successfully accept AI suggestion', async () => {
            const existingActivity = {
                ...mockActivityData,
                aiSuggestions: [{
                    id: suggestionId,
                    suggestion: 'Consider breaking this task into smaller subtasks',
                    confidence: 0.85,
                    accepted: false
                }]
            };
            const updatedActivity = {
                ...existingActivity,
                aiSuggestions: [{
                    ...existingActivity.aiSuggestions[0],
                    accepted: true
                }]
            };

            activityRepository.findById.mockResolvedValue(existingActivity);
            activityRepository.updateAiSuggestion.mockResolvedValue(updatedActivity);
            cacheService.del.mockResolvedValue();

            const result = await activityService.acceptAiSuggestion(
                activityId,
                userId,
                suggestionId
            );

            expect(activityRepository.findById).toHaveBeenCalledWith(activityId, userId);
            expect(activityRepository.updateAiSuggestion).toHaveBeenCalledWith(
                activityId,
                suggestionId,
                { accepted: true }
            );
            expect(cacheService.del).toHaveBeenCalledWith(`activity:${activityId}`);
            expect(result).toEqual(updatedActivity);
        });

        it('should throw error if suggestion not found', async () => {
            const existingActivity = mockActivityData;

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.acceptAiSuggestion(activityId, userId, suggestionId)
            ).rejects.toThrow('AI suggestion not found');
        });

        it('should not allow accepting already accepted suggestions', async () => {
            const existingActivity = {
                ...mockActivityData,
                aiSuggestions: [{
                    id: suggestionId,
                    suggestion: 'Already accepted suggestion',
                    confidence: 0.85,
                    accepted: true
                }]
            };

            activityRepository.findById.mockResolvedValue(existingActivity);

            await expect(
                activityService.acceptAiSuggestion(activityId, userId, suggestionId)
            ).rejects.toThrow('AI suggestion already accepted');
        });
    });
});