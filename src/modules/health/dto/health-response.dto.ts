import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsArray, IsOptional, IsString } from 'class-validator';

class HealthCheckDto {
    @ApiProperty({
        description: 'Check name',
        example: 'database',
    })
    name: string;

    @ApiProperty({
        description: 'Check status',
        enum: ['healthy', 'unhealthy', 'degraded'],
        example: 'healthy',
    })
    status: 'healthy' | 'unhealthy' | 'degraded';

    @ApiPropertyOptional({
        description: 'Check message',
        example: 'Database is responsive (125ms)',
    })
    message?: string;

    @ApiProperty({
        description: 'Check duration in milliseconds',
        example: 125,
    })
    duration: number;

    @ApiProperty({
        description: 'Check timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    timestamp: Date;

    @ApiPropertyOptional({
        description: 'Additional check data',
        type: Object,
    })
    metadata?: any;

    @ApiPropertyOptional({
        description: 'Error details if check failed',
        type: Object,
    })
    error?: any;
}

class HealthMetadataDto {
    @ApiProperty({
        description: 'Application version',
        example: '1.0.0',
    })
    version: string;

    @ApiProperty({
        description: 'Environment',
        example: 'production',
    })
    environment: string;

    @ApiPropertyOptional({
        description: 'Region',
        example: 'us-east-1',
    })
    region?: string;

    @ApiProperty({
        description: 'System uptime in milliseconds',
        example: 86400000,
    })
    uptime: number;

    @ApiPropertyOptional({
        description: 'Memory usage information',
        type: Object,
    })
    memoryUsage?: any;

    @ApiPropertyOptional({
        description: 'CPU usage information',
        type: Object,
    })
    cpuUsage?: any;
}

export class HealthStatusDto {
    @ApiProperty({
        description: 'Overall health status',
        enum: ['healthy', 'unhealthy', 'degraded'],
        example: 'healthy',
    })
    status: 'healthy' | 'unhealthy' | 'degraded';

    @ApiProperty({
        description: 'Status timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Health checks results',
        type: [HealthCheckDto],
    })
    checks: HealthCheckDto[];

    @ApiPropertyOptional({
        description: 'Additional metadata',
        type: HealthMetadataDto,
    })
    metadata?: HealthMetadataDto;
}

export class HealthStatusResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Health status data',
        type: HealthStatusDto,
    })
    data: HealthStatusDto;
}

// Health Report Response
class SystemMetricsDto {
    @ApiProperty({
        description: 'System uptime in milliseconds',
        example: 86400000,
    })
    uptime: number;

    @ApiProperty({
        description: 'Memory usage information',
        type: Object,
    })
    memory: any;

    @ApiProperty({
        description: 'CPU usage information',
        type: Object,
    })
    cpu: any;

    @ApiProperty({
        description: 'Disk usage information',
        type: Object,
    })
    disk: any;

    @ApiProperty({
        description: 'Network information',
        type: Object,
    })
    network: any;

    @ApiProperty({
        description: 'Process information',
        type: Object,
    })
    process: any;
}

class DatabaseHealthDto {
    @ApiProperty({
        description: 'Database connection status',
        example: true,
    })
    connected: boolean;

    @ApiProperty({
        description: 'Database response time in milliseconds',
        example: 125,
    })
    responseTime: number;

