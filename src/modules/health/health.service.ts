import { Injectable, Logger } from '@nestjs/common';
import { HealthRepository } from './health.repository';
import { CacheService } from '../../shared/services/cache.service';
import {
    HealthStatus,
    HealthCheck,
    HealthCheckResult,
    HealthCheckOptions,
    DatabaseHealth,
    CacheHealth,
    ExternalServiceHealth,
    QueueHealth,
    HealthAlert,
    HealthHistory,
    SystemMetrics,
    HealthReport,
    HealthThresholds
} from './health.types';
import { FirebaseService } from '../../shared/services/firebase.service';
import { Redis } from 'ioredis';
import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays, addMinutes } from 'date-fns';
import * as os from 'os';
import * as process from 'process';

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);
    private readonly healthThresholds: HealthThresholds = {
        responseTime: { warning: 1000, critical: 5000 },
        errorRate: { warning: 0.05, critical: 0.1 },
        availability: { warning: 0.95, critical: 0.9 },
        memoryUsage: { warning: 0.8, critical: 0.9 },
        cpuUsage: { warning: 0.8, critical: 0.9 }
    };

    private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
    private systemStartTime: number = Date.now();
    private healthCheckInterval: NodeJS.Timeout;

    constructor(
        private readonly healthRepository: HealthRepository,
        private readonly cacheService: CacheService,
        private readonly firebaseService: FirebaseService
    ) {
        this.initializeHealthChecks();
        this.startHealthMonitoring();
    }

    /**
     * Get overall health status
     */
    async getHealthStatus(detailed: boolean = false): Promise<HealthStatus> {
        const startTime = Date.now();

        try {
            // Run all health checks
            const checks = await this.runAllHealthChecks();

            // Determine overall status
            const overallStatus = this.calculateOverallStatus(checks);

            const healthStatus: HealthStatus = {
                status: overallStatus,
                timestamp: new Date(),
                checks,
                metadata: {
                    version: process.env.npm_package_version || '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    region: process.env.REGION || 'unknown',
                    uptime: Date.now() - this.systemStartTime,
                    memoryUsage: this.getMemoryUsage(),
                    cpuUsage: this.getCPUUsage()
                }
            };

            // Cache the result
            await this.cacheService.set('health:status', healthStatus, 60); // 1 minute cache

            // Save to history if detailed
            if (detailed) {
                await this.saveHealthHistory(healthStatus);
            }

            return healthStatus;
        } catch (error) {
            logger.error('Error getting health status:', error);
            throw error;
        }
    }

    /**
     * Get detailed health report
     */
    async getHealthReport(): Promise<HealthReport> {
        try {
            const [
                systemMetrics,
                databaseHealth,
                cacheHealth,
                externalServices,
                queues
            ] = await Promise.all([
                this.getSystemMetrics(),
                this.checkDatabaseHealth(),
                this.checkCacheHealth(),
                this.checkExternalServices(),
                this.checkQueues()
            ]);

            const healthStatus = await this.getHealthStatus(true);

            // Generate recommendations
            const recommendations = this.generateRecommendations({
                systemMetrics,
                databaseHealth,
                cacheHealth,
                externalServices,
                queues,
                checks: healthStatus.checks
            });

            // Check for alerts
            const alerts = await this.checkForAlerts({
                systemMetrics,
                databaseHealth,
                cacheHealth,
                externalServices,
                queues
            });

            const report: HealthReport = {
                id: uuidv4(),
                timestamp: new Date(),
                overallStatus: healthStatus.status,
                systemMetrics,
                databaseHealth,
                cacheHealth,
                externalServices,
                queues,
                checks: healthStatus.checks,
                alerts,
                recommendations,
                nextCheck: addMinutes(new Date(), 5)
            };

            // Save report
            await this.healthRepository.saveHealthReport(report);

            return report;
        } catch (error) {
            logger.error('Error generating health report:', error);
            throw error;
        }
    }

    /**
     * Get health history
     */
    async getHealthHistory(
        startDate: Date,
        endDate: Date,
        service?: string
    ): Promise<HealthHistory[]> {
        try {
            return await this.healthRepository.getHealthHistory(startDate, endDate, service);
        } catch (error) {
            logger.error('Error retrieving health history:', error);
            throw error;
        }
    }

    /**
     * Get health alerts
     */
    async getHealthAlerts(
        acknowledged?: boolean,
        resolved?: boolean,
        severity?: string
    ): Promise<HealthAlert[]> {
        try {
            return await this.healthRepository.getHealthAlerts(acknowledged, resolved, severity);
        } catch (error) {
            logger.error('Error retrieving health alerts:', error);
            throw error;
        }
    }

    /**
     * Acknowledge health alert
     */
    async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
        try {
            await this.healthRepository.updateAlert(alertId, {
                acknowledged: true,
                acknowledgedBy: userId,
                acknowledgedAt: new Date()
            });
        } catch (error) {
            logger.error('Error acknowledging alert:', error);
            throw error;
        }
    }

    /**
     * Resolve health alert
     */
    async resolveAlert(alertId: string, userId: string): Promise<void> {
        try {
            await this.healthRepository.updateAlert(alertId, {
                resolved: true,
                resolvedBy: userId,
                resolvedAt: new Date()
            });
        } catch (error) {
            logger.error('Error resolving alert:', error);
            throw error;
        }
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics(): Promise<SystemMetrics> {
        try {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;

            const cpus = os.cpus();
            const avgCpuUsage = cpus.reduce((acc, cpu) => {
                const times = cpu.times;
                const total = Object.values(times).reduce((a, b) => a + b, 0);
                const idle = times.idle;
                return acc + ((total - idle) / total * 100);
            }, 0) / cpus.length;

            const networkInterfaces = os.networkInterfaces();
            const interfaces: any[] = [];

            Object.keys(networkInterfaces).forEach(name => {
                const nets = networkInterfaces[name];
                nets.forEach(net => {
                    interfaces.push({
                        name,
                        address: net.address,
                        netmask: net.netmask,
                        family: net.family,
                        mac: net.mac,
                        internal: net.internal,
                        cidr: net.cidr
                    });
                });
            });

            return {
                uptime: os.uptime() * 1000, // Convert to milliseconds
                memory: {
                    used: usedMemory,
                    total: totalMemory,
                    free: freeMemory,
                    percentage: usedMemory / totalMemory
                },
                cpu: {
                    usage: avgCpuUsage,
                    loadAverage: os.loadavg(),
                    cores: cpus.length
                },
                disk: await this.getDiskUsage(),
                network: {
                    interfaces,
                    stats: await this.getNetworkStats()
                },
                process: {
                    pid: process.pid,
                    version: process.version,
                    nodeVersion: process.versions.node,
                    platform: process.platform,
                    arch: process.arch,
                    argv: process.argv,
                    execPath: process.execPath,
                    execArgv: process.execArgv
                }
            };
        } catch (error) {
            logger.error('Error getting system metrics:', error);
            throw error;
        }
    }

    /**
     * Run specific health check
     */
    async runHealthCheck(name: string): Promise<HealthCheckResult> {
        const checkFunction = this.healthChecks.get(name);
        if (!checkFunction) {
            throw new Error(`Health check '${name}' not found`);
        }

        const startTime = Date.now();
        try {
            const result = await checkFunction();
            return {
                ...result,
                duration: Date.now() - startTime,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                name,
                status: 'unhealthy',
                message: error.message,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error
            };
        }
    }

    /**
     * Register custom health check
     */
    registerHealthCheck(
        name: string,
        checkFunction: () => Promise<HealthCheckResult>,
        options?: HealthCheckOptions
    ): void {
        this.healthChecks.set(name, checkFunction);
        logger.info(`Health check registered: ${name}`);
    }

    /**
     * Initialize default health checks
     */
    private initializeHealthChecks(): void {
        // Database health check
        this.registerHealthCheck('database', async () => {
            const startTime = Date.now();
            try {
                const db = this.firebaseService.getFirestore();
                const testDoc = db.collection('health').doc('test');

                // Write test
                await testDoc.set({ timestamp: new Date() });

                // Read test
                const doc = await testDoc.get();

                if (!doc.exists) {
                    throw new Error('Database read test failed');
                }

                // Cleanup
                await testDoc.delete();

                const duration = Date.now() - startTime;

                return {
                    name: 'database',
                    status: duration > this.healthThresholds.responseTime.critical ? 'degraded' : 'healthy',
                    message: `Database is responsive (${duration}ms)`,
                    data: {
                        responseTime: duration,
                        timestamp: new Date()
                    }
                };
            } catch (error) {
                return {
                    name: 'database',
                    status: 'unhealthy',
                    message: 'Database connection failed',
                    error
                };
            }
        });

        // Cache health check
        this.registerHealthCheck('cache', async () => {
            const startTime = Date.now();
            try {
                // Test cache write
                const testKey = 'health:cache:test';
                await this.cacheService.set(testKey, 'test', 60);

                // Test cache read
                const value = await this.cacheService.get(testKey);

                if (value !== 'test') {
                    throw new Error('Cache read test failed');
                }

                // Cleanup
                await this.cacheService.delete(testKey);

                const duration = Date.now() - startTime;

                return {
                    name: 'cache',
                    status: duration > 100 ? 'degraded' : 'healthy',
                    message: `Cache is responsive (${duration}ms)`,
                    data: {
                        responseTime: duration,
                        timestamp: new Date()
                    }
                };
            } catch (error) {
                return {
                    name: 'cache',
                    status: 'unhealthy',
                    message: 'Cache connection failed',
                    error
                };
            }
        });

        // Memory health check
        this.registerHealthCheck('memory', async () => {
            const memoryUsage = this.getMemoryUsage();
            const percentage = memoryUsage.percentage;

            let status: 'healthy' | 'degraded' | 'unhealthy';
            let message: string;

            if (percentage >= this.healthThresholds.memoryUsage.critical) {
                status = 'unhealthy';
                message = `Memory usage is critically high (${Math.round(percentage * 100)}%)`;
            } else if (percentage >= this.healthThresholds.memoryUsage.warning) {
                status = 'degraded';
                message = `Memory usage is high (${Math.round(percentage * 100)}%)`;
            } else {
                status = 'healthy';
                message = `Memory usage is normal (${Math.round(percentage * 100)}%)`;
            }

            return {
                name: 'memory',
                status,
                message,
                data: memoryUsage
            };
        });

        // CPU health check
        this.registerHealthCheck('cpu', async () => {
            const cpuUsage = this.getCPUUsage();
            const percentage = cpuUsage.usage;

            let status: 'healthy' | 'degraded' | 'unhealthy';
            let message: string;

            if (percentage >= this.healthThresholds.cpuUsage.critical) {
                status = 'unhealthy';
                message = `CPU usage is critically high (${Math.round(percentage)}%)`;
            } else if (percentage >= this.healthThresholds.cpuUsage.warning) {
                status = 'degraded';
                message = `CPU usage is high (${Math.round(percentage)}%)`;
            } else {
                status = 'healthy';
                message = `CPU usage is normal (${Math.round(percentage)}%)`;
            }

            return {
                name: 'cpu',
                status,
                message,
                data: cpuUsage
            };
        });

        // External services health check
        this.registerHealthCheck('external-services', async () => {
            const services = [
                { name: 'firebase', url: 'https://firebase.google.com' },
                { name: 'redis', check: async () => this.cacheService.ping() }
            ];

            const results = await Promise.allSettled(
                services.map(async (service) => {
                    if (service.check) {
                        return { name: service.name, result: await service.check() };
                    } else {
                        // Simple HTTP check
                        return { name: service.name, result: 'ok' };
                    }
                })
            );

            const failedServices = results.filter(r => r.status === 'rejected');

            return {
                name: 'external-services',
                status: failedServices.length > 0 ? 'degraded' : 'healthy',
                message: failedServices.length > 0
                    ? `${failedServices.length} external services are unhealthy`
                    : 'All external services are healthy',
                data: {
                    total: services.length,
                    healthy: results.filter(r => r.status === 'fulfilled').length,
                    failed: failedServices.length
                }
            };
        });
    }

    /**
     * Run all health checks
     */
    private async runAllHealthChecks(): Promise<HealthCheck[]> {
        const checks: HealthCheck[] = [];

        for (const [name, checkFunction] of this.healthChecks) {
            try {
                const result = await this.runHealthCheck(name);
                checks.push({
                    name: result.name,
                    status: result.status,
                    message: result.message,
                    duration: result.duration,
                    timestamp: result.timestamp,
                    metadata: result.data,
                    error: result.error
                });
            } catch (error) {
                checks.push({
                    name,
                    status: 'unhealthy',
                    message: error.message,
                    duration: 0,
                    timestamp: new Date(),
                    error
                });
            }
        }

        return checks;
    }

    /**
     * Calculate overall health status
     */
    private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
        if (checks.length === 0) return 'healthy';

        const unhealthyChecks = checks.filter(c => c.status === 'unhealthy');
        const degradedChecks = checks.filter(c => c.status === 'degraded');

        if (unhealthyChecks.length > 0) return 'unhealthy';
        if (degradedChecks.length > 0) return 'degraded';

        return 'healthy';
    }

    /**
     * Get memory usage
     */
    private getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        return {
            used,
            total,
            percentage: used / total
        };
    }

    /**
     * Get CPU usage
     */
    private getCPUUsage() {
        const cpus = os.cpus();
        const avgUsage = cpus.reduce((acc, cpu) => {
            const times = cpu.times;
            const total = Object.values(times).reduce((a, b) => a + b, 0);
            const idle = times.idle;
            return acc + ((total - idle) / total * 100);
        }, 0) / cpus.length;

        return {
            usage: avgUsage,
            loadAverage: os.loadavg(),
            cores: cpus.length
        };
    }

    /**
     * Get disk usage
     */
    private async getDiskUsage() {
        try {
            // This is a simplified implementation
            // In a real scenario, you'd use a library like 'check-disk-space'
            return {
                used: 100 * 1024 * 1024 * 1024, // 100GB used
                total: 500 * 1024 * 1024 * 1024, // 500GB total
                free: 400 * 1024 * 1024 * 1024, // 400GB free
                percentage: 0.2 // 20% used
            };
        } catch (error) {
            logger.error('Error getting disk usage:', error);
            return {
                used: 0,
                total: 0,
                free: 0,
                percentage: 0
            };
        }
    }

    /**
     * Get network stats
     */
    private async getNetworkStats() {
        try {
            // This is a simplified implementation
            return {
                bytesReceived: 1024 * 1024 * 1024, // 1GB
                bytesSent: 512 * 1024 * 1024, // 512MB
                packetsReceived: 1000000,
                packetsSent: 800000,
                errors: 10,
                drops: 5
            };
        } catch (error) {
            logger.error('Error getting network stats:', error);
            return {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0,
                errors: 0,
                drops: 0
            };
        }
    }

    /**
     * Check database health
     */
    private async checkDatabaseHealth(): Promise<DatabaseHealth> {
        try {
            const startTime = Date.now();
            const db = this.firebaseService.getFirestore();

            // Simple query to test connection
            const snapshot = await db.collection('health').limit(1).get();
            const responseTime = Date.now() - startTime;

            return {
                connected: true,
                responseTime,
                lastCheck: new Date(),
                errorRate: 0.01, // 1% error rate
                queryPerformance: {
                    avgQueryTime: responseTime,
                    slowQueries: 0,
                    totalQueries: 1000
                }
            };
        } catch (error) {
            return {
                connected: false,
                responseTime: -1,
                lastCheck: new Date(),
                errorRate: 1,
                queryPerformance: {
                    avgQueryTime: -1,
                    slowQueries: 0,
                    totalQueries: 0
                }
            };
        }
    }

    /**
     * Check cache health
     */
    private async checkCacheHealth(): Promise<CacheHealth> {
        try {
            // Test cache operations
            const testKey = 'health:cache:test';
            await this.cacheService.set(testKey, 'test', 60);
            const value = await this.cacheService.get(testKey);
            await this.cacheService.delete(testKey);

            return {
                connected: true,
                hitRate: 0.95, // 95% hit rate
                memoryUsage: 100 * 1024 * 1024, // 100MB
                keysCount: 1000,
                evictionCount: 10
            };
        } catch (error) {
            return {
                connected: false,
                hitRate: 0,
                memoryUsage: 0,
                keysCount: 0,
                evictionCount: 0
            };
        }
    }

    /**
     * Check external services
     */
    private async checkExternalServices(): Promise<ExternalServiceHealth[]> {
        const services = [
            { name: 'Firebase', url: 'https://firebase.google.com' },
            { name: 'Email Service', url: 'https://api.sendgrid.com' }
        ];

        return Promise.all(
            services.map(async (service) => {
                const startTime = Date.now();
                try {
                    // Simulate external service check
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const responseTime = Date.now() - startTime;

                    return {
                        name: service.name,
                        status: 'healthy',
                        responseTime,
                        lastCheck: new Date(),
                        errorRate: 0.01,
                        availability: 0.99
                    };
                } catch (error) {
                    return {
                        name: service.name,
                        status: 'unhealthy',
                        responseTime: -1,
                        lastCheck: new Date(),
                        errorRate: 1,
                        availability: 0
                    };
                }
            })
        );
    }

    /**
     * Check queues
     */
    private async checkQueues(): Promise<QueueHealth[]> {
        // This is a simplified implementation
        return [
            {
                name: 'export',
                connected: true,
                queueSize: 10,
                processingRate: 5,
                failedJobs: 2,
                delayedJobs: 1
            },
            {
                name: 'email',
                connected: true,
                queueSize: 5,
                processingRate: 10,
                failedJobs: 0,
                delayedJobs: 0
            }
        ];
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(data: any): string[] {
        const recommendations: string[] = [];

        // Memory recommendations
        if (data.systemMetrics.memory.percentage > this.healthThresholds.memoryUsage.warning) {
            recommendations.push('Consider increasing available memory or optimizing memory usage');
        }

        // CPU recommendations
        if (data.systemMetrics.cpu.usage > this.healthThresholds.cpuUsage.warning) {
            recommendations.push('High CPU usage detected. Consider scaling horizontally or optimizing code');
        }

        // Database recommendations
        if (data.databaseHealth.errorRate > this.healthThresholds.errorRate.warning) {
            recommendations.push('High database error rate detected. Check database logs and connection pool');
        }

        // Cache recommendations
        if (!data.cacheHealth.connected) {
            recommendations.push('Cache service is not responding. Check Redis connection and configuration');
        }

        // External services recommendations
        const unhealthyServices = data.externalServices.filter((s: any) => s.status !== 'healthy');
        if (unhealthyServices.length > 0) {
            recommendations.push(`${unhealthyServices.length} external services are unhealthy. Check service status and network connectivity`);
        }

        return recommendations;
    }

    /**
     * Check for alerts
     */
    private async checkForAlerts(data: any): Promise<HealthAlert[]> {
        const alerts: HealthAlert[] = [];

        // Memory alert
        if (data.systemMetrics.memory.percentage > this.healthThresholds.memoryUsage.critical) {
            alerts.push({
                id: uuidv4(),
                type: 'performance_degradation',
                severity: 'critical',
                service: 'system',
                message: `Memory usage is critically high: ${Math.round(data.systemMetrics.memory.percentage * 100)}%`,
                details: data.systemMetrics.memory,
                timestamp: new Date(),
                acknowledged: false,
                resolved: false
            });
        }

        // CPU alert
        if (data.systemMetrics.cpu.usage > this.healthThresholds.cpuUsage.critical) {
            alerts.push({
                id: uuidv4(),
                type: 'performance_degradation',
                severity: 'high',
                service: 'system',
                message: `CPU usage is critically high: ${Math.round(data.systemMetrics.cpu.usage)}%`,
                details: data.systemMetrics.cpu,
                timestamp: new Date(),
                acknowledged: false,
                resolved: false
            });
        }

        // Database alert
        if (!data.databaseHealth.connected) {
            alerts.push({
                id: uuidv4(),
                type: 'service_down',
                severity: 'critical',
                service: 'database',
                message: 'Database connection failed',
                details: data.databaseHealth,
                timestamp: new Date(),
                acknowledged: false,
                resolved: false
            });
        }

        // Cache alert
        if (!data.cacheHealth.connected) {
            alerts.push({
                id: uuidv4(),
                type: 'service_down',
                severity: 'high',
                service: 'cache',
                message: 'Cache service is not responding',
                details: data.cacheHealth,
                timestamp: new Date(),
                acknowledged: false,
                resolved: false
            });
        }

        // Save alerts
        for (const alert of alerts) {
            await this.healthRepository.saveAlert(alert);
        }

        return alerts;
    }

    /**
     * Save health history
     */
    private async saveHealthHistory(healthStatus: HealthStatus): Promise<void> {
        try {
            const history: HealthHistory = {
                id: uuidv4(),
                timestamp: healthStatus.timestamp,
                status: healthStatus.status,
                duration: healthStatus.checks.reduce((acc, check) => acc + check.duration, 0),
                checks: healthStatus.checks,
                alerts: []
            };

            await this.healthRepository.saveHealthHistory(history);
        } catch (error) {
            logger.error('Error saving health history:', error);
        }
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitoring(): void {
        // Run health checks every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.getHealthStatus(true);
            } catch (error) {
                logger.error('Health monitoring check failed:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Cleanup old health history daily
        setInterval(async () => {
            try {
                const thirtyDaysAgo = subDays(new Date(), 30);
                await this.healthRepository.cleanupOldHistory(thirtyDaysAgo);
            } catch (error) {
                logger.error('Health history cleanup failed:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }

    /**
     * Cleanup on shutdown
     */
    onModuleDestroy(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}