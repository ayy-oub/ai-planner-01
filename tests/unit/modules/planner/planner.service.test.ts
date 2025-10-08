import { PlannerService } from '../../../../src/modules/planner/planner.service';
import { PlannerRepository } from '../../../../src/modules/planner/planner.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { PlannerVisibility, UserRole } from '../../../../src/shared/types/common.types';
import { mockPlannerData } from '../../../utils/test-helpers';

jest.mock('../../../../src/modules/planner/planner.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('PlannerService', () => {
    let plannerService: PlannerService;
    let plannerRepository: jest.Mocked<PlannerRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        plannerRepository = new PlannerRepository() as jest.Mocked<PlannerRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        plannerService = new PlannerService(
            plannerRepository,
            cacheService,
            eventEmitter
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPlanner', () => {
        const createData = {
            title: 'New Planner',
            description: 'A new planner',
            color: '#FF5733',
            icon: '📝'
        };

        it('should successfully create a new planner', async () => {
            const mockPlanner = { ...mockPlannerData, ...createData };

            plannerRepository.create.mockResolvedValue(mockPlanner);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.createPlanner(userId, createData);

            expect(plannerRepository.create).toHaveBeenCalledWith({
                userId,
                ...createData,
                sections: [],
                collaborators: [],
                tags: [],
                settings: expect.objectContaining({
                    isPublic: PlannerVisibility.PRIVATE,
                    allowCollaboration: false,
                    autoArchive: false,
                    reminderEnabled: true
                })
            });
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('planner.created', {
                planner: mockPlanner,
                userId
            });
            expect(result).toEqual(mockPlanner);
        });

        it('should enforce limits for free users', async () => {
            // Mock user with free plan
            plannerRepository.getUserPlannerCount.mockResolvedValue(2);

            await expect(plannerService.createPlanner(userId, createData))
                .rejects.toThrow('Free plan limit reached');
        });

        it('should handle database errors gracefully', async () => {
            plannerRepository.create.mockRejectedValue(
                new Error('Database error')
            );

            await expect(plannerService.createPlanner(userId, createData))
                .rejects.toThrow('Failed to create planner');
        });
    });

    describe('getPlannerById', () => {
        it('should return planner from cache if available', async () => {
            const cachedPlanner = mockPlannerData;
            cacheService.get.mockResolvedValue(JSON.stringify(cachedPlanner));

            const result = await plannerService.getPlannerById(plannerId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(plannerRepository.findById).not.toHaveBeenCalled();
            expect(result).toEqual(cachedPlanner);
        });

        it('should fetch from database if not in cache', async () => {
            const mockPlanner = mockPlannerData;
            cacheService.get.mockResolvedValue(null);
            plannerRepository.findById.mockResolvedValue(mockPlanner);
            cacheService.set.mockResolvedValue();

            const result = await plannerService.getPlannerById(plannerId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `planner:${plannerId}`,
                JSON.stringify(mockPlanner),
                300
            );
            expect(result).toEqual(mockPlanner);
        });

        it('should throw error if planner not found', async () => {
            cacheService.get.mockResolvedValue(null);
            plannerRepository.findById.mockResolvedValue(null);

            await expect(plannerService.getPlannerById(plannerId, userId))
                .rejects.toThrow('Planner not found');
        });

        it('should check user permissions', async () => {
            const mockPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id',
                collaborators: []
            };
            cacheService.get.mockResolvedValue(null);
            plannerRepository.findById.mockResolvedValue(mockPlanner);

            await expect(plannerService.getPlannerById(plannerId, userId))
                .rejects.toThrow('Access denied');
        });
    });

    describe('getUserPlanners', () => {
        const filters = {
            page: 1,
            limit: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };

        it('should return user planners with pagination', async () => {
            const mockPlanners = [mockPlannerData];
            const totalCount = 1;

            plannerRepository.findByUserId.mockResolvedValue({
                data: mockPlanners,
                total: totalCount,
                page: filters.page,
                totalPages: 1
            });

            const result = await plannerService.getUserPlanners(userId, filters);

            expect(plannerRepository.findByUserId).toHaveBeenCalledWith(
                userId,
                filters
            );
            expect(result).toEqual({
                data: mockPlanners,
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

        it('should apply visibility filter', async () => {
            const filtersWithVisibility = {
                ...filters,
                visibility: PlannerVisibility.PRIVATE
            };

            plannerRepository.findByUserId.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                totalPages: 0
            });

            await plannerService.getUserPlanners(userId, filtersWithVisibility);

            expect(plannerRepository.findByUserId).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    visibility: PlannerVisibility.PRIVATE
                })
            );
        });

        it('should handle archived planners filter', async () => {
            const filtersWithArchive = {
                ...filters,
                includeArchived: false
            };

            plannerRepository.findByUserId.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                totalPages: 0
            });

            await plannerService.getUserPlanners(userId, filtersWithArchive);

            expect(plannerRepository.findByUserId).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    includeArchived: false
                })
            );
        });
    });

    describe('updatePlanner', () => {
        const updateData = {
            title: 'Updated Planner',
            description: 'Updated description'
        };

        it('should successfully update planner', async () => {
            const existingPlanner = mockPlannerData;
            const updatedPlanner = { ...existingPlanner, ...updateData };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.update.mockResolvedValue(updatedPlanner);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.updatePlanner(
                plannerId,
                userId,
                updateData
            );

            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(plannerRepository.update).toHaveBeenCalledWith(
                plannerId,
                updateData
            );
            expect(cacheService.del).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('planner.updated', {
                planner: updatedPlanner,
                userId
            });
            expect(result).toEqual(updatedPlanner);
        });

        it('should throw error if planner not found', async () => {
            plannerRepository.findById.mockResolvedValue(null);

            await expect(
                plannerService.updatePlanner(plannerId, userId, updateData)
            ).rejects.toThrow('Planner not found');
        });

        it('should check user permissions for update', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id',
                collaborators: []
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(
                plannerService.updatePlanner(plannerId, userId, updateData)
            ).rejects.toThrow('Access denied');
        });

        it('should allow collaborators with editor role to update', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id',
                collaborators: [{
                    userId,
                    role: UserRole.EDITOR,
                    addedAt: new Date()
                }]
            };

            const updatedPlanner = { ...existingPlanner, ...updateData };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.update.mockResolvedValue(updatedPlanner);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.updatePlanner(
                plannerId,
                userId,
                updateData
            );

            expect(result).toEqual(updatedPlanner);
        });
    });

    describe('deletePlanner', () => {
        it('should successfully delete planner', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.delete.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.deletePlanner(plannerId, userId);

            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(plannerRepository.delete).toHaveBeenCalledWith(plannerId);
            expect(cacheService.del).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('planner.deleted', {
                plannerId,
                userId
            });
            expect(result).toBe(true);
        });

        it('should throw error if planner not found', async () => {
            plannerRepository.findById.mockResolvedValue(null);

            await expect(plannerService.deletePlanner(plannerId, userId))
                .rejects.toThrow('Planner not found');
        });

        it('should only allow owner to delete planner', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id'
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(plannerService.deletePlanner(plannerId, userId))
                .rejects.toThrow('Only the owner can delete this planner');
        });

        it('should handle delete failures gracefully', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.delete.mockResolvedValue(false);

            const result = await plannerService.deletePlanner(plannerId, userId);

            expect(result).toBe(false);
        });
    });

    describe('duplicatePlanner', () => {
        it('should successfully duplicate planner', async () => {
            const existingPlanner = mockPlannerData;
            const duplicatedPlanner = {
                ...existingPlanner,
                id: 'duplicated-planner-id',
                title: `${existingPlanner.title} (Copy)`
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.create.mockResolvedValue(duplicatedPlanner);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.duplicatePlanner(plannerId, userId);

            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(plannerRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                    title: `${existingPlanner.title} (Copy)`,
                    sections: existingPlanner.sections,
                    collaborators: []
                })
            );
            expect(result).toEqual(duplicatedPlanner);
        });

        it('should throw error if planner not found', async () => {
            plannerRepository.findById.mockResolvedValue(null);

            await expect(plannerService.duplicatePlanner(plannerId, userId))
                .rejects.toThrow('Planner not found');
        });

        it('should check user permissions for duplication', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id',
                collaborators: []
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(plannerService.duplicatePlanner(plannerId, userId))
                .rejects.toThrow('Access denied');
        });

        it('should enforce limits for free users', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.getUserPlannerCount.mockResolvedValue(2);

            await expect(plannerService.duplicatePlanner(plannerId, userId))
                .rejects.toThrow('Free plan limit reached');
        });
    });

    describe('sharePlanner', () => {
        const shareData = {
            email: 'collaborator@example.com',
            role: UserRole.EDITOR
        };

        it('should successfully share planner with collaborator', async () => {
            const existingPlanner = mockPlannerData;
            const collaboratorUser = {
                uid: 'collaborator-id',
                email: shareData.email,
                displayName: 'Collaborator User'
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.findUserByEmail.mockResolvedValue(collaboratorUser);
            plannerRepository.addCollaborator.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.sharePlanner(
                plannerId,
                userId,
                shareData
            );

            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(plannerRepository.findUserByEmail).toHaveBeenCalledWith(
                shareData.email
            );
            expect(plannerRepository.addCollaborator).toHaveBeenCalledWith(
                plannerId,
                collaboratorUser.uid,
                shareData.role
            );
            expect(cacheService.del).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(result).toBe(true);
        });

        it('should throw error if planner not found', async () => {
            plannerRepository.findById.mockResolvedValue(null);

            await expect(
                plannerService.sharePlanner(plannerId, userId, shareData)
            ).rejects.toThrow('Planner not found');
        });

        it('should throw error if collaborator not found', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.findUserByEmail.mockResolvedValue(null);

            await expect(
                plannerService.sharePlanner(plannerId, userId, shareData)
            ).rejects.toThrow('User not found with email: collaborator@example.com');
        });

        it('should prevent sharing with self', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(
                plannerService.sharePlanner(plannerId, userId, {
                    ...shareData,
                    email: 'test@example.com'
                })
            ).rejects.toThrow('Cannot share planner with yourself');
        });

        it('should check if already shared', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                collaborators: [{
                    userId: 'collaborator-id',
                    role: UserRole.VIEWER,
                    addedAt: new Date()
                }]
            };

            const collaboratorUser = {
                uid: 'collaborator-id',
                email: shareData.email,
                displayName: 'Collaborator User'
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.findUserByEmail.mockResolvedValue(collaboratorUser);

            await expect(
                plannerService.sharePlanner(plannerId, userId, shareData)
            ).rejects.toThrow('User already has access to this planner');
        });
    });

    describe('removeCollaborator', () => {
        const collaboratorId = 'collaborator-id';

        it('should successfully remove collaborator', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                collaborators: [{
                    userId: collaboratorId,
                    role: UserRole.EDITOR,
                    addedAt: new Date()
                }]
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);
            plannerRepository.removeCollaborator.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await plannerService.removeCollaborator(
                plannerId,
                userId,
                collaboratorId
            );

            expect(plannerRepository.findById).toHaveBeenCalledWith(plannerId, userId);
            expect(plannerRepository.removeCollaborator).toHaveBeenCalledWith(
                plannerId,
                collaboratorId
            );
            expect(cacheService.del).toHaveBeenCalledWith(`planner:${plannerId}`);
            expect(result).toBe(true);
        });

        it('should throw error if collaborator not found', async () => {
            const existingPlanner = mockPlannerData;

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(
                plannerService.removeCollaborator(plannerId, userId, collaboratorId)
            ).rejects.toThrow('Collaborator not found');
        });

        it('should only allow owner to remove collaborators', async () => {
            const existingPlanner = {
                ...mockPlannerData,
                userId: 'different-user-id'
            };

            plannerRepository.findById.mockResolvedValue(existingPlanner);

            await expect(
                plannerService.removeCollaborator(plannerId, userId, collaboratorId)
            ).rejects.toThrow('Only the owner can remove collaborators');
        });
    });
});