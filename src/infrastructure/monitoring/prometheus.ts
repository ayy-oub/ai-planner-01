import promClient from 'prom-client';
import { logger } from '../../shared/utils/logger';

class PrometheusService {
    private static instance: PrometheusService;
    private register: promClient.Registry;
    private isInitialized = false;

    // Custom metrics
    public httpRequestDuration!: promClient.Histogram<string>;
    public httpRequestTotal!: promClient.Counter<string>;
    public httpRequestErrors!: promClient.Counter<string>;
    public activeConnections!: promClient.Gauge<string>;
    public databaseQueryDuration!: promClient.Histogram<string>;
    public cacheHitRate!: promClient.Gauge<string>;
    public queueJobDuration!: promClient.Histogram<string>;
    public queueJobFailures!: promClient.Counter<string>;
    public userRegistrations!: promClient.Counter<string>;
    public plannerCreations!: promClient.Counter<string>;
    public aiRequests!: promClient.Counter<string>;
    public fileUploadSize!: promClient.Histogram<string>;
    public memoryUsage!: promClient.Gauge<string>;
    public cpuUsage!: promClient.Gauge<string>;


    private constructor() {
        this.register = new promClient.Registry();
        this.initializeMetrics();
    }

    static getInstance(): PrometheusService {
        if (!PrometheusService.instance) {
            PrometheusService.instance = new PrometheusService();
        }
        return PrometheusService.instance;
    }

    private initializeMetrics(): void {
        if (this.isInitialized) return;

        try {
            // Collect default metrics
            promClient.collectDefaultMetrics({
                register: this.register,
                prefix: 'ai_planner_',
                gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
            });

            // HTTP Request Duration
            this.httpRequestDuration = new promClient.Histogram({
                name: 'ai_planner_http_request_duration_seconds',
                help: 'Duration of HTTP requests in seconds',
                labelNames: ['method', 'route', 'status_code'],
                buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
            });

            // HTTP Request Total
            this.httpRequestTotal = new promClient.Counter({
                name: 'ai_planner_http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'route', 'status_code'],
            });

            // HTTP Request Errors
            this.httpRequestErrors = new promClient.Counter({
                name: 'ai_planner_http_request_errors_total',
                help: 'Total number of HTTP request errors',
                labelNames: ['method', 'route', 'error_type'],
            });

            // Active Connections
            this.activeConnections = new promClient.Gauge({
                name: 'ai_planner_active_connections',
                help: 'Number of active connections',
                labelNames: ['type'],
            });

            // Database Query Duration
            this.databaseQueryDuration = new promClient.Histogram({
                name: 'ai_planner_database_query_duration_seconds',
                help: 'Duration of database queries in seconds',
                labelNames: ['operation', 'collection'],
                buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            });

            // Cache Hit Rate
            this.cacheHitRate = new promClient.Gauge({
                name: 'ai_planner_cache_hit_rate',
                help: 'Cache hit rate percentage',
                labelNames: ['cache_type'],
            });

            // Queue Job Duration
            this.queueJobDuration = new promClient.Histogram({
                name: 'ai_planner_queue_job_duration_seconds',
                help: 'Duration of queue jobs in seconds',
                labelNames: ['queue_name', 'job_type'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
            });

            // Queue Job Failures
            this.queueJobFailures = new promClient.Counter({
                name: 'ai_planner_queue_job_failures_total',
                help: 'Total number of failed queue jobs',
                labelNames: ['queue_name', 'job_type', 'error_type'],
            });

            // User Registrations
            this.userRegistrations = new promClient.Counter({
                name: 'ai_planner_user_registrations_total',
                help: 'Total number of user registrations',
                labelNames: ['provider', 'plan'],
            });

            // Planner Creations
            this.plannerCreations = new promClient.Counter({
                name: 'ai_planner_planner_creations_total',
                help: 'Total number of planner creations',
                labelNames: ['type'],
            });

            // AI Requests
            this.aiRequests = new promClient.Counter({
                name: 'ai_planner_ai_requests_total',
                help: 'Total number of AI requests',
                labelNames: ['ai_type', 'status'],
            });

            // File Upload Size
            this.fileUploadSize = new promClient.Histogram({
                name: 'ai_planner_file_upload_size_bytes',
                help: 'Size of uploaded files in bytes',
                labelNames: ['file_type'],
                buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600], // 1KB to 100MB
            });

            // Memory Usage
            this.memoryUsage = new promClient.Gauge({
                name: 'ai_planner_memory_usage_bytes',
                help: 'Memory usage in bytes',
                labelNames: ['type'],
            });

            // CPU Usage
            this.cpuUsage = new promClient.Gauge({
                name: 'ai_planner_cpu_usage_percent',
                help: 'CPU usage percentage',
                labelNames: ['type'],
            });

            // Register all metrics
            this.register.registerMetric(this.httpRequestDuration);
            this.register.registerMetric(this.httpRequestTotal);
            this.register.registerMetric(this.httpRequestErrors);
            this.register.registerMetric(this.activeConnections);
            this.register.registerMetric(this.databaseQueryDuration);
            this.register.registerMetric(this.cacheHitRate);
            this.register.registerMetric(this.queueJobDuration);
            this.register.registerMetric(this.queueJobFailures);
            this.register.registerMetric(this.userRegistrations);
            this.register.registerMetric(this.plannerCreations);
            this.register.registerMetric(this.aiRequests);
            this.register.registerMetric(this.fileUploadSize);
            this.register.registerMetric(this.memoryUsage);
            this.register.registerMetric(this.cpuUsage);

            this.isInitialized = true;
            logger.info('Prometheus metrics initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Prometheus metrics:', error);
            throw error;
        }
    }

