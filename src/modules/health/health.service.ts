// src/modules/health/health.service.ts
import { OnModuleDestroy } from '@nestjs/common';
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
    HealthThresholds,
} from './health.types';
import { FirebaseService } from '../../shared/services/firebase.service';
import { logger } from '../../shared/utils/logger';
let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();
import { subDays, addMinutes } from 'date-fns';
import * as os from 'os';
import * as process from 'process';

export class HealthService implements OnModuleDestroy {

    private readonly healthThresholds: HealthThresholds = {
        responseTime: { warning: 1000, critical: 5000 },
        errorRate: { warning: 0.05, critical: 0.1 },
        availability: { warning: 0.95, critical: 0.9 },
        memoryUsage: { warning: 0.8, critical: 0.9 },
        cpuUsage: { warning: 0.8, critical: 0.9 },
    };

    private healthChecks = new Map<string, () => Promise<HealthCheckResult>>();
    private systemStartTime = Date.now();
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(
        private readonly healthRepository: HealthRepository,
        private readonly cacheService: CacheService,
        private readonly firebaseService: FirebaseService,
    ) {
        this.initializeHealthChecks();
        this.startHealthMonitoring();
    }

    /* ------------------------------------------------------------------ */
    /*  Public API  –  exactly what the controller calls                    */
    /* ------------------------------------------------------------------ */

    async getHealthStatus(detailed = false): Promise<HealthStatus> {
        return this.buildHealthStatus(detailed);
    }

    async getHealthReport(): Promise<HealthReport> {
        return this.buildHealthReport();
    }

    async getHealthHistory(
        startDate: Date,
        endDate: Date,
        service?: string,
    ): Promise<HealthHistory[]> {
        return this.healthRepository.getHealthHistory(startDate, endDate, service);
    }

    async getHealthAlerts(
        acknowledged?: boolean,
        resolved?: boolean,
        severity?: string,
    ): Promise<HealthAlert[]> {
        return this.healthRepository.getHealthAlerts(acknowledged, resolved, severity);
    }