    @ApiProperty({
        description: 'Last check timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    lastCheck: Date;

    @ApiProperty({
        description: 'Database error rate',
        example: 0.01,
    })
    errorRate: number;

    @ApiProperty({
        description: 'Query performance metrics',
        type: Object,
    })
    queryPerformance: any;
}

class CacheHealthDto {
    @ApiProperty({
        description: 'Cache connection status',
        example: true,
    })
    connected: boolean;

    @ApiProperty({
        description: 'Cache hit rate',
        example: 0.95,
    })
    hitRate: number;

    @ApiProperty({
        description: 'Cache memory usage in bytes',
        example: 104857600,
    })
    memoryUsage: number;

    @ApiProperty({
        description: 'Number of keys in cache',
        example: 1000,
    })
    keysCount: number;

    @ApiProperty({
        description: 'Number of evicted keys',
        example: 10,
    })
    evictionCount: number;
}

class ExternalServiceHealthDto {
    @ApiProperty({
        description: 'Service name',
        example: 'Firebase',
    })
    name: string;

    @ApiProperty({
        description: 'Service health status',
        enum: ['healthy', 'unhealthy', 'degraded'],
        example: 'healthy',
    })
    status: 'healthy' | 'unhealthy' | 'degraded';

    @ApiProperty({
        description: 'Service response time in milliseconds',
        example: 200,
    })
    responseTime: number;

    @ApiProperty({
        description: 'Last check timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    lastCheck: Date;

    @ApiProperty({
        description: 'Service error rate',
        example: 0.01,
    })
    errorRate: number;

    @ApiProperty({
        description: 'Service availability percentage',
        example: 0.99,
    })
    availability: number;
}

class QueueHealthDto {
    @ApiProperty({
        description: 'Queue name',
        example: 'export',
    })
    name: string;

    @ApiProperty({
        description: 'Queue connection status',
        example: true,
    })
    connected: boolean;

    @ApiProperty({
        description: 'Current queue size',
        example: 10,
    })
    queueSize: number;

    @ApiProperty({
        description: 'Job processing rate',
        example: 5,
    })
    processingRate: number;

    @ApiProperty({
        description: 'Number of failed jobs',
        example: 2,
    })
    failedJobs: number;

    @ApiProperty({
        description: 'Number of delayed jobs',
        example: 1,
    })
    delayedJobs: number;
}

class HealthAlertDto {
    @ApiProperty({
        description: 'Alert ID',
        example: 'alert_123abc',
    })
    id: string;

    @ApiProperty({
        description: 'Alert type',
        enum: ['health_degraded', 'service_down', 'high_error_rate', 'performance_degradation'],
        example: 'performance_degradation',
    })
    type: string;

    @ApiProperty({
        description: 'Alert severity',
        enum: ['low', 'medium', 'high', 'critical'],
        example: 'high',
    })
    severity: string;

    @ApiProperty({
        description: 'Affected service',
        example: 'database',
    })
    service: string;

    @ApiProperty({
        description: 'Alert message',
        example: 'Database response time is high',
    })
    message: string;

    @ApiPropertyOptional({
        description: 'Additional alert details',
        type: Object,
    })
    details?: any;

    @ApiProperty({
        description: 'Alert timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Whether the alert is acknowledged',
        example: false,
    })
    acknowledged: boolean;

    @ApiPropertyOptional({
        description: 'User who acknowledged the alert',
        example: 'user_123abc',
    })
    acknowledgedBy?: string;

    @ApiPropertyOptional({
        description: 'Acknowledgment timestamp',
        example: '2024-01-10T11:00:00Z',
    })
    acknowledgedAt?: Date;

    @ApiProperty({
        description: 'Whether the alert is resolved',
        example: false,
    })
    resolved: boolean;

    @ApiPropertyOptional({
        description: 'Resolution timestamp',
        example: '2024-01-10T12:00:00Z',
    })
    resolvedAt?: Date;

    @ApiPropertyOptional({
        description: 'User who resolved the alert',
        example: 'user_123abc',
    })
    resolvedBy?: string;
}

class HealthReportDto {
    @ApiProperty({
        description: 'Report ID',
        example: 'report_123abc',
    })
    id: string;

    @ApiProperty({
        description: 'Report timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Overall health status',
        enum: ['healthy', 'unhealthy', 'degraded'],
        example: 'healthy',
    })
    overallStatus: 'healthy' | 'unhealthy' | 'degraded';

    @ApiProperty({
        description: 'System metrics',
        type: SystemMetricsDto,
    })
    systemMetrics: SystemMetricsDto;

    @ApiProperty({
        description: 'Database health',
        type: DatabaseHealthDto,
    })
    databaseHealth: DatabaseHealthDto;

    @ApiProperty({
        description: 'Cache health',
        type: CacheHealthDto,
    })
    cacheHealth: CacheHealthDto;

    @ApiProperty({
        description: 'External services health',
        type: [ExternalServiceHealthDto],
    })
    externalServices: ExternalServiceHealthDto[];

    @ApiProperty({
        description: 'Queue health',
        type: [QueueHealthDto],
    })
    queues: QueueHealthDto[];

    @ApiProperty({
        description: 'Health checks results',
        type: [HealthCheckDto],
    })
    checks: HealthCheckDto[];

    @ApiProperty({
        description: 'Health alerts',
        type: [HealthAlertDto],
    })
    alerts: HealthAlertDto[];

    @ApiProperty({
        description: 'Health recommendations',
        example: ['Consider increasing available memory', 'Check database connection pool'],
        type: [String],
    })
    recommendations: string[];

    @ApiProperty({
        description: 'Next scheduled check timestamp',
        example: '2024-01-10T10:35:00Z',
    })
    nextCheck: Date;
}

export class HealthReportResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Health report data',
        type: HealthReportDto,
    })
    data: HealthReportDto;
}

// Health History Response
class HealthHistoryDto {
    @ApiProperty({
        description: 'History record ID',
        example: 'history_123abc',
    })
    id: string;

    @ApiProperty({
        description: 'Record timestamp',
        example: '2024-01-10T10:30:00Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Overall status at this time',
        enum: ['healthy', 'unhealthy', 'degraded'],
        example: 'healthy',
    })
    status: 'healthy' | 'unhealthy' | 'degraded';

    @ApiProperty({
        description: 'Total duration of health checks',
        example: 1250,
    })
    duration: number;

    @ApiProperty({
        description: 'Health checks results',
        type: [HealthCheckDto],
    })
    checks: HealthCheckDto[];

    @ApiProperty({
        description: 'Health alerts at this time',
        type: [HealthAlertDto],
    })
    alerts: HealthAlertDto[];
}

export class HealthHistoryResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Health history data',
        type: [HealthHistoryDto],
    })
    data: HealthHistoryDto[];
}

// Health Alerts Response
export class HealthAlertsResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Health alerts data',
        type: [HealthAlertDto],
    })
    data: HealthAlertDto[];
}