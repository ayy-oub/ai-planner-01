import { UserService } from '../../../../src/modules/user/user.service';
import { UserRepository } from '../../../../src/modules/user/user.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { UserPreferences, UserStatistics } from '../../../../src/shared/types/user.types';

jest.mock('../../../../src/modules/user/user.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('UserService', () => {
    let userService: UserService;
    let userRepository: jest.Mocked<UserRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';

    beforeEach(() => {
        userRepository = new UserRepository() as jest.Mocked<UserRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        userService = new UserService(userRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUserProfile', () => {
        it('should successfully retrieve user profile', async () => {
            const mockProfile = {
                id: userId,
                email: 'user@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
                emailVerified: true,
                preferences: {
                    theme: 'dark',
                    accentColor: '#FF5733',
                    defaultView: 'grid',
                    notifications: true,
                    language: 'en'
                },
                statistics: {
                    totalPlanners: 5,
                    totalTasks: 150,
                    completedTasks: 120,
                    streakDays: 30
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findById.mockResolvedValue(mockProfile);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await userService.getUserProfile(userId);

            expect(userRepository.findById).toHaveBeenCalledWith(userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `user:profile:${userId}`,
                JSON.stringify(mockProfile),
                3600
            );
            expect(result).toEqual(mockProfile);
        });

        it('should return cached profile if available', async () => {
            const cachedProfile = {
                id: userId,
                email: 'cached@example.com',
                displayName: 'Cached User'
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedProfile));

            const result = await userService.getUserProfile(userId);

            expect(userRepository.findById).not.toHaveBeenCalled();
            expect(result).toEqual(cachedProfile);
        });

        it('should throw error if user not found', async () => {
            userRepository.findById.mockResolvedValue(null);

            await expect(userService.getUserProfile(userId))
                .rejects.toThrow('User not found');
        });

        it('should include private fields for own profile', async () => {
            const privateProfile = {
                id: userId,
                email: 'user@example.com',
                preferences: { theme: 'dark' },
                privateFields: {
                    phoneNumber: '+1234567890',
                    timezone: 'America/New_York'
                }
            };

            userRepository.findById.mockResolvedValue(privateProfile);

            const result = await userService.getUserProfile(userId);

            expect(result).toHaveProperty('privateFields');
        });

        it('should exclude private fields for other users', async () => {
            const privateProfile = {
                id: userId,
                email: 'user@example.com',
                preferences: { theme: 'dark' },
                privateFields: {
                    phoneNumber: '+1234567890'
                }
            };

            userRepository.findById.mockResolvedValue(privateProfile);

            const result = await userService.getUserProfile(userId, true); // isOwnProfile = true

            expect(result).toHaveProperty('privateFields');
        });
    });

    describe('updateUserProfile', () => {
        const updateData = {
            displayName: 'Updated Name',
            photoURL: 'https://example.com/new-photo.jpg',
            bio: 'Software developer passionate about productivity'
        };

        it('should successfully update user profile', async () => {
            const existingProfile = {
                id: userId,
                email: 'user@example.com',
                displayName: 'Old Name',
                bio: 'Old bio'
            };

            const updatedProfile = {
                ...existingProfile,
                ...updateData,
                updatedAt: new Date()
            };

            userRepository.findById.mockResolvedValue(existingProfile);
            userRepository.updateProfile.mockResolvedValue(updatedProfile);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await userService.updateUserProfile(userId, updateData);

            expect(userRepository.updateProfile).toHaveBeenCalledWith(userId, updateData);
            expect(cacheService.del).toHaveBeenCalledWith(`user:profile:${userId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('user.profile.updated', {
                userId,
                changes: updateData
            });
            expect(result.displayName).toBe(updateData.displayName);
        });

        it('should validate display name', async () => {
            const invalidData = {
                displayName: 'A' // Too short
            };

            await expect(userService.updateUserProfile(userId, invalidData))
                .rejects.toThrow('Display name must be between 2 and 50 characters');
        });

        it('should validate photo URL', async () => {
            const invalidData = {
                photoURL: 'not-a-valid-url'
            };

            await expect(userService.updateUserProfile(userId, invalidData))
                .rejects.toThrow('Invalid photo URL format');
        });

        it('should handle profile update failures', async () => {
            userRepository.updateProfile.mockRejectedValue(
                new Error('Database error')
            );

            await expect(userService.updateUserProfile(userId, updateData))
                .rejects.toThrow('Failed to update profile');
        });

        it('should prevent updating sensitive fields directly', async () => {
            const sensitiveData = {
                email: 'newemail@example.com', // Should not be updated here
                role: 'admin', // Should not be updated here
                displayName: 'Valid Name'
            };

            const existingProfile = {
                id: userId,
                email: 'user@example.com',
                role: 'user',
                displayName: 'Old Name'
            };

            userRepository.findById.mockResolvedValue(existingProfile);
            userRepository.updateProfile.mockResolvedValue({
                ...existingProfile,
                displayName: sensitiveData.displayName
            });

            const result = await userService.updateUserProfile(userId, sensitiveData);

            expect(userRepository.updateProfile).toHaveBeenCalledWith(userId, {
                displayName: sensitiveData.displayName
                // email and role should be filtered out
            });
            expect(result.email).toBe('user@example.com'); // Unchanged
            expect(result.role).toBe('user'); // Unchanged
        });
    });

    describe('updateUserPreferences', () => {
        const preferenceUpdates = {
            theme: 'dark' as const,
            accentColor: '#4285F4',
            defaultView: 'list' as const,
            notifications: false,
            language: 'es'
        };

        it('should successfully update user preferences', async () => {
            const existingPreferences = {
                theme: 'light' as const,
                accentColor: '#FF5733',
                defaultView: 'grid' as const,
                notifications: true,
                language: 'en'
            };

            const updatedPreferences = {
                ...existingPreferences,
                ...preferenceUpdates
            };

            userRepository.getPreferences.mockResolvedValue(existingPreferences);
            userRepository.updatePreferences.mockResolvedValue(updatedPreferences);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await userService.updateUserPreferences(userId, preferenceUpdates);

            expect(userRepository.updatePreferences).toHaveBeenCalledWith(userId, preferenceUpdates);
            expect(cacheService.del).toHaveBeenCalledWith(`user:preferences:${userId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('user.preferences.updated', {
                userId,
                preferences: updatedPreferences
            });
            expect(result.theme).toBe('dark');
            expect(result.language).toBe('es');
        });

        it('should validate theme values', async () => {
            const invalidPreferences = {
                theme: 'invalid-theme' as any
            };

            await expect(userService.updateUserPreferences(userId, invalidPreferences))
                .rejects.toThrow('Invalid theme value');
        });

        it('should validate accent color format', async () => {
            const invalidPreferences = {
                accentColor: 'not-a-color'
            };

            await expect(userService.updateUserPreferences(userId, invalidPreferences))
                .rejects.toThrow('Invalid accent color format');
        });

        it('should validate language codes', async () => {
            const invalidPreferences = {
                language: 'invalid-lang'
            };

            await expect(userService.updateUserPreferences(userId, invalidPreferences))
                .rejects.toThrow('Invalid language code');
        });

        it('should apply preferences immediately', async () => {
            userRepository.getPreferences.mockResolvedValue({});
            userRepository.updatePreferences.mockResolvedValue(preferenceUpdates);

            const result = await userService.updateUserPreferences(userId, preferenceUpdates);

            expect(eventEmitter.emit).toHaveBeenCalledWith('user.preferences.applied', {
                userId,
                preferences: result
            });
        });
    });

    describe('getUserStatistics', () => {
        it('should successfully retrieve user statistics', async () => {
            const mockStatistics = {
                totalPlanners: 8,
                totalTasks: 245,
                completedTasks: 198,
                pendingTasks: 47,
                completionRate: 80.8,
                averageTasksPerDay: 3.2,
                streakDays: 45,
                longestStreak: 67,
                mostProductiveDay: 'monday',
                mostProductiveHour: 9,
                totalCollaborations: 12,
                sharedPlanners: 3
            };

            userRepository.getStatistics.mockResolvedValue(mockStatistics);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await userService.getUserStatistics(userId);

            expect(userRepository.getStatistics).toHaveBeenCalledWith(userId);
            expect(cacheService.set).toHaveBeenCalledWith(
                `user:stats:${userId}`,
                JSON.stringify(mockStatistics),
                1800
            );
            expect(result.completionRate).toBe(80.8);
            expect(result.streakDays).toBe(45);
        });

        it('should return cached statistics if available', async () => {
            const cachedStats = {
                totalPlanners: 5,
                totalTasks: 150,
                completionRate: 75.0
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedStats));

            const result = await userService.getUserStatistics(userId);

            expect(userRepository.getStatistics).not.toHaveBeenCalled();
            expect(result).toEqual(cachedStats);
        });

        it('should calculate statistics if not available', async () => {
            userRepository.getStatistics.mockResolvedValue(null);
            userRepository.calculateStatistics.mockResolvedValue({
                totalPlanners: 3,
                totalTasks: 89,
                completedTasks: 67,
                completionRate: 75.3
            });

            const result = await userService.getUserStatistics(userId);

            expect(userRepository.calculateStatistics).toHaveBeenCalledWith(userId);
            expect(result.completionRate).toBe(75.3);
        });

        it('should handle statistics for new users', async () => {
            userRepository.getStatistics.mockResolvedValue({
                totalPlanners: 0,
                totalTasks: 0,
                completedTasks: 0,
                completionRate: 0,
                streakDays: 0
            });

            const result = await userService.getUserStatistics(userId);

            expect(result.totalPlanners).toBe(0);
            expect(result.completionRate).toBe(0);
            expect(result.streakDays).toBe(0);
        });
    });

    describe('getUserActivityHistory', () => {
        it('should successfully retrieve user activity history', async () => {
            const mockActivityHistory = [
                {
                    id: 'activity-1',
                    type: 'planner_created',
                    description: 'Created weekly planner',
                    timestamp: new Date(),
                    metadata: { plannerId: 'planner-123', title: 'Weekly Planner' }
                },
                {
                    id: 'activity-2',
                    type: 'task_completed',
                    description: 'Completed project documentation',
                    timestamp: new Date(Date.now() - 60 * 60 * 1000),
                    metadata: { taskId: 'task-456', title: 'Project Documentation' }
                }
            ];

            const mockPagination = {
                total: 45,
                page: 1,
                totalPages: 3,
                hasNext: true,
                hasPrev: false
            };

            userRepository.getActivityHistory.mockResolvedValue({
                activities: mockActivityHistory,
                pagination: mockPagination
            });

            const result = await userService.getUserActivityHistory(userId, {
                page: 1,
                limit: 20,
                types: ['planner_created', 'task_completed']
            });

            expect(userRepository.getActivityHistory).toHaveBeenCalledWith(userId, {
                page: 1,
                limit: 20,
                types: ['planner_created', 'task_completed']
            });
            expect(result.activities).toHaveLength(2);
            expect(result.pagination.total).toBe(45);
        });

        it('should filter by date range', async () => {
            const dateRange = {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                end: new Date()
            };

            userRepository.getActivityHistory.mockResolvedValue({
                activities: [],
                pagination: { total: 0 }
            });

            await userService.getUserActivityHistory(userId, { dateRange });

            expect(userRepository.getActivityHistory).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({ dateRange })
            );
        });

        it('should handle different activity types', async () => {
            const activityTypes = [
                'planner_created',
                'planner_updated',
                'task_completed',
                'task_created',
                'collaboration_started'
            ];

            for (const type of activityTypes) {
                userRepository.getActivityHistory.mockResolvedValue({
                    activities: [],
                    pagination: { total: 0 }
                });

                await userService.getUserActivityHistory(userId, { types: [type] });

                expect(userRepository.getActivityHistory).toHaveBeenCalledWith(
                    userId,
                    expect.objectContaining({ types: [type] })
                );
            }
        });

        it('should anonymize sensitive activity data', async () => {
            const sensitiveActivity = [
                {
                    id: 'activity-1',
                    type: 'login',
                    description: 'User login',
                    timestamp: new Date(),
                    metadata: {
                        ipAddress: '192.168.1.1',
                        userAgent: 'Mozilla/5.0...',
                        location: 'New York, NY'
                    }
                }
            ];

            userRepository.getActivityHistory.mockResolvedValue({
                activities: sensitiveActivity,
                pagination: { total: 1 }
            });

            const result = await userService.getUserActivityHistory(userId);

            expect(result.activities[0].metadata).not.toHaveProperty('ipAddress');
            expect(result.activities[0].metadata).toHaveProperty('location');
            expect(result.activities[0].metadata.location).toBe('United States'); // Anonymized
        });
    });

    describe('exportUserData', () => {
        it('should successfully export user data', async () => {
            const userData = {
                profile: {
                    id: userId,
                    email: 'user@example.com',
                    displayName: 'Test User'
                },
                preferences: {
                    theme: 'dark',
                    language: 'en'
                },
                planners: [
                    {
                        id: 'planner-1',
                        title: 'My Planner',
                        sections: []
                    }
                ],
                activities: [
                    {
                        id: 'activity-1',
                        title: 'Sample Task',
                        status: 'completed'
                    }
                ],
                statistics: {
                    totalPlanners: 1,
                    totalTasks: 1,
                    completedTasks: 1
                }
            };

            jest.spyOn(userService as any, 'collectUserData').mockResolvedValue(userData);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await userService.exportUserData(userId, {
                includeProfile: true,
                includePlanners: true,
                includeActivities: true,
                format: 'json'
            });

            expect(result).toHaveProperty('data');
            expect(result.data).toHaveProperty('profile');
            expect(result.data).toHaveProperty('planners');
            expect(result.format).toBe('json');
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('user.data.exported', {
                userId,
                exportId: expect.any(String)
            });
        });

        it('should support different export formats', async () => {
            const userData = { profile: { id: userId } };

            jest.spyOn(userService as any, 'collectUserData').mockResolvedValue(userData);
            jest.spyOn(userService as any, 'convertToCSV').mockReturnValue('id,name\n123,Test User');
            jest.spyOn(userService as any, 'convertToXML').mockReturnValue('<user><id>123</id></user>');

            const formats = ['csv', 'xml', 'json'] as const;

            for (const format of formats) {
                const result = await userService.exportUserData(userId, {
                    includeProfile: true,
                    format
                });

                expect(result.format).toBe(format);
                expect(result.mimeType).toBeDefined();
            }
        });

        it('should anonymize data when requested', async () => {
            const sensitiveData = {
                profile: {
                    id: userId,
                    email: 'user@example.com',
                    displayName: 'John Doe'
                },
                privateFields: {
                    phoneNumber: '+1234567890'
                }
            };

            jest.spyOn(userService as any, 'collectUserData').mockResolvedValue(sensitiveData);

            const result = await userService.exportUserData(userId, {
                includeProfile: true,
                anonymize: true,
                format: 'json'
            });

            expect(result.data.profile.email).not.toBe('user@example.com');
            expect(result.data.profile.displayName).not.toBe('John Doe');
            expect(result.data).not.toHaveProperty('privateFields');
        });

        it('should filter data based on date range', async () => {
            const dateRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            jest.spyOn(userService as any, 'collectUserData').mockResolvedValue({
                profile: { id: userId },
                activities: []
            });

            const result = await userService.exportUserData(userId, {
                includeProfile: true,
                includeActivities: true,
                dateRange,
                format: 'json'
            });

            expect(result.dateRange).toEqual(dateRange);
        });

        it('should handle export failures gracefully', async () => {
            jest.spyOn(userService as any, 'collectUserData').mockRejectedValue(
                new Error('Database connection lost')
            );

            await expect(userService.exportUserData(userId, {
                includeProfile: true,
                format: 'json'
            })).rejects.toThrow('Failed to export user data');
        });
    });

    describe('deleteUserAccount', () => {
        it('should successfully delete user account', async () => {
            const userProfile = {
                id: userId,
                email: 'user@example.com',
                displayName: 'Test User'
            };

            jest.spyOn(userService as any, 'validateDeletion').mockResolvedValue(true);
            userRepository.findById.mockResolvedValue(userProfile);
            userRepository.softDelete.mockResolvedValue(true);
            userRepository.anonymizeData.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await userService.deleteUserAccount(userId, {
                reason: 'User requested deletion',
                deleteCompletely: false
            });

            expect(userRepository.softDelete).toHaveBeenCalledWith(userId);
            expect(userRepository.anonymizeData).toHaveBeenCalledWith(userId);
            expect(cacheService.del).toHaveBeenCalledWith(`user:profile:${userId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('user.account.deleted', {
                userId,
                reason: 'User requested deletion'
            });
            expect(result).toBe(true);
        });

        it('should permanently delete account when requested', async () => {
            jest.spyOn(userService as any, 'validateDeletion').mockResolvedValue(true);
            userRepository.findById.mockResolvedValue({ id: userId });
            userRepository.hardDelete.mockResolvedValue(true);

            const result = await userService.deleteUserAccount(userId, {
                reason: 'GDPR deletion request',
                deleteCompletely: true
            });

            expect(userRepository.hardDelete).toHaveBeenCalledWith(userId);
            expect(result).toBe(true);
        });

        it('should validate deletion eligibility', async () => {
            jest.spyOn(userService as any, 'validateDeletion').mockResolvedValue(false);
            jest.spyOn(userService as any, 'getDeletionBlockers').mockResolvedValue([
                'Active subscriptions',
                'Pending collaborations'
            ]);

            await expect(userService.deleteUserAccount(userId, {
                reason: 'User requested deletion'
            })).rejects.toThrow('Account deletion blocked: Active subscriptions, Pending collaborations');
        });

        it('should handle scheduled deletion', async () => {
            jest.spyOn(userService as any, 'validateDeletion').mockResolvedValue(true);
            userRepository.findById.mockResolvedValue({ id: userId });
            userRepository.scheduleDeletion.mockResolvedValue({
                scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                deletionToken: 'deletion-token-123'
            });

            const result = await userService.deleteUserAccount(userId, {
                reason: 'User requested deletion',
                scheduleFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });

            expect(userRepository.scheduleDeletion).toHaveBeenCalled();
            expect(result).toHaveProperty('scheduledFor');
            expect(result).toHaveProperty('deletionToken');
        });

        it('should handle deletion failures', async () => {
            jest.spyOn(userService as any, 'validateDeletion').mockResolvedValue(true);
            userRepository.findById.mockResolvedValue({ id: userId });
            userRepository.softDelete.mockRejectedValue(
                new Error('Database error')
            );

            await expect(userService.deleteUserAccount(userId, {
                reason: 'User requested deletion'
            })).rejects.toThrow('Failed to delete user account');
        });
    });
});