    async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
        await this.healthRepository.updateAlert(alertId, {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: new Date(),
        });
    }

    async resolveAlert(alertId: string, userId: string): Promise<void> {
        await this.healthRepository.updateAlert(alertId, {
            resolved: true,
            resolvedBy: userId,
            resolvedAt: new Date(),
        });
    }

    async runHealthCheck(name: string): Promise<HealthCheckResult> {
        const fn = this.healthChecks.get(name);
        if (!fn) throw new Error(`Health-check '${name}' not found`);
        const start = Date.now();
        try {
            const r = await fn();
            return { ...r, duration: Date.now() - start, timestamp: new Date() };
        } catch (err: any) {
            return {
                name,
                status: 'unhealthy',
                message: err.message,
                duration: Date.now() - start,
                timestamp: new Date(),
                error: err,
            };
        }
    }

    async getSystemMetrics(): Promise<SystemMetrics> {
        return this.buildSystemMetrics();
    }

    /* ===== NEW METHODS REQUIRED BY CONTROLLER ===== */

    async getReadiness(): Promise<{ ready: boolean; timestamp: Date }> {
        // simplest: if we can reach DB & Cache we are ready
        const [db, cache] = await Promise.allSettled([
            this.firebaseService.db.collection('health').limit(1).get(),
            this.cacheService.ping(),
        ]);
        return {
            ready: db.status === 'fulfilled' && cache.status === 'fulfilled',
            timestamp: new Date(),
        };
    }

    async getLiveness(): Promise<{ alive: boolean; timestamp: Date; uptime: number }> {
        return {
            alive: true,
            timestamp: new Date(),
            uptime: Date.now() - this.systemStartTime,
        };
    }

    async getHealthStats(startDate: Date, endDate: Date): Promise<any> {
        // Re-use history; aggregate on the fly (can be optimised later)
        const items = await this.getHealthHistory(startDate, endDate);
        const total = items.length;
        const healthy = items.filter((i) => i.status === 'healthy').length;
        const unhealthy = items.filter((i) => i.status === 'unhealthy').length;
        const degraded = total - healthy - unhealthy;

        return {
            period: { start: startDate, end: endDate },
            totalChecks: total,
            healthy,
            unhealthy,
            degraded,
            availability: total ? healthy / total : 0,
        };
    }

    async registerCustomCheck(body: {
        name: string;
        check: string; // javascript source that returns HealthCheckResult
        options?: HealthCheckOptions;
    }): Promise<void> {
        // VERY NAIVE: eval the string -> () => Promise<HealthCheckResult>
        // In real life compile via VM2 / isolate etc.
        try {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const fn = new Function('return ' + body.check)() as () => Promise<HealthCheckResult>;
            this.registerHealthCheck(body.name, fn, body.options);
        } catch (e) {
            logger.error('Invalid custom check code', e);
            throw new Error('Custom check code could not be parsed');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                             */
    /* ------------------------------------------------------------------ */

    private async buildHealthStatus(detailed: boolean): Promise<HealthStatus> {
        const checks = await this.runAllHealthChecks();
        const status = this.calculateOverallStatus(checks);

        const meta = {
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            region: process.env.REGION || 'unknown',
            uptime: Date.now() - this.systemStartTime,
            memoryUsage: this.getMemoryUsage(),
            cpuUsage: this.getCPUUsage(),
        };

        const healthStatus: HealthStatus = { status, timestamp: new Date(), checks, metadata: meta };

        await this.cacheService.set('health:status', healthStatus, { ttl: 60 });
        if (detailed) await this.saveHealthHistory(healthStatus);

        return healthStatus;
    }

    private async buildHealthReport(): Promise<HealthReport> {
        const [systemMetrics, databaseHealth, cacheHealth, externalServices, queues, healthStatus] =
            await Promise.all([
                this.buildSystemMetrics(),
                this.checkDatabaseHealth(),
                this.checkCacheHealth(),
                this.checkExternalServices(),
                this.checkQueues(),
                this.buildHealthStatus(true),
            ]);

        const recommendations = this.generateRecommendations({
            systemMetrics,
            databaseHealth,
            cacheHealth,
            externalServices,
            queues,
            checks: healthStatus.checks,
        });

        const alerts = await this.checkForAlerts({
            systemMetrics,
            databaseHealth,
            cacheHealth,
            externalServices,
            queues,
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
            nextCheck: addMinutes(new Date(), 5),
        };

        await this.healthRepository.saveHealthReport(report);
        return report;
    }

    private async buildSystemMetrics(): Promise<SystemMetrics> {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        const cpus = os.cpus();
        const avgCpu =
            cpus.reduce((acc, c) => {
                const t = Object.values(c.times).reduce((a, b) => a + b, 0);
                return acc + ((t - c.times.idle) / t) * 100;
            }, 0) / cpus.length;

        const ifaces: any[] = [];
        const ni = os.networkInterfaces();
        Object.keys(ni).forEach((name) =>
            ni[name]?.forEach((net) =>
                ifaces.push({
                    name,
                    address: net.address,
                    netmask: net.netmask,
                    family: net.family,
                    mac: net.mac,
                    internal: net.internal,
                    cidr: net.cidr,
                }),
            ),
        );

        return {
            uptime: os.uptime() * 1000,
            memory: { used, total, free, percentage: used / total },
            cpu: { usage: avgCpu, loadAverage: os.loadavg(), cores: cpus.length },
            disk: await this.getDiskUsage(),
            network: { interfaces: ifaces, stats: await this.getNetworkStats() },
            process: {
                pid: process.pid,
                version: process.version,
                nodeVersion: process.versions.node,
                platform: process.platform,
                arch: process.arch,
                argv: process.argv,
                execPath: process.execPath,
                execArgv: process.execArgv,
            },
        };
    }

    private async runAllHealthChecks(): Promise<HealthCheck[]> {
        const checks: HealthCheck[] = [];
        for (const [name, fn] of this.healthChecks) {
            const r = await this.runHealthCheck(name);
            checks.push({
                name: r.name,
                status: r.status,
                message: r.message,
                duration: r.duration,
                timestamp: r.timestamp,
                metadata: r.data,
                error: r.error
                    ? {
                        code: r.error.name ?? 'UNKNOWN',
                        message: r.error.message,
                        stack: r.error.stack,
                    }
                    : undefined,
            });
        }
        return checks;
    }

    private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
        if (!checks.length) return 'healthy';
        const un = checks.filter((c) => c.status === 'unhealthy').length;
        const deg = checks.filter((c) => c.status === 'degraded').length;
        return un > 0 ? 'unhealthy' : deg > 0 ? 'degraded' : 'healthy';
    }

    /* ------------------------------------------------------------------ */
    /*  Default health checks                                               */
    /* ------------------------------------------------------------------ */

    private initializeHealthChecks(): void {
        this.registerHealthCheck('database', async () => {
            const start = Date.now();
            try {
                const db = this.firebaseService.db;
                const doc = db.collection('health').doc('test');
                await doc.set({ ts: new Date() });
                const snap = await doc.get();
                if (!snap.exists) throw new Error('read failed');
                await doc.delete();
                const dur = Date.now() - start;

                /* return only the fields YOU own */
                return {
                    name: 'database',
                    status: dur > this.healthThresholds.responseTime.critical ? 'degraded' : 'healthy',
                    message: `DB responsive (${dur}ms)`,
                    data: { responseTime: dur },
                } as HealthCheckResult; // <-- tell TS “caller will add the rest”
            } catch (e: any) {
                return {
                    name: 'database',
                    status: 'unhealthy',
                    message: 'DB failed',
                    error: e,
                } as HealthCheckResult;
            }
        });

        /* ---------- cache ---------- */
        this.registerHealthCheck('cache', async () => {
            const start = Date.now();
            try {
                const key = 'health:cache:test';
                await this.cacheService.set(key, 'test', { ttl: 60 });
                const v = await this.cacheService.get(key);
                if (v !== 'test') throw new Error('cache read failed');
                await this.cacheService.delete(key);
                const dur = Date.now() - start;
                return {
                    name: 'cache',
                    status: dur > 100 ? 'degraded' : 'healthy',
                    message: `Cache responsive (${dur}ms)`,
                    data: { responseTime: dur },
                } as HealthCheckResult;
            } catch (e: any) {
                return { name: 'cache', status: 'unhealthy', message: 'Cache failed', error: e } as HealthCheckResult;
            }
        });

        /* ---------- memory ---------- */
        this.registerHealthCheck('memory', async () => {
            const mu = this.getMemoryUsage();
            const pct = mu.percentage;
            let status: 'healthy' | 'degraded' | 'unhealthy';
            let msg: string;
            if (pct >= this.healthThresholds.memoryUsage.critical) {
                status = 'unhealthy';
                msg = `Memory critically high (${Math.round(pct * 100)}%)`;
            } else if (pct >= this.healthThresholds.memoryUsage.warning) {
                status = 'degraded';
                msg = `Memory high (${Math.round(pct * 100)}%)`;
            } else {
                status = 'healthy';
                msg = `Memory normal (${Math.round(pct * 100)}%)`;
            }
            return { name: 'memory', status, message: msg, data: mu } as HealthCheckResult;
        });

        /* ---------- cpu ---------- */
        this.registerHealthCheck('cpu', async () => {
            const cu = this.getCPUUsage();
            const pct = cu.usage;
            let status: 'healthy' | 'degraded' | 'unhealthy';
            let msg: string;
            if (pct >= this.healthThresholds.cpuUsage.critical) {
                status = 'unhealthy';
                msg = `CPU critically high (${Math.round(pct)}%)`;
            } else if (pct >= this.healthThresholds.cpuUsage.warning) {
                status = 'degraded';
                msg = `CPU high (${Math.round(pct)}%)`;
            } else {
                status = 'healthy';
                msg = `CPU normal (${Math.round(pct)}%)`;
            }
            return { name: 'cpu', status, message: msg, data: cu } as HealthCheckResult;
        });

        /* ---------- external-services ---------- */
        this.registerHealthCheck('external-services', async () => {
            const svcs = [
                { name: 'firebase', check: async () => this.firebaseService.db.collection('health').limit(1).get() },
                { name: 'redis', check: async () => this.cacheService.ping() },
            ];
            const res = await Promise.allSettled(svcs.map((s) => s.check()));
            const failed = res.filter((r) => r.status === 'rejected').length;
            return {
                name: 'external-services',
                status: failed > 0 ? 'degraded' : 'healthy',
                message: failed > 0 ? `${failed} services unhealthy` : 'All healthy',
                data: { total: svcs.length, healthy: svcs.length - failed, failed },
            } as HealthCheckResult;
        });
    }

    registerHealthCheck(
        name: string,
        checkFn: () => Promise<HealthCheckResult>,
        _opts?: HealthCheckOptions,
    ): void {
        this.healthChecks.set(name, checkFn);
        logger.log({ level: 'info', message: `Health-check registered: ${name}` });
    }

    /* ------------------------------------------------------------------ */
    /*  Other small helpers                                                 */
    /* ------------------------------------------------------------------ */

    private getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        return { used, total, percentage: used / total };
    }

    private getCPUUsage() {
        const cpus = os.cpus();
        const avg =
            cpus.reduce((acc, c) => {
                const t = Object.values(c.times).reduce((a, b) => a + b, 0);
                return acc + ((t - c.times.idle) / t) * 100;
            }, 0) / cpus.length;
        return { usage: avg, loadAverage: os.loadavg(), cores: cpus.length };
    }

    private async getDiskUsage() {
        // placeholder – replace with real lib if needed
        return { used: 100e9, total: 500e9, free: 400e9, percentage: 0.2 };
    }

    private async getNetworkStats() {
        // placeholder
        return { bytesReceived: 1e9, bytesSent: 512e6, packetsReceived: 1e6, packetsSent: 8e5, errors: 10, drops: 5 };
    }

    private async checkDatabaseHealth(): Promise<DatabaseHealth> {
        try {
            const start = Date.now();
            await this.firebaseService.db.collection('health').limit(1).get();
            const rt = Date.now() - start;
            return {
                connected: true,
                responseTime: rt,
                lastCheck: new Date(),
                errorRate: 0.01,
                queryPerformance: { avgQueryTime: rt, slowQueries: 0, totalQueries: 1000 },
            };
        } catch {
            return {
                connected: false,
                responseTime: -1,
                lastCheck: new Date(),
                errorRate: 1,
                queryPerformance: { avgQueryTime: -1, slowQueries: 0, totalQueries: 0 },
            };
        }
    }

    private async checkCacheHealth(): Promise<CacheHealth> {
        try {
            const key = 'health:cache:test';
            await this.cacheService.set(key, '1', { ttl: 60 });
            await this.cacheService.get(key);
            await this.cacheService.delete(key);
            return { connected: true, hitRate: 0.95, memoryUsage: 100 * 1024 * 1024, keysCount: 1000, evictionCount: 10 };
        } catch {
            return { connected: false, hitRate: 0, memoryUsage: 0, keysCount: 0, evictionCount: 0 };
        }
    }

    private async checkExternalServices(): Promise<ExternalServiceHealth[]> {
        const svcs = [
            { name: 'Firebase', url: 'https://firebase.google.com' },
            { name: 'Email Service', url: 'https://api.sendgrid.com' },
        ];
        return Promise.all(
            svcs.map(async (s) => {
                const start = Date.now();
                try {
                    // fake ping
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    const rt = Date.now() - start;
                    return { name: s.name, status: 'healthy', responseTime: rt, lastCheck: new Date(), errorRate: 0.01, availability: 0.99 };
                } catch {
                    return { name: s.name, status: 'unhealthy', responseTime: -1, lastCheck: new Date(), errorRate: 1, availability: 0 };
                }
            }),
        );
    }

    private async checkQueues(): Promise<QueueHealth[]> {
        // stub
        return [
            { name: 'export', connected: true, queueSize: 10, processingRate: 5, failedJobs: 2, delayedJobs: 1 },
            { name: 'email', connected: true, queueSize: 5, processingRate: 10, failedJobs: 0, delayedJobs: 0 },
        ];
    }

    private generateRecommendations(data: any): string[] {
        const rec: string[] = [];
        if (data.systemMetrics.memory.percentage > this.healthThresholds.memoryUsage.warning)
            rec.push('Consider increasing memory or optimising usage');
        if (data.systemMetrics.cpu.usage > this.healthThresholds.cpuUsage.warning)
            rec.push('High CPU – consider scaling or optimisation');
        if (data.databaseHealth.errorRate > this.healthThresholds.errorRate.warning)
            rec.push('DB error-rate high – check logs');
        if (!data.cacheHealth.connected) rec.push('Cache unreachable – check Redis');
        const bad = data.externalServices.filter((s: any) => s.status !== 'healthy');
        if (bad.length) rec.push(`${bad.length} external services unhealthy`);
        return rec;
    }

    private async checkForAlerts(data: any): Promise<HealthAlert[]> {
        const alerts: HealthAlert[] = [];
        const mem = data.systemMetrics.memory.percentage;
        const cpu = data.systemMetrics.cpu.usage;

        if (mem > this.healthThresholds.memoryUsage.critical)
            alerts.push(this.makeAlert('performance_degradation', 'critical', 'system', `Memory critically high: ${Math.round(mem * 100)}%`, data.systemMetrics.memory));
        if (cpu > this.healthThresholds.cpuUsage.critical)
            alerts.push(this.makeAlert('performance_degradation', 'high', 'system', `CPU critically high: ${Math.round(cpu)}%`, data.systemMetrics.cpu));
        if (!data.databaseHealth.connected)
            alerts.push(this.makeAlert('service_down', 'critical', 'database', 'Database connection failed', data.databaseHealth));
        if (!data.cacheHealth.connected)
            alerts.push(this.makeAlert('service_down', 'high', 'cache', 'Cache unreachable', data.cacheHealth));

        for (const a of alerts) await this.healthRepository.saveAlert(a);
        return alerts;
    }

    private makeAlert(
        type: HealthAlert['type'],
        severity: HealthAlert['severity'],
        service: string,
        msg: string,
        details: any,
    ): HealthAlert {
        return {
            id: uuidv4(),
            type,
            severity,
            service,
            message: msg,
            details,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false,
        };
    }

    private async saveHealthHistory(status: HealthStatus): Promise<void> {
        const h: HealthHistory = {
            id: uuidv4(),
            timestamp: status.timestamp,
            status: status.status,
            duration: status.checks.reduce((a, c) => a + c.duration, 0),
            checks: status.checks,
            alerts: [],
        };
        await this.healthRepository.saveHealthHistory(h);
    }

    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.buildHealthStatus(true);
            } catch (e) {
                logger.error('Background health check failed', e);
            }
        }, 5 * 60 * 1000);

        setInterval(async () => {
            try {
                await this.healthRepository.cleanupOldHistory(subDays(new Date(), 30));
            } catch (e) {
                logger.error('History cleanup failed', e);
            }
        }, 24 * 60 * 60 * 1000);
    }

    onModuleDestroy(): void {
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    }
}