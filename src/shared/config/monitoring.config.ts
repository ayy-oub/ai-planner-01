import { config } from './index';

export interface MonitoringConfig {
    prometheus: {
        enabled: boolean;
        port: number;
        path: string;
        collectDefaultMetrics: boolean;
        timeout: number;
        prefix: string;
        gcDurationBuckets: number[];
        httpDurationBuckets: number[];
    };
    healthCheck: {
        enabled: boolean;
        path: string;
        timeout: number;
        checks: {
            database: boolean;
            redis: boolean;
            externalServices: boolean;
            diskSpace: boolean;
            memory: boolean;
        };
    };
    logging: {
        level: string;
        format: string;
        colorize: boolean;
        timestamp: boolean;
        prettyPrint: boolean;
        silent: boolean;
    };
    alerts: {
        enabled: boolean;
        thresholds: {
            errorRate: number;
            responseTime: number;
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
        };
        channels: {
            email: boolean;
            webhook: boolean;
            slack: boolean;
        };
    };
    tracing: {
        enabled: boolean;
        serviceName: string;
        sampleRate: number;
        exporters: {
            jaeger: boolean;
            zipkin: boolean;
            console: boolean;
        };
    };
    metrics: {
        customMetrics: {
            userRegistrations: boolean;
            plannerCreations: boolean;
            aiRequests: boolean;
            exportOperations: boolean;
            fileUploads: boolean;
        };
        labels: {
            environment: string;
            service: string;
            version: string;
        };
    };
}

export const monitoringConfig: MonitoringConfig = {
    prometheus: {
        enabled: config.monitoring.metricsEnabled,
        port: 9090,
        path: '/metrics',
        collectDefaultMetrics: true,
        timeout: 5000,
        prefix: 'ai_planner_',
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        httpDurationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    },
    healthCheck: {
        enabled: config.monitoring.healthCheckEnabled,
        path: '/health',
        timeout: 30000,
        checks: {
            database: true,
            redis: true,
            externalServices: true,
            diskSpace: true,
            memory: true,
        },
    },
    logging: {
        level: config.logging.level,
        format: config.app.env === 'production' ? 'json' : 'simple',
        colorize: config.app.env === 'development',
        timestamp: true,
        prettyPrint: config.app.env === 'development',
        silent: false,
    },
    alerts: {
        enabled: true,
        thresholds: {
            errorRate: 0.05, // 5%
            responseTime: 2000, // 2 seconds
            cpuUsage: 0.8, // 80%
            memoryUsage: 0.85, // 85%
            diskUsage: 0.9, // 90%
        },
        channels: {
            email: true,
            webhook: true,
            slack: false,
        },
    },
    tracing: {
        enabled: config.app.env === 'production',
        serviceName: 'ai-planner-api',
        sampleRate: 0.1, // 10% sampling
        exporters: {
            jaeger: false,
            zipkin: false,
            console: config.app.env === 'development',
        },
    },
    metrics: {
        customMetrics: {
            userRegistrations: true,
            plannerCreations: true,
            aiRequests: true,
            exportOperations: true,
            fileUploads: true,
        },
        labels: {
            environment: config.app.env,
            service: 'ai-planner-api',
            version: config.app.version,
        },
    },
};

// Custom metric names
export const metricNames = {
    // HTTP metrics
    httpRequestsTotal: 'ai_planner_http_requests_total',
    httpRequestDuration: 'ai_planner_http_request_duration_seconds',
    httpRequestSize: 'ai_planner_http_request_size_bytes',
    httpResponseSize: 'ai_planner_http_response_size_bytes',

    // Application metrics
    userRegistrations: 'ai_planner_user_registrations_total',
    userLogins: 'ai_planner_user_logins_total',
    plannerCreations: 'ai_planner_planner_creations_total',
    plannerUpdates: 'ai_planner_planner_updates_total',
    plannerDeletions: 'ai_planner_planner_deletions_total',
    aiRequests: 'ai_planner_ai_requests_total',
    aiRequestDuration: 'ai_planner_ai_request_duration_seconds',
    exportOperations: 'ai_planner_export_operations_total',
    fileUploads: 'ai_planner_file_uploads_total',
    fileUploadSize: 'ai_planner_file_upload_size_bytes',

    // System metrics
    activeConnections: 'ai_planner_active_connections',
    databaseQueries: 'ai_planner_database_queries_total',
    databaseQueryDuration: 'ai_planner_database_query_duration_seconds',
    cacheHits: 'ai_planner_cache_hits_total',
    cacheMisses: 'ai_planner_cache_misses_total',
    queueJobs: 'ai_planner_queue_jobs_total',
    queueJobDuration: 'ai_planner_queue_job_duration_seconds',

    // Error metrics
    errorsTotal: 'ai_planner_errors_total',
    validationErrors: 'ai_planner_validation_errors_total',
    authenticationErrors: 'ai_planner_authentication_errors_total',
    authorizationErrors: 'ai_planner_authorization_errors_total',
    databaseErrors: 'ai_planner_database_errors_total',
    externalServiceErrors: 'ai_planner_external_service_errors_total',
};

// Health check endpoints
export const healthCheckEndpoints = {
    liveness: '/health/live',
    readiness: '/health/ready',
    startup: '/health/startup',
    detailed: '/health/detailed',
};

// Log levels with colors
export const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
};

export default monitoringConfig;