    async getMetrics(): Promise<string> {
        try {
            return await this.register.metrics();
        } catch (error) {
            logger.error('Failed to get metrics:', error);
            throw error;
        }
    }

    getRegister(): promClient.Registry {
        return this.register;
    }

    // Helper methods for recording metrics
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
        this.httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);
        this.httpRequestTotal.labels(method, route, statusCode.toString()).inc();
    }

    recordHttpError(method: string, route: string, errorType: string): void {
        this.httpRequestErrors.labels(method, route, errorType).inc();
    }

    recordDatabaseQuery(operation: string, collection: string, duration: number): void {
        this.databaseQueryDuration.labels(operation, collection).observe(duration);
    }

    recordCacheHitRate(cacheType: string, hitRate: number): void {
        this.cacheHitRate.labels(cacheType).set(hitRate);
    }

    recordQueueJob(queueName: string, jobType: string, duration: number, failed: boolean = false): void {
        this.queueJobDuration.labels(queueName, jobType).observe(duration);
        if (failed) {
            this.queueJobFailures.labels(queueName, jobType, 'unknown').inc();
        }
    }

    recordUserRegistration(provider: string, plan: string): void {
        this.userRegistrations.labels(provider, plan).inc();
    }

    recordPlannerCreation(type: string): void {
        this.plannerCreations.labels(type).inc();
    }

    recordAIRequest(aiType: string, status: string): void {
        this.aiRequests.labels(aiType, status).inc();
    }

    recordFileUpload(fileType: string, size: number): void {
        this.fileUploadSize.labels(fileType).observe(size);
    }

    updateSystemMetrics(): void {
        const memUsage = process.memoryUsage();
        this.memoryUsage.labels('rss').set(memUsage.rss);
        this.memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
        this.memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
        this.memoryUsage.labels('external').set(memUsage.external);
    }

    // Start periodic system metrics collection
    startSystemMetricsCollection(intervalMs: number = 10000): void {
        setInterval(() => {
            this.updateSystemMetrics();
        }, intervalMs);

        logger.info(`System metrics collection started with ${intervalMs}ms interval`);
    }
}

// Export singleton instance
export const prometheusService = PrometheusService.getInstance();
export default prometheusService;