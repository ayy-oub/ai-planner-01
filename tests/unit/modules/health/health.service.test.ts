import { HealthService } from '../../../../src/modules/health/health.service';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { HealthStatus, HealthCheck } from '../../../../src/shared/types/health.types';

jest.mock('../../../../src/shared/services/cache.service');

describe('HealthService', () => {
    let healthService: HealthService;
    let cacheService: jest.Mocked<CacheService>;

    beforeEach(() => {
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        healthService = new HealthService(cacheService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getHealthStatus', () => {
        it('should return overall system health', async () => {
            const mockHealthStatus = {
                status: HealthStatus.HEALTHY,
                timestamp: new Date(),
                uptime: 86400000, // 24 hours
                version: '1.0.0',
                checks: {
                    database: {
                        status: HealthStatus.HEALTHY,
                        responseTime: 45,
                        lastCheck: new Date()
                    },
                    cache: {
                        status: HealthStatus.HEALTHY,
                        responseTime: 5,
                        lastCheck: new Date()
                    },
                    api: {
                        status: HealthStatus.HEALTHY,
                        responseTime: 25,
                        lastCheck: new Date()
                    }
                }
            };

            jest.spyOn(healthService as any, 'performHealthChecks').mockResolvedValue(mockHealthStatus.checks);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await healthService.getHealthStatus();

            expect(result.status).toBe(HealthStatus.HEALTHY);
            expect(result.checks).toHaveProperty('database');
            expect(result.checks).toHaveProperty('cache');
            expect(result.checks).toHaveProperty('api');
            expect(cacheService.set).toHaveBeenCalledWith(
                'health:status',
                JSON.stringify(result),
                60
            );
        });

        it('should return cached health status if available', async () => {
            const cachedStatus = {
                status: HealthStatus.HEALTHY,
                timestamp: new Date(Date.now() - 30 * 1000),
                checks: {}
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedStatus));

            const result = await healthService.getHealthStatus();

            expect(result).toEqual(cachedStatus);
        });

        it('should handle unhealthy system status', async () => {
            const unhealthyChecks = {
                database: {
                    status: HealthStatus.UNHEALTHY,
                    responseTime: 5000,
                    error: 'Connection timeout',
                    lastCheck: new Date()
                },
                cache: {
                    status: HealthStatus.HEALTHY,
                    responseTime: 5,
                    lastCheck: new Date()
                },
                api: {
                    status: HealthStatus.DEGRADED,
                    responseTime: 150,
                    lastCheck: new Date()
                }
            };

            jest.spyOn(healthService as any, 'performHealthChecks').mockResolvedValue(unhealthyChecks);

            const result = await healthService.getHealthStatus();

            expect(result.status).toBe(HealthStatus.UNHEALTHY);
            expect(result.checks.database.status).toBe(HealthStatus.UNHEALTHY);
            expect(result.checks.api.status).toBe(HealthStatus.DEGRADED);
        });

        it('should handle degraded system status', async () => {
            const degradedChecks = {
                database: {
                    status: HealthStatus.DEGRADED,
                    responseTime: 2000,
                    lastCheck: new Date()
                },
                cache: {
                    status: HealthStatus.HEALTHY,
                    responseTime: 5,
                    lastCheck: new Date()
                },
                api: {
                    status: HealthStatus.HEALTHY,
                    responseTime: 30,
                    lastCheck: new Date()
                }
            };

            jest.spyOn(healthService as any, 'performHealthChecks').mockResolvedValue(degradedChecks);

            const result = await healthService.getHealthStatus();

            expect(result.status).toBe(HealthStatus.DEGRADED);
            expect(result.checks.database.status).toBe(HealthStatus.DEGRADED);
        });
    });

    describe('getDetailedHealth', () => {
        it('should return detailed health information', async () => {
            const mockDetailedHealth = {
                status: HealthStatus.HEALTHY,
                timestamp: new Date(),
                system: {
                    platform: 'linux',
                    nodeVersion: 'v20.0.0',
                    memory: {
                        used: 150000000,
                        total: 4000000000,
                        percentage: 3.75
                    },
                    cpu: {
                        usage: 15.2,
                        cores: 4,
                        loadAverage: [0.5, 0.3, 0.2]
                    }
                },
                dependencies: {
                    database: {
                        status: HealthStatus.HEALTHY,
                        type: 'postgresql',
                        version: '14.5',
                        connectionPool: {
                            active: 5,
                            idle: 15,
                            total: 20
                        }
                    },
                    cache: {
                        status: HealthStatus.HEALTHY,
                        type: 'redis',
                        version: '7.0',
                        memory: {
                            used: 50000000,
                            peak: 75000000
                        }
                    }
                },
                services: {
                    api: {
                        status: HealthStatus.HEALTHY,
                        uptime: 86400000,
                        requestsPerMinute: 45,
                        errorRate: 0.01
                    },
                    workers: {
                        status: HealthStatus.HEALTHY,
                        active: 3,
                        queued: 12,
                        processed: 1250
                    }
                }
            };

            jest.spyOn(healthService as any, 'getSystemMetrics').mockResolvedValue(mockDetailedHealth.system);
            jest.spyOn(healthService as any, 'getDependencyHealth').mockResolvedValue(mockDetailedHealth.dependencies);
            jest.spyOn(healthService as any, 'getServiceHealth').mockResolvedValue(mockDetailedHealth.services);

            const result = await healthService.getDetailedHealth();

            expect(result).toHaveProperty('system');
            expect(result).toHaveProperty('dependencies');
            expect(result).toHaveProperty('services');
            expect(result.system.memory.percentage).toBe(3.75);
            expect(result.dependencies.database.connectionPool.active).toBe(5);
        });

        it('should handle missing dependencies gracefully', async () => {
            const partialHealth = {
                status: HealthStatus.DEGRADED,
                system: {},
                dependencies: {
                    database: null,
                    cache: {
                        status: HealthStatus.HEALTHY
                    }
                },
                services: {}
            };

            jest.spyOn(healthService as any, 'getSystemMetrics').mockResolvedValue({});
            jest.spyOn(healthService as any, 'getDependencyHealth').mockResolvedValue({
                database: null,
                cache: { status: HealthStatus.HEALTHY }
            });

            const result = await healthService.getDetailedHealth();

            expect(result.dependencies.database).toBeNull();
            expect(result.dependencies.cache.status).toBe(HealthStatus.HEALTHY);
        });
    });

    describe('getReadinessStatus', () => {
        it('should return readiness status', async () => {
            const mockReadiness = {
                status: HealthStatus.READY,
                checks: {
                    database: { ready: true, checkedAt: new Date() },
                    cache: { ready: true, checkedAt: new Date() },
                    migrations: { ready: true, lastMigration: '2024-01-01' },
                    configuration: { ready: true, requiredEnvVars: ['all_set'] }
                }
            };

            jest.spyOn(healthService as any, 'performReadinessChecks').mockResolvedValue(mockReadiness.checks);

            const result = await healthService.getReadinessStatus();

            expect(result.status).toBe(HealthStatus.READY);
            expect(result.checks.database.ready).toBe(true);
            expect(result.checks.migrations.ready).toBe(true);
        });

        it('should return not ready when dependencies are unavailable', async () => {
            const notReadyChecks = {
                database: { ready: false, error: 'Connection refused' },
                cache: { ready: true, checkedAt: new Date() },
                migrations: { ready: true },
                configuration: { ready: true }
            };

            jest.spyOn(healthService as any, 'performReadinessChecks').mockResolvedValue(notReadyChecks);

            const result = await healthService.getReadinessStatus();

            expect(result.status).toBe(HealthStatus.NOT_READY);
            expect(result.checks.database.ready).toBe(false);
        });

        it('should handle missing required configuration', async () => {
            const incompleteChecks = {
                database: { ready: true },
                cache: { ready: true },
                migrations: { ready: true },
                configuration: {
                    ready: false,
                    missingEnvVars: ['DATABASE_URL', 'JWT_SECRET']
                }
            };

            jest.spyOn(healthService as any, 'performReadinessChecks').mockResolvedValue(incompleteChecks);

            const result = await healthService.getReadinessStatus();

            expect(result.status).toBe(HealthStatus.NOT_READY);
            expect(result.checks.configuration.ready).toBe(false);
            expect(result.checks.configuration.missingEnvVars).toContain('DATABASE_URL');
        });
    });

    describe('getLivenessStatus', () => {
        it('should return liveness status', async () => {
            const mockLiveness = {
                status: HealthStatus.ALIVE,
                timestamp: new Date(),
                uptime: 86400000,
                pid: 12345,
                version: '1.0.0'
            };

            const result = await healthService.getLivenessStatus();

            expect(result.status).toBe(HealthStatus.ALIVE);
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('uptime');
            expect(result).toHaveProperty('pid');
            expect(result.pid).toBe(process.pid);
        });

        it('should calculate uptime correctly', async () => {
            const result = await healthService.getLivenessStatus();

            expect(result.uptime).toBeGreaterThan(0);
            expect(result.uptime).toBeLessThan(1000000000); // Reasonable uptime
        });
    });

    describe('runHealthCheck', () => {
        it('should run specific health check', async () => {
            const checkName = 'database';
            const mockCheckResult = {
                name: checkName,
                status: HealthStatus.HEALTHY,
                responseTime: 45,
                details: {
                    connectionString: 'postgresql://localhost:5432/db',
                    activeConnections: 5
                }
            };

            jest.spyOn(healthService as any, 'performSpecificCheck').mockResolvedValue(mockCheckResult);

            const result = await healthService.runHealthCheck(checkName);

            expect(result.name).toBe(checkName);
            expect(result.status).toBe(HealthStatus.HEALTHY);
            expect(result.responseTime).toBe(45);
            expect(result.details).toHaveProperty('activeConnections');
        });

        it('should handle unknown health check', async () => {
            const unknownCheck = 'unknown_service';

            await expect(healthService.runHealthCheck(unknownCheck))
                .rejects.toThrow('Unknown health check: unknown_service');
        });

        it('should handle health check failures', async () => {
            const failingCheck = 'external_api';

            jest.spyOn(healthService as any, 'performSpecificCheck').mockRejectedValue(
                new Error('Connection timeout')
            );

            await expect(healthService.runHealthCheck(failingCheck))
                .rejects.toThrow('Health check failed: Connection timeout');
        });
    });

    describe('getHealthHistory', () => {
        it('should return health check history', async () => {
            const mockHistory = [
                {
                    timestamp: new Date(Date.now() - 60 * 60 * 1000),
                    status: HealthStatus.HEALTHY,
                    checks: {
                        database: { status: HealthStatus.HEALTHY, responseTime: 40 },
                        cache: { status: HealthStatus.HEALTHY, responseTime: 5 }
                    }
                },
                {
                    timestamp: new Date(Date.now() - 30 * 60 * 1000),
                    status: HealthStatus.DEGRADED,
                    checks: {
                        database: { status: HealthStatus.DEGRADED, responseTime: 2000 },
                        cache: { status: HealthStatus.HEALTHY, responseTime: 5 }
                    }
                }
            ];

            jest.spyOn(healthService as any, 'getHealthHistoryFromCache').mockResolvedValue(mockHistory);

            const result = await healthService.getHealthHistory();

            expect(result).toHaveLength(2);
            expect(result[0].status).toBe(HealthStatus.HEALTHY);
            expect(result[1].status).toBe(HealthStatus.DEGRADED);
        });

        it('should filter health history by time range', async () => {
            const timeRange = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date()
            };

            jest.spyOn(healthService as any, 'getHealthHistoryFromCache').mockResolvedValue([]);

            const result = await healthService.getHealthHistory(timeRange);

            expect(healthService as any).toHaveBeenCalledWith(
                expect.objectContaining(timeRange)
            );
        });

        it('should handle empty health history', async () => {
            jest.spyOn(healthService as any, 'getHealthHistoryFromCache').mockResolvedValue([]);

            const result = await healthService.getHealthHistory();

            expect(result).toEqual([]);
        });
    });

    describe('setHealthAlert', () => {
        it('should successfully set health alert', async () => {
            const alertConfig = {
                name: 'high_response_time',
                condition: 'response_time > 1000',
                threshold: 1000,
                enabled: true,
                notificationChannels: ['email', 'webhook']
            };

            jest.spyOn(healthService as any, 'saveHealthAlert').mockResolvedValue({
                ...alertConfig,
                id: 'alert-123',
                createdAt: new Date()
            });

            const result = await healthService.setHealthAlert(alertConfig);

            expect(result.id).toBe('alert-123');
            expect(result.name).toBe('high_response_time');
            expect(result.enabled).toBe(true);
        });

        it('should validate alert configuration', async () => {
            const invalidAlert = {
                name: '', // Empty name
                condition: 'invalid condition syntax',
                threshold: -100, // Negative threshold
                enabled: true
            };

            await expect(healthService.setHealthAlert(invalidAlert))
                .rejects.toThrow('Invalid alert configuration');
        });

        it('should handle duplicate alert names', async () => {
            const existingAlert = {
                name: 'existing_alert',
                condition: 'status != healthy',
                threshold: 1,
                enabled: true
            };

            jest.spyOn(healthService as any, 'saveHealthAlert').mockRejectedValue(
                new Error('Alert name already exists')
            );

            await expect(healthService.setHealthAlert(existingAlert))
                .rejects.toThrow('Alert name already exists');
        });
    });
});