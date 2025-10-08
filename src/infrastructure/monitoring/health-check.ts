import { firebaseConnection } from '../database/firebase';
import { redisConnection } from '../database/redis';
import { mongoConnection } from '../database/mongoose';
import { queueManager } from '../queue/bullmq';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HealthCheck {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    responseTime?: number;
    lastChecked: Date;
}

interface SystemHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: Date;
    uptime: number;
    version: string;
    environment: string;
    checks: HealthCheck[];
}

class HealthCheckService {
    private static instance: HealthCheckService;
    private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
    private lastHealthCheck: SystemHealth | null = null;
    private lastCheckTime = 0;
    private cacheTimeout = 30000; // 30 seconds

    private constructor() {
        this.initializeHealthChecks();
    }

    static getInstance(): HealthCheckService {
        if (!HealthCheckService.instance) {
            HealthCheckService.instance = new HealthCheckService();
        }
        return HealthCheckService.instance;
    }

    private initializeHealthChecks(): void {
        // Database health checks
        this.healthChecks.set('firebase', this.checkFirebaseHealth.bind(this));
        this.healthChecks.set('redis', this.checkRedisHealth.bind(this));
        this.healthChecks.set('mongodb', this.checkMongoDBHealth.bind(this));

        // Infrastructure health checks
        this.healthChecks.set('queue', this.checkQueueHealth.bind(this));
        this.healthChecks.set('memory', this.checkMemoryHealth.bind(this));
        this.healthChecks.set('disk', this.checkDiskHealth.bind(this));
        this.healthChecks.set('cpu', this.checkCPUHealth.bind(this));
    }

    async getHealthStatus(detailed = false): Promise<SystemHealth> {
        const now = Date.now();

        // Return cached result if within timeout
        if (this.lastHealthCheck && (now - this.lastCheckTime) < this.cacheTimeout) {
            return this.lastHealthCheck;
        }

        const checks: HealthCheck[] = [];
        let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

        // Run all health checks in parallel
        const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFn]) => {
            try {
                return await checkFn();
            } catch (error) {
                logger.error(`Health check '${name}' failed:`, error);
                return {
                    name,
                    status: 'unhealthy' as const,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    lastChecked: new Date(),
                };
            }
        });

        const results = await Promise.allSettled(checkPromises);

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                checks.push(result.value);
                if (result.value.status === 'unhealthy') {
                    overallStatus = 'unhealthy';
                } else if (result.value.status === 'degraded' && overallStatus === 'healthy') {
                    overallStatus = 'degraded';
                }
            } else {
                overallStatus = 'unhealthy';
            }
        });

        const systemHealth: SystemHealth = {
            status: overallStatus,
            timestamp: new Date(),
            uptime: process.uptime(),
            version: config.app.version,
            environment: config.app.env,
            checks: detailed ? checks : checks.filter(check => check.status !== 'healthy'),
        };

        this.lastHealthCheck = systemHealth;
        this.lastCheckTime = now;

        return systemHealth;
    }

    private async checkFirebaseHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const isHealthy = await firebaseConnection.healthCheck();
            const responseTime = Date.now() - startTime;

            return {
                name: 'firebase',
                status: isHealthy ? 'healthy' : 'unhealthy',
                message: isHealthy ? 'Firebase connection is healthy' : 'Firebase connection failed',
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'firebase',
                status: 'unhealthy',
                message: error instanceof Error ? error.message : 'Firebase health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkRedisHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const isHealthy = await redisConnection.healthCheck();
            const responseTime = Date.now() - startTime;

            return {
                name: 'redis',
                status: isHealthy ? 'healthy' : 'unhealthy',
                message: isHealthy ? 'Redis connection is healthy' : 'Redis connection failed',
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'redis',
                status: 'unhealthy',
                message: error instanceof Error ? error.message : 'Redis health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkMongoDBHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const isHealthy = await mongoConnection.healthCheck();
            const responseTime = Date.now() - startTime;

            return {
                name: 'mongodb',
                status: isHealthy ? 'healthy' : 'degraded',
                message: isHealthy ? 'MongoDB connection is healthy' : 'MongoDB connection failed',
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            // MongoDB is optional, so we mark it as degraded rather than unhealthy
            return {
                name: 'mongodb',
                status: 'degraded',
                message: 'MongoDB not configured or connection failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkQueueHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const queueNames = queueManager.getQueueNames();
            let totalFailedJobs = 0;

            for (const queueName of queueNames) {
                const counts = await queueManager.getJobCounts(queueName);
                totalFailedJobs += counts.failed;
            }

            const responseTime = Date.now() - startTime;
            const status = totalFailedJobs > 100 ? 'degraded' : 'healthy';

            return {
                name: 'queue',
                status,
                message: `Queue system is ${status}. Failed jobs: ${totalFailedJobs}`,
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'queue',
                status: 'unhealthy',
                message: error instanceof Error ? error.message : 'Queue health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkMemoryHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercent = (usedMemory / totalMemory) * 100;

            const responseTime = Date.now() - startTime;
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

            if (memoryUsagePercent > 90) {
                status = 'unhealthy';
            } else if (memoryUsagePercent > 75) {
                status = 'degraded';
            }

            return {
                name: 'memory',
                status,
                message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'memory',
                status: 'unhealthy',
                message: 'Memory health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkDiskHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            let diskUsage = 0;

            if (process.platform === 'win32') {
                // Windows disk usage check
                const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
                const lines = stdout.split('\n').slice(1);
                let totalSize = 0;
                let totalFree = 0;

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3 && parts[1] && parts[2]) {
                        const free = parseInt(parts[1]);
                        const size = parseInt(parts[2]);
                        if (!isNaN(free) && !isNaN(size)) {
                            totalFree += free;
                            totalSize += size;
                        }
                    }
                }

                diskUsage = totalSize > 0 ? ((totalSize - totalFree) / totalSize) * 100 : 0;
            } else {
                // Unix-like disk usage check
                const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $5}'");
                diskUsage = parseInt(stdout.trim().replace('%', ''));
            }

            const responseTime = Date.now() - startTime;
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

            if (diskUsage > 90) {
                status = 'unhealthy';
            } else if (diskUsage > 80) {
                status = 'degraded';
            }

            return {
                name: 'disk',
                status,
                message: `Disk usage: ${diskUsage.toFixed(2)}%`,
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'disk',
                status: 'degraded',
                message: 'Disk health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    private async checkCPUHealth(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            cpus.forEach(cpu => {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type as keyof typeof cpu.times];
                }
                totalIdle += cpu.times.idle;
            });

            const cpuUsagePercent = 100 - Math.floor((totalIdle / totalTick) * 100);

            const responseTime = Date.now() - startTime;
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

            if (cpuUsagePercent > 90) {
                status = 'unhealthy';
            } else if (cpuUsagePercent > 75) {
                status = 'degraded';
            }

            return {
                name: 'cpu',
                status,
                message: `CPU usage: ${cpuUsagePercent}%`,
                responseTime,
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                name: 'cpu',
                status: 'degraded',
                message: 'CPU health check failed',
                responseTime: Date.now() - startTime,
                lastChecked: new Date(),
            };
        }
    }

    // Custom health check registration
    registerHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
        this.healthChecks.set(name, checkFn);
    }

    // Remove custom health check
    removeHealthCheck(name: string): boolean {
        return this.healthChecks.delete(name);
    }

    // Force health check refresh
    async refreshHealthCheck(): Promise<SystemHealth> {
        this.lastHealthCheck = null;
        this.lastCheckTime = 0;
        return await this.getHealthStatus();
    }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();
export default healthCheckService;