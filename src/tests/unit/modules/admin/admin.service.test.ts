import { AdminService } from '../../../../src/modules/admin/admin.service';
import { AdminRepository } from '../../../../src/modules/admin/admin.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { UserRole } from '../../../../src/shared/types/auth.types';
import { UserStatus, UserPlan } from '../../../../src/shared/types/admin.types';

jest.mock('../../../../src/modules/admin/admin.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('AdminService', () => {
    let adminService: AdminService;
    let adminRepository: jest.Mocked<AdminRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const adminUserId = 'admin-user-id';
    const targetUserId = 'target-user-id';

    beforeEach(() => {
        adminRepository = new AdminRepository() as jest.Mocked<AdminRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        adminService = new AdminService(adminRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getSystemStats', () => {
        it('should successfully retrieve system statistics', async () => {
            const mockStats = {
                totalUsers: 1250,
                activeUsers: 980,
                totalPlanners: 3450,
                totalActivities: 15600,
                systemHealth: {
                    database: 'healthy',
                    cache: 'healthy',
                    api: 'healthy'
                },
                performance: {
                    averageResponseTime: 245,
                    uptime: 99.8,
                    errorRate: 0.02
                },
                subscriptions: {
                    free: 800,
                    premium: 400,
                    enterprise: 50
                }
            };

            adminRepository.getSystemStats.mockResolvedValue(mockStats);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await adminService.getSystemStats(adminUserId);

            expect(adminRepository.getSystemStats).toHaveBeenCalled();
            expect(cacheService.set).toHaveBeenCalledWith(
                'admin:system:stats',
                JSON.stringify(mockStats),
                300
            );
            expect(result).toEqual(mockStats);
        });

        it('should return cached stats if available', async () => {
            const cachedStats = {
                totalUsers: 1000,
                activeUsers: 800,
                systemHealth: { status: 'cached' }
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedStats));

            const result = await adminService.getSystemStats(adminUserId);

            expect(adminRepository.getSystemStats).not.toHaveBeenCalled();
            expect(result).toEqual(cachedStats);
        });

        it('should validate admin permissions', async () => {
            adminRepository.validateAdminPermissions.mockResolvedValue(false);

            await expect(adminService.getSystemStats('regular-user-id'))
                .rejects.toThrow('Insufficient permissions');
        });
    });

    describe('getUserManagementData', () => {
        it('should successfully retrieve user management data', async () => {
            const mockUsers = [
                {
                    id: 'user-1',
                    email: 'user1@example.com',
                    displayName: 'User One',
                    role: UserRole.USER,
                    status: UserStatus.ACTIVE,
                    plan: UserPlan.FREE,
                    createdAt: new Date(),
                    lastLogin: new Date()
                },
                {
                    id: 'user-2',
                    email: 'user2@example.com',
                    displayName: 'User Two',
                    role: UserRole.USER,
                    status: UserStatus.ACTIVE,
                    plan: UserPlan.PREMIUM,
                    createdAt: new Date(),
                    lastLogin: new Date()
                }
            ];

            const mockPagination = {
                total: 1250,
                page: 1,
                totalPages: 63,
                hasNext: true,
                hasPrev: false
            };

            adminRepository.getUsers.mockResolvedValue({ users: mockUsers, pagination: mockPagination });
            cacheService.set.mockResolvedValue();

            const result = await adminService.getUserManagementData(adminUserId, {
                page: 1,
                limit: 20,
                filter: { status: UserStatus.ACTIVE }
            });

            expect(adminRepository.getUsers).toHaveBeenCalledWith({
                page: 1,
                limit: 20,
                filter: { status: UserStatus.ACTIVE }
            });
            expect(result.users).toHaveLength(2);
            expect(result.pagination.total).toBe(1250);
        });

        it('should support different filter criteria', async () => {
            const filters = [
                { role: UserRole.USER },
                { plan: UserPlan.PREMIUM },
                { status: UserStatus.SUSPENDED },
                { emailVerified: true }
            ];

            for (const filter of filters) {
                adminRepository.getUsers.mockResolvedValue({ users: [], pagination: { total: 0 } });

                await adminService.getUserManagementData(adminUserId, { filter });

                expect(adminRepository.getUsers).toHaveBeenCalledWith(
                    expect.objectContaining({ filter })
                );
            }
        });

        it('should handle search queries', async () => {
            const searchQuery = 'john@example.com';

            adminRepository.searchUsers.mockResolvedValue({
                users: [{
                    id: 'user-123',
                    email: 'john@example.com',
                    displayName: 'John Doe'
                }],
                pagination: { total: 1 }
            });

            const result = await adminService.getUserManagementData(adminUserId, {
                search: searchQuery
            });

            expect(adminRepository.searchUsers).toHaveBeenCalledWith(searchQuery);
            expect(result.users[0].email).toBe(searchQuery);
        });
    });

    describe('updateUserStatus', () => {
        it('should successfully update user status', async () => {
            const existingUser = {
                id: targetUserId,
                email: 'user@example.com',
                status: UserStatus.ACTIVE
            };

            const updatedUser = {
                ...existingUser,
                status: UserStatus.SUSPENDED,
                suspendedAt: new Date(),
                suspendedBy: adminUserId
            };

            adminRepository.findUserById.mockResolvedValue(existingUser);
            adminRepository.updateUserStatus.mockResolvedValue(updatedUser);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await adminService.updateUserStatus(
                adminUserId,
                targetUserId,
                UserStatus.SUSPENDED,
                'Violation of terms of service'
            );

            expect(adminRepository.findUserById).toHaveBeenCalledWith(targetUserId);
            expect(adminRepository.updateUserStatus).toHaveBeenCalledWith(
                targetUserId,
                UserStatus.SUSPENDED,
                {
                    reason: 'Violation of terms of service',
                    suspendedBy: adminUserId
                }
            );
            expect(cacheService.del).toHaveBeenCalledWith(`user:${targetUserId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.user.suspended', {
                userId: targetUserId,
                suspendedBy: adminUserId,
                reason: 'Violation of terms of service'
            });
            expect(result.status).toBe(UserStatus.SUSPENDED);
        });

        it('should prevent self-suspension', async () => {
            await expect(
                adminService.updateUserStatus(adminUserId, adminUserId, UserStatus.SUSPENDED)
            ).rejects.toThrow('Cannot modify your own account status');
        });

        it('should validate status transitions', async () => {
            const existingUser = {
                id: targetUserId,
                status: UserStatus.SUSPENDED
            };

            adminRepository.findUserById.mockResolvedValue(existingUser);

            await expect(
                adminService.updateUserStatus(adminUserId, targetUserId, UserStatus.SUSPENDED)
            ).rejects.toThrow('User is already suspended');
        });

        it('should handle reactivation with proper validation', async () => {
            const suspendedUser = {
                id: targetUserId,
                status: UserStatus.SUSPENDED,
                suspendedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
            };

            const reactivatedUser = {
                ...suspendedUser,
                status: UserStatus.ACTIVE,
                reactivatedAt: new Date(),
                reactivatedBy: adminUserId
            };

            adminRepository.findUserById.mockResolvedValue(suspendedUser);
            adminRepository.updateUserStatus.mockResolvedValue(reactivatedUser);

            const result = await adminService.updateUserStatus(
                adminUserId,
                targetUserId,
                UserStatus.ACTIVE,
                'Suspension period completed'
            );

            expect(result.status).toBe(UserStatus.ACTIVE);
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.user.reactivated', {
                userId: targetUserId,
                reactivatedBy: adminUserId
            });
        });
    });

    describe('updateUserRole', () => {
        it('should successfully update user role', async () => {
            const existingUser = {
                id: targetUserId,
                email: 'user@example.com',
                role: UserRole.USER
            };

            const updatedUser = {
                ...existingUser,
                role: UserRole.MODERATOR,
                roleUpdatedAt: new Date(),
                roleUpdatedBy: adminUserId
            };

            adminRepository.findUserById.mockResolvedValue(existingUser);
            adminRepository.updateUserRole.mockResolvedValue(updatedUser);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await adminService.updateUserRole(
                adminUserId,
                targetUserId,
                UserRole.MODERATOR
            );

            expect(adminRepository.updateUserRole).toHaveBeenCalledWith(
                targetUserId,
                UserRole.MODERATOR,
                adminUserId
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.user.role.updated', {
                userId: targetUserId,
                oldRole: UserRole.USER,
                newRole: UserRole.MODERATOR,
                updatedBy: adminUserId
            });
            expect(result.role).toBe(UserRole.MODERATOR);
        });

        it('should prevent role escalation without proper permissions', async () => {
            adminRepository.validateRoleUpdatePermissions.mockResolvedValue(false);

            await expect(
                adminService.updateUserRole(adminUserId, targetUserId, UserRole.ADMIN)
            ).rejects.toThrow('Insufficient permissions to assign admin role');
        });

        it('should handle role-specific permissions', async () => {
            const existingUser = {
                id: targetUserId,
                role: UserRole.USER
            };

            adminRepository.findUserById.mockResolvedValue(existingUser);
            adminRepository.updateUserRole.mockResolvedValue({
                ...existingUser,
                role: UserRole.MODERATOR
            });

            const result = await adminService.updateUserRole(
                adminUserId,
                targetUserId,
                UserRole.MODERATOR
            );

            expect(adminRepository.updateUserPermissions).toHaveBeenCalledWith(
                targetUserId,
                expect.objectContaining({
                    canModerateContent: true,
                    canViewReports: true
                })
            );
        });
    });

    describe('getSystemLogs', () => {
        it('should successfully retrieve system logs', async () => {
            const mockLogs = [
                {
                    id: 'log-1',
                    timestamp: new Date(),
                    level: 'error',
                    message: 'Database connection failed',
                    context: { userId: 'user-123', action: 'login' },
                    source: 'auth.service'
                },
                {
                    id: 'log-2',
                    timestamp: new Date(),
                    level: 'warn',
                    message: 'High memory usage detected',
                    context: { memoryUsage: '85%' },
                    source: 'system.monitor'
                }
            ];

            const mockPagination = {
                total: 450,
                page: 1,
                totalPages: 23,
                hasNext: true
            };

            adminRepository.getSystemLogs.mockResolvedValue({ logs: mockLogs, pagination: mockPagination });

            const result = await adminService.getSystemLogs(adminUserId, {
                level: 'error',
                timeRange: {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date()
                },
                page: 1,
                limit: 20
            });

            expect(adminRepository.getSystemLogs).toHaveBeenCalledWith({
                level: 'error',
                timeRange: expect.any(Object),
                page: 1,
                limit: 20
            });
            expect(result.logs).toHaveLength(2);
            expect(result.pagination.total).toBe(450);
        });

        it('should support different log levels', async () => {
            const logLevels = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

            for (const level of logLevels) {
                adminRepository.getSystemLogs.mockResolvedValue({ logs: [], pagination: { total: 0 } });

                await adminService.getSystemLogs(adminUserId, { level });

                expect(adminRepository.getSystemLogs).toHaveBeenCalledWith(
                    expect.objectContaining({ level })
                );
            }
        });

        it('should filter by source component', async () => {
            adminRepository.getSystemLogs.mockResolvedValue({ logs: [], pagination: { total: 0 } });

            await adminService.getSystemLogs(adminUserId, {
                source: 'auth.service'
            });

            expect(adminRepository.getSystemLogs).toHaveBeenCalledWith(
                expect.objectContaining({ source: 'auth.service' })
            );
        });

        it('should handle log export requests', async () => {
            const mockLogs = [
                { timestamp: new Date(), level: 'info', message: 'System started' },
                { timestamp: new Date(), level: 'error', message: 'Error occurred' }
            ];

            adminRepository.getSystemLogs.mockResolvedValue({ logs: mockLogs, pagination: { total: 2 } });
            jest.spyOn(adminService as any, 'exportLogsToFile').mockResolvedValue({
                fileName: 'system-logs.json',
                content: JSON.stringify(mockLogs)
            });

            const result = await adminService.getSystemLogs(adminUserId, {
                exportFormat: 'json'
            });

            expect(result).toHaveProperty('fileName', 'system-logs.json');
            expect(result).toHaveProperty('content');
        });
    });

    describe('performSystemMaintenance', () => {
        it('should successfully perform system maintenance', async () => {
            const maintenanceTasks = {
                cleanupOldLogs: true,
                optimizeDatabase: true,
                clearExpiredCache: true,
                archiveOldData: false
            };

            const mockResults = {
                cleanupOldLogs: { deleted: 1250, spaceFreed: '500MB' },
                optimizeDatabase: { tablesOptimized: 15, performanceImprovement: '15%' },
                clearExpiredCache: { entriesCleared: 5000 },
                archiveOldData: { skipped: true }
            };

            adminRepository.performMaintenance.mockResolvedValue(mockResults);
            cacheService.flush.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await adminService.performSystemMaintenance(adminUserId, maintenanceTasks);

            expect(adminRepository.performMaintenance).toHaveBeenCalledWith(maintenanceTasks);
            expect(cacheService.flush).toHaveBeenCalledWith('expired');
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.maintenance.completed', {
                adminId: adminUserId,
                tasks: maintenanceTasks,
                results: mockResults
            });
            expect(result).toEqual(mockResults);
        });

        it('should validate maintenance permissions', async () => {
            adminRepository.validateMaintenancePermissions.mockResolvedValue(false);

            await expect(adminService.performSystemMaintenance('regular-user-id', {}))
                .rejects.toThrow('Insufficient permissions for system maintenance');
        });

        it('should handle maintenance failures gracefully', async () => {
            const maintenanceTasks = {
                cleanupOldLogs: true,
                optimizeDatabase: true
            };

            adminRepository.performMaintenance.mockRejectedValue(
                new Error('Database connection lost')
            );

            await expect(adminService.performSystemMaintenance(adminUserId, maintenanceTasks))
                .rejects.toThrow('System maintenance failed');
        });

        it('should schedule maintenance tasks', async () => {
            const scheduledTasks = {
                cleanupOldLogs: { schedule: '0 2 * * *' }, // Daily at 2 AM
                optimizeDatabase: { schedule: '0 3 * * 0' }, // Weekly on Sunday at 3 AM
                clearExpiredCache: { schedule: '*/6 * * * *' } // Every 6 hours
            };

            adminRepository.scheduleMaintenance.mockResolvedValue({
                scheduled: 3,
                tasks: scheduledTasks
            });

            const result = await adminService.performSystemMaintenance(adminUserId, scheduledTasks);

            expect(adminRepository.scheduleMaintenance).toHaveBeenCalledWith(scheduledTasks);
            expect(result.scheduled).toBe(3);
        });
    });

    describe('getAnalyticsData', () => {
        it('should successfully retrieve analytics data', async () => {
            const mockAnalytics = {
                userGrowth: {
                    daily: [50, 65, 70, 80, 90],
                    weekly: [350, 420, 480, 520],
                    monthly: [1200, 1500, 1800, 2100]
                },
                engagement: {
                    dailyActiveUsers: 850,
                    weeklyActiveUsers: 1200,
                    monthlyActiveUsers: 1800,
                    averageSessionDuration: 25.5,
                    bounceRate: 0.35
                },
                featureUsage: {
                    plannersCreated: 450,
                    activitiesCompleted: 2300,
                    collaborations: 120,
                    exports: 89
                },
                performance: {
                    apiResponseTime: 245,
                    errorRate: 0.02,
                    uptime: 99.8
                }
            };

            const dateRange = {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: new Date()
            };

            adminRepository.getAnalytics.mockResolvedValue(mockAnalytics);
            cacheService.set.mockResolvedValue();

            const result = await adminService.getAnalyticsData(adminUserId, dateRange, {
                metrics: ['userGrowth', 'engagement', 'featureUsage']
            });

            expect(adminRepository.getAnalytics).toHaveBeenCalledWith(dateRange, {
                metrics: ['userGrowth', 'engagement', 'featureUsage']
            });
            expect(cacheService.set).toHaveBeenCalledWith(
                `admin:analytics:${JSON.stringify(dateRange)}`,
                JSON.stringify(mockAnalytics),
                1800
            );
            expect(result).toEqual(mockAnalytics);
        });

        it('should support real-time analytics', async () => {
            const realTimeData = {
                activeUsers: 245,
                newRegistrations: 12,
                plannerCreations: 8,
                activityCompletions: 156,
                apiCalls: 12450
            };

            adminRepository.getRealTimeAnalytics.mockResolvedValue(realTimeData);

            const result = await adminService.getAnalyticsData(adminUserId, {
                realTime: true
            });

            expect(result).toEqual(realTimeData);
            expect(adminRepository.getRealTimeAnalytics).toHaveBeenCalled();
        });

        it('should generate custom reports', async () => {
            const customMetrics = ['userRetention', 'featureAdoption', 'revenue'];
            const dateRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            jest.spyOn(adminService as any, 'generateCustomReport').mockResolvedValue({
                reportId: 'custom-report-123',
                metrics: customMetrics,
                data: { /* custom data */ }
            });

            const result = await adminService.getAnalyticsData(adminUserId, dateRange, {
                metrics: customMetrics,
                custom: true
            });

            expect(result).toHaveProperty('reportId', 'custom-report-123');
            expect(result.metrics).toEqual(customMetrics);
        });
    });

    describe('manageFeatureFlags', () => {
        it('should successfully create feature flag', async () => {
            const featureFlag = {
                name: 'new_dashboard',
                description: 'New dashboard design',
                enabled: false,
                rolloutPercentage: 0,
                targetGroups: ['beta_users'],
                metadata: {
                    version: '1.0.0',
                    createdBy: adminUserId
                }
            };

            adminRepository.createFeatureFlag.mockResolvedValue({
                ...featureFlag,
                id: 'flag-123',
                createdAt: new Date()
            });
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await adminService.manageFeatureFlags(adminUserId, 'create', featureFlag);

            expect(adminRepository.createFeatureFlag).toHaveBeenCalledWith(featureFlag);
            expect(cacheService.del).toHaveBeenCalledWith('feature:flags');
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.feature_flag.created', {
                flag: result,
                createdBy: adminUserId
            });
            expect(result.name).toBe('new_dashboard');
        });

        it('should successfully update feature flag', async () => {
            const existingFlag = {
                id: 'flag-123',
                name: 'new_dashboard',
                enabled: false,
                rolloutPercentage: 0
            };

            const updateData = {
                enabled: true,
                rolloutPercentage: 25
            };

            adminRepository.findFeatureFlag.mockResolvedValue(existingFlag);
            adminRepository.updateFeatureFlag.mockResolvedValue({
                ...existingFlag,
                ...updateData
            });
            cacheService.del.mockResolvedValue();

            const result = await adminService.manageFeatureFlags(adminUserId, 'update', {
                id: 'flag-123',
                ...updateData
            });

            expect(adminRepository.updateFeatureFlag).toHaveBeenCalledWith('flag-123', updateData);
            expect(result.enabled).toBe(true);
            expect(result.rolloutPercentage).toBe(25);
        });

        it('should successfully delete feature flag', async () => {
            const existingFlag = {
                id: 'flag-123',
                name: 'old_feature'
            };

            adminRepository.findFeatureFlag.mockResolvedValue(existingFlag);
            adminRepository.deleteFeatureFlag.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();

            const result = await adminService.manageFeatureFlags(adminUserId, 'delete', {
                id: 'flag-123'
            });

            expect(adminRepository.deleteFeatureFlag).toHaveBeenCalledWith('flag-123');
            expect(result).toBe(true);
        });

        it('should list all feature flags', async () => {
            const mockFlags = [
                {
                    id: 'flag-1',
                    name: 'feature_one',
                    enabled: true,
                    rolloutPercentage: 100
                },
                {
                    id: 'flag-2',
                    name: 'feature_two',
                    enabled: false,
                    rolloutPercentage: 0
                }
            ];

            adminRepository.getFeatureFlags.mockResolvedValue(mockFlags);

            const result = await adminService.manageFeatureFlags(adminUserId, 'list');

            expect(result).toEqual(mockFlags);
            expect(adminRepository.getFeatureFlags).toHaveBeenCalled();
        });

        it('should validate feature flag data', async () => {
            const invalidFlag = {
                name: '', // Empty name
                description: 'Invalid flag',
                enabled: true,
                rolloutPercentage: 150 // Invalid percentage
            };

            await expect(adminService.manageFeatureFlags(adminUserId, 'create', invalidFlag))
                .rejects.toThrow('Invalid feature flag data');
        });
    });

    describe('sendSystemNotification', () => {
        it('should successfully send system notification', async () => {
            const notification = {
                title: 'System Maintenance',
                message: 'The system will undergo maintenance tonight at 2 AM UTC',
                type: 'info',
                targetAudience: 'all_users',
                priority: 'high',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            adminRepository.createSystemNotification.mockResolvedValue({
                ...notification,
                id: 'notification-123',
                createdAt: new Date(),
                createdBy: adminUserId
            });
            eventEmitter.emit.mockReturnValue();

            const result = await adminService.sendSystemNotification(adminUserId, notification);

            expect(adminRepository.createSystemNotification).toHaveBeenCalledWith({
                ...notification,
                createdBy: adminUserId
            });
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.notification.sent', {
                notification: result,
                createdBy: adminUserId
            });
            expect(result.id).toBe('notification-123');
        });

        it('should send targeted notifications', async () => {
            const targetedNotification = {
                title: 'Premium Feature Update',
                message: 'New premium features are now available',
                type: 'update',
                targetAudience: 'premium_users',
                priority: 'medium'
            };

            adminRepository.createSystemNotification.mockResolvedValue({
                ...targetedNotification,
                id: 'notification-456',
                createdBy: adminUserId
            });

            const result = await adminService.sendSystemNotification(adminUserId, targetedNotification);

            expect(result.targetAudience).toBe('premium_users');
            expect(eventEmitter.emit).toHaveBeenCalledWith('admin.notification.sent',
                expect.objectContaining({
                    notification: expect.objectContaining({
                        targetAudience: 'premium_users'
                    })
                })
            );
        });

        it('should schedule notifications', async () => {
            const scheduledNotification = {
                title: 'Scheduled Update',
                message: 'This is a scheduled notification',
                type: 'update',
                targetAudience: 'all_users',
                scheduledFor: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
            };

            adminRepository.scheduleNotification.mockResolvedValue({
                ...scheduledNotification,
                id: 'scheduled-123',
                status: 'scheduled'
            });

            const result = await adminService.sendSystemNotification(adminUserId, scheduledNotification);

            expect(result.status).toBe('scheduled');
            expect(adminRepository.scheduleNotification).toHaveBeenCalledWith(
                scheduledNotification
            );
        });

        it('should validate notification content', async () => {
            const invalidNotification = {
                title: '', // Empty title
                message: 'Valid message',
                type: 'invalid_type', // Invalid type
                targetAudience: 'invalid_audience'
            };

            await expect(adminService.sendSystemNotification(adminUserId, invalidNotification))
                .rejects.toThrow('Invalid notification data');
        });
    });
});