import { Timestamp } from 'firebase-admin/firestore';

export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: Date;
    checks: HealthCheck[];
    metadata?: {
        version: string;
        environment: string;
        region?: string;
        uptime: number;
        memoryUsage?: MemoryUsage;
        cpuUsage?: CPUUsage;
    };
}

export interface HealthCheck {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    duration: number;
    timestamp: Date;
    metadata?: Record<string, any>;
    error?: {
        code: string;
        message: string;
        stack?: string;
    };
}

export interface MemoryUsage {
    used: number;
    total: number;
    percentage: number;
}

export interface CPUUsage {
    usage: number;
    cores: number;
    loadAverage: number[];
}

export interface DatabaseHealth {
    connected: boolean;
    responseTime: number;
    lastCheck: Date;
    errorRate: number;
    queryPerformance: {
        avgQueryTime: number;
        slowQueries: number;
        totalQueries: number;
    };
}

export interface CacheHealth {
    connected: boolean;
    hitRate: number;
    memoryUsage: number;
    keysCount: number;
    evictionCount: number;
}

export interface ExternalServiceHealth {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime: number;
    lastCheck: Date;
    errorRate: number;
    availability: number;
}

export interface QueueHealth {
    name: string;
    connected: boolean;
    queueSize: number;
    processingRate: number;
    failedJobs: number;
    delayedJobs: number;
}

export interface HealthCheckResult {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message: string;
    duration: number;
    timestamp: Date;
    data?: any;
    error?: Error;
}

export interface HealthCheckOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    critical?: boolean;
    tags?: string[];
}

export interface HealthAlert {
    id: string;
    type: 'health_degraded' | 'service_down' | 'high_error_rate' | 'performance_degradation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    service: string;
    message: string;
    details?: any;
    timestamp: Date;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
}

export interface HealthHistory {
    id: string;
    timestamp: Date;
    status: 'healthy' | 'unhealthy' | 'degraded';
    duration: number;
    checks: HealthCheck[];
    alerts: HealthAlert[];
}

export interface HealthThresholds {
    responseTime: {
        warning: number;
        critical: number;
    };
    errorRate: {
        warning: number;
        critical: number;
    };
    availability: {
        warning: number;
        critical: number;
    };
    memoryUsage: {
        warning: number;
        critical: number;
    };
    cpuUsage: {
        warning: number;
        critical: number;
    };
}

export interface HealthConfig {
    checks: {
        [key: string]: HealthCheckOptions;
    };
    thresholds: HealthThresholds;
    alerting: {
        enabled: boolean;
        channels: string[];
        cooldown: number;
    };
    history: {
        retentionDays: number;
        sampleInterval: number;
    };
}

export interface SystemMetrics {
    uptime: number;
    memory: {
        used: number;
        total: number;
        free: number;
        percentage: number;
    };
    cpu: {
        usage: number;
        loadAverage: number[];
        cores: number;
    };
    disk: {
        used: number;
        total: number;
        free: number;
        percentage: number;
    };
    network: {
        interfaces: NetworkInterface[];
        stats: NetworkStats;
    };
    process: {
        pid: number;
        version: string;
        nodeVersion: string;
        platform: string;
        arch: string;
        argv: string[];
        execPath: string;
        execArgv: string[];
    };
}

export interface NetworkInterface {
    name: string;
    address: string;
    netmask: string;
    family: string;
    mac: string;
    internal: boolean;
    cidr: string;
}

export interface NetworkStats {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    errors: number;
    drops: number;
}

export interface HealthReport {
    id: string;
    timestamp: Date;
    overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    systemMetrics: SystemMetrics;
    databaseHealth: DatabaseHealth;
    cacheHealth: CacheHealth;
    externalServices: ExternalServiceHealth[];
    queues: QueueHealth[];
    checks: HealthCheck[];
    alerts: HealthAlert[];
    recommendations: string[];
    nextCheck: Date;
}