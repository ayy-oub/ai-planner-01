import { SectionService } from '../../../../src/modules/section/section.service';
import { SectionRepository } from '../../../../src/modules/section/section.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { SectionType } from '../../../../src/shared/types/common.types';
import { mockSectionData } from '../../../utils/test-helpers';

jest.mock('../../../../src/modules/section/section.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('SectionService', () => {
    let sectionService: SectionService;
    let sectionRepository: jest.Mocked<SectionRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const sectionId = 'test-section-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        sectionRepository = new SectionRepository() as jest.Mocked<SectionRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        sectionService = new SectionService(sectionRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createSection', () => {
        const createData = {
            title: 'New Section',
            description: 'A new section for tasks',
            type: SectionType.TASKS,
            order: 1
        };

        it('should successfully create a new section', async () => {
            const mockSection = { ...mockSectionData, ...createData };

            sectionRepository.create.mockResolvedValue(mockSection);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await sectionService.createSection(userId, plannerId, createData);

            expect(sectionRepository.create).toHaveBeenCalledWith({
                userId,
                plannerId,
                ...createData,
                activities: [],
                settings: expect.objectContaining({
                    collapsed: false,
                    color: expect.any(String),
                    icon: expect.any(String)
                })
            });
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('section.created', {
                section: mockSection,
                userId
            });
            expect(result).toEqual(mockSection);
        });

        it('should enforce section limits for free users', async () => {
            sectionRepository.getSectionCount.mockResolvedValue(10);

            await expect(sectionService.createSection(userId, plannerId, createData))
                .rejects.toThrow('Section limit reached for this planner');
        });

        it('should validate planner exists and user has access', async () => {
            sectionRepository.validatePlannerAccess.mockResolvedValue(false);

            await expect(sectionService.createSection(userId, plannerId, createData))
                .rejects.toThrow('Planner not found or access denied');
        });

        it('should assign default order if not specified', async () => {
            const createDataWithoutOrder = {
                title: 'New Section',
                description: 'A new section',
                type: SectionType.TASKS
            };

            sectionRepository.getMaxOrder.mockResolvedValue(3);
            sectionRepository.create.mockResolvedValue({
                ...mockSectionData,
                ...createDataWithoutOrder,
                order: 4
            });

            const result = await sectionService.createSection(
                userId,
                plannerId,
                createDataWithoutOrder
            );

            expect(sectionRepository.getMaxOrder).toHaveBeenCalledWith(plannerId);
            expect(result.order).toBe(4);
        });
    });

    describe('getSectionById', () => {
        it('should return section from cache if available', async () => {
            const cachedSection = mockSectionData;
            cacheService.get.mockResolvedValue(JSON.stringify(cachedSection));

            const result = await sectionService.getSectionById(sectionId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`section:${sectionId}`);
            expect(sectionRepository.findById).not.toHaveBeenCalled();
            expect(result).toEqual(cachedSection);
        });

        it('should fetch from database if not in cache', async () => {
            const mockSection = mockSectionData;
            cacheService.get.mockResolvedValue(null);
            sectionRepository.findById.mockResolvedValue(mockSection);
            cacheService.set.mockResolvedValue();

            const result = await sectionService.getSectionById(sectionId, userId);

            expect(cacheService.get).toHaveBeenCalledWith(`section:${sectionId}`);
            expect(sectionRepository.findById).toHaveBeenCalledWith(sectionId, userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `section:${sectionId}`,
                JSON.stringify(mockSection),
                300
            );
            expect(result).toEqual(mockSection);
        });

        it('should throw error if section not found', async () => {
            cacheService.get.mockResolvedValue(null);
            sectionRepository.findById.mockResolvedValue(null);

            await expect(sectionService.getSectionById(sectionId, userId))
                .rejects.toThrow('Section not found');
        });

        it('should check user permissions', async () => {
            const mockSection = {
                ...mockSectionData,
                userId: 'different-user-id'
            };
            cacheService.get.mockResolvedValue(null);
            sectionRepository.findById.mockResolvedValue(mockSection);

            await expect(sectionService.getSectionById(sectionId, userId))
                .rejects.toThrow('Access denied');
        });
    });

    describe('getSectionsByPlanner', () => {
        it('should return sections for a planner', async () => {
            const mockSections = [mockSectionData];

            sectionRepository.findByPlannerId.mockResolvedValue(mockSections);

            const result = await sectionService.getSectionsByPlanner(plannerId, userId);

            expect(sectionRepository.findByPlannerId).toHaveBeenCalledWith(plannerId, userId);
            expect(result).toEqual(mockSections);
        });

        it('should validate planner access', async () => {
            sectionRepository.validatePlannerAccess.mockResolvedValue(false);

            await expect(sectionService.getSectionsByPlanner(plannerId, userId))
                .rejects.toThrow('Planner not found or access denied');
        });

        it('should return sections in correct order', async () => {
            const unorderedSections = [
                { ...mockSectionData, id: 'section-1', order: 3 },
                { ...mockSectionData, id: 'section-2', order: 1 },
                { ...mockSectionData, id: 'section-3', order: 2 }
            ];

            sectionRepository.findByPlannerId.mockResolvedValue(unorderedSections);

            const result = await sectionService.getSectionsByPlanner(plannerId, userId);

            expect(result[0].order).toBe(1);
            expect(result[1].order).toBe(2);
            expect(result[2].order).toBe(3);
        });
    });

    describe('updateSection', () => {
        const updateData = {
            title: 'Updated Section',
            description: 'Updated description',
            settings: {
                collapsed: true,
                color: '#FF5733'
            }
        };

        it('should successfully update section', async () => {
            const existingSection = mockSectionData;
            const updatedSection = { ...existingSection, ...updateData };

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.update.mockResolvedValue(updatedSection);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await sectionService.updateSection(sectionId, userId, updateData);

            expect(sectionRepository.findById).toHaveBeenCalledWith(sectionId, userId);
            expect(sectionRepository.update).toHaveBeenCalledWith(sectionId, updateData);
            expect(cacheService.del).toHaveBeenCalledWith(`section:${sectionId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('section.updated', {
                section: updatedSection,
                userId
            });
            expect(result).toEqual(updatedSection);
        });

        it('should throw error if section not found', async () => {
            sectionRepository.findById.mockResolvedValue(null);

            await expect(sectionService.updateSection(sectionId, userId, updateData))
                .rejects.toThrow('Section not found');
        });

        it('should check user permissions for update', async () => {
            const existingSection = {
                ...mockSectionData,
                userId: 'different-user-id'
            };

            sectionRepository.findById.mockResolvedValue(existingSection);

            await expect(sectionService.updateSection(sectionId, userId, updateData))
                .rejects.toThrow('Access denied');
        });

        it('should prevent changing section type if activities exist', async () => {
            const existingSection = {
                ...mockSectionData,
                activities: ['activity-1', 'activity-2']
            };

            sectionRepository.findById.mockResolvedValue(existingSection);

            await expect(
                sectionService.updateSection(sectionId, userId, {
                    type: SectionType.NOTES
                })
            ).rejects.toThrow('Cannot change section type when activities exist');
        });
    });

    describe('deleteSection', () => {
        it('should successfully delete section', async () => {
            const existingSection = mockSectionData;

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.delete.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await sectionService.deleteSection(sectionId, userId);

            expect(sectionRepository.findById).toHaveBeenCalledWith(sectionId, userId);
            expect(sectionRepository.delete).toHaveBeenCalledWith(sectionId);
            expect(cacheService.del).toHaveBeenCalledWith(`section:${sectionId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('section.deleted', {
                sectionId,
                userId
            });
            expect(result).toBe(true);
        });

        it('should throw error if section not found', async () => {
            sectionRepository.findById.mockResolvedValue(null);

            await expect(sectionService.deleteSection(sectionId, userId))
                .rejects.toThrow('Section not found');
        });

        it('should prevent deleting section with activities', async () => {
            const existingSection = {
                ...mockSectionData,
                activities: ['activity-1', 'activity-2']
            };

            sectionRepository.findById.mockResolvedValue(existingSection);

            await expect(sectionService.deleteSection(sectionId, userId))
                .rejects.toThrow('Cannot delete section with activities');
        });

        it('should only allow owner to delete section', async () => {
            const existingSection = {
                ...mockSectionData,
                userId: 'different-user-id'
            };

            sectionRepository.findById.mockResolvedValue(existingSection);

            await expect(sectionService.deleteSection(sectionId, userId))
                .rejects.toThrow('Access denied');
        });
    });

    describe('reorderSections', () => {
        const sectionIds = ['section-1', 'section-2', 'section-3'];

        it('should successfully reorder sections', async () => {
            const existingSections = sectionIds.map((id, index) => ({
                ...mockSectionData,
                id,
                userId,
                order: index
            }));

            sectionRepository.findByIds.mockResolvedValue(existingSections);
            sectionRepository.updateOrder.mockResolvedValue(true);

            sectionIds.forEach(id => {
                cacheService.del.mockResolvedValue();
            });

            const result = await sectionService.reorderSections(
                plannerId,
                userId,
                sectionIds
            );

            expect(sectionRepository.findByIds).toHaveBeenCalledWith(sectionIds, userId);
            expect(sectionRepository.updateOrder).toHaveBeenCalledWith(sectionIds);
            expect(cacheService.del).toHaveBeenCalledTimes(sectionIds.length);
            expect(result).toBe(true);
        });

        it('should validate all sections belong to the same planner', async () => {
            const existingSections = sectionIds.map((id, index) => ({
                ...mockSectionData,
                id,
                userId,
                plannerId: index === 0 ? 'different-planner' : plannerId,
                order: index
            }));

            sectionRepository.findByIds.mockResolvedValue(existingSections);

            await expect(
                sectionService.reorderSections(plannerId, userId, sectionIds)
            ).rejects.toThrow('All sections must belong to the same planner');
        });

        it('should validate section access', async () => {
            sectionRepository.validateSectionAccess.mockResolvedValue(false);

            await expect(
                sectionService.reorderSections(plannerId, userId, sectionIds)
            ).rejects.toThrow('Section not found or access denied');
        });

        it('should handle partial updates gracefully', async () => {
            const existingSections = sectionIds.map((id, index) => ({
                ...mockSectionData,
                id,
                userId,
                order: index
            }));

            sectionRepository.findByIds.mockResolvedValue(existingSections);
            sectionRepository.updateOrder.mockResolvedValue(false);

            const result = await sectionService.reorderSections(
                plannerId,
                userId,
                sectionIds
            );

            expect(result).toBe(false);
        });
    });

    describe('toggleSectionCollapse', () => {
        it('should successfully toggle section collapse state', async () => {
            const existingSection = {
                ...mockSectionData,
                settings: {
                    ...mockSectionData.settings,
                    collapsed: false
                }
            };
            const updatedSection = {
                ...existingSection,
                settings: {
                    ...existingSection.settings,
                    collapsed: true
                }
            };

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.updateSettings.mockResolvedValue(updatedSection);
            cacheService.del.mockResolvedValue();

            const result = await sectionService.toggleSectionCollapse(sectionId, userId);

            expect(sectionRepository.findById).toHaveBeenCalledWith(sectionId, userId);
            expect(sectionRepository.updateSettings).toHaveBeenCalledWith(
                sectionId,
                { collapsed: true }
            );
            expect(cacheService.del).toHaveBeenCalledWith(`section:${sectionId}`);
            expect(result.collapsed).toBe(true);
        });

        it('should toggle from collapsed to expanded', async () => {
            const existingSection = {
                ...mockSectionData,
                settings: {
                    ...mockSectionData.settings,
                    collapsed: true
                }
            };
            const updatedSection = {
                ...existingSection,
                settings: {
                    ...existingSection.settings,
                    collapsed: false
                }
            };

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.updateSettings.mockResolvedValue(updatedSection);
            cacheService.del.mockResolvedValue();

            const result = await sectionService.toggleSectionCollapse(sectionId, userId);

            expect(sectionRepository.updateSettings).toHaveBeenCalledWith(
                sectionId,
                { collapsed: false }
            );
            expect(result.collapsed).toBe(false);
        });

        it('should throw error if section not found', async () => {
            sectionRepository.findById.mockResolvedValue(null);

            await expect(sectionService.toggleSectionCollapse(sectionId, userId))
                .rejects.toThrow('Section not found');
        });
    });

    describe('getSectionStats', () => {
        it('should return section statistics', async () => {
            const mockStats = {
                totalActivities: 15,
                completedActivities: 10,
                pendingActivities: 3,
                inProgressActivities: 2,
                completionRate: 66.67,
                averageCompletionTime: 2.5
            };

            sectionRepository.getSectionStats.mockResolvedValue(mockStats);

            const result = await sectionService.getSectionStats(sectionId, userId);

            expect(sectionRepository.getSectionStats).toHaveBeenCalledWith(sectionId, userId);
            expect(result).toEqual(mockStats);
        });

        it('should validate section access', async () => {
            sectionRepository.validateSectionAccess.mockResolvedValue(false);

            await expect(sectionService.getSectionStats(sectionId, userId))
                .rejects.toThrow('Section not found or access denied');
        });

        it('should handle sections with no activities', async () => {
            const emptyStats = {
                totalActivities: 0,
                completedActivities: 0,
                pendingActivities: 0,
                inProgressActivities: 0,
                completionRate: 0,
                averageCompletionTime: 0
            };

            sectionRepository.getSectionStats.mockResolvedValue(emptyStats);

            const result = await sectionService.getSectionStats(sectionId, userId);

            expect(result.totalActivities).toBe(0);
            expect(result.completionRate).toBe(0);
        });
    });

    describe('duplicateSection', () => {
        it('should successfully duplicate section', async () => {
            const existingSection = mockSectionData;
            const duplicatedSection = {
                ...existingSection,
                id: 'duplicated-section-id',
                title: `${existingSection.title} (Copy)`,
                activities: []
            };

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.create.mockResolvedValue(duplicatedSection);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await sectionService.duplicateSection(sectionId, userId);

            expect(sectionRepository.findById).toHaveBeenCalledWith(sectionId, userId);
            expect(sectionRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                    plannerId: existingSection.plannerId,
                    title: `${existingSection.title} (Copy)`,
                    activities: [],
                    order: expect.any(Number)
                })
            );
            expect(result).toEqual(duplicatedSection);
        });

        it('should throw error if section not found', async () => {
            sectionRepository.findById.mockResolvedValue(null);

            await expect(sectionService.duplicateSection(sectionId, userId))
                .rejects.toThrow('Section not found');
        });

        it('should check section limits before duplication', async () => {
            const existingSection = mockSectionData;

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.getSectionCount.mockResolvedValue(10);

            await expect(sectionService.duplicateSection(sectionId, userId))
                .rejects.toThrow('Section limit reached for this planner');
        });

        it('should optionally duplicate activities', async () => {
            const existingSection = {
                ...mockSectionData,
                activities: ['activity-1', 'activity-2']
            };
            const duplicatedSection = {
                ...existingSection,
                id: 'duplicated-section-id',
                title: `${existingSection.title} (Copy)`,
                activities: ['duplicated-activity-1', 'duplicated-activity-2']
            };

            sectionRepository.findById.mockResolvedValue(existingSection);
            sectionRepository.create.mockResolvedValue(duplicatedSection);
            sectionRepository.duplicateActivities.mockResolvedValue([
                'duplicated-activity-1',
                'duplicated-activity-2'
            ]);
            cacheService.set.mockResolvedValue();

            const result = await sectionService.duplicateSection(
                sectionId,
                userId,
                true // includeActivities
            );

            expect(sectionRepository.duplicateActivities).toHaveBeenCalledWith(
                ['activity-1', 'activity-2'],
                'duplicated-section-id'
            );
            expect(result.activities).toHaveLength(2);
        });
    });
});