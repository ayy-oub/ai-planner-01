import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;

        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }

        if (stack) {
            msg += `\n${stack}`;
        }

        return msg;
    })
);

const jsonLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

/**
 * Create Winston logger instance
 */
const createLogger = () => {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.app.env !== 'test') {
        transports.push(
            new winston.transports.Console({
                format: config.app.env === 'development' ? logFormat : jsonLogFormat,
                level: config.logging.level,
            })
        );
    }

    // File transports
    if (config.app.env !== 'development') {
        // Error log file
        transports.push(
            new DailyRotateFile({
                filename: 'logs/error-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'error',
                format: jsonLogFormat,
                maxSize: config.logging.maxSize,
                maxFiles: config.logging.maxFiles,
                zippedArchive: true,
            })
        );

        // Combined log file
        transports.push(
            new DailyRotateFile({
                filename: 'logs/application-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                format: jsonLogFormat,
                maxSize: config.logging.maxSize,
                maxFiles: config.logging.maxFiles,
                zippedArchive: true,
            })
        );

        // Audit log file for security events
        transports.push(
            new DailyRotateFile({
                filename: 'logs/audit-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'info',
                format: jsonLogFormat,
                maxSize: '10m',
                maxFiles: '30d',
                zippedArchive: true,
            })
        );
    }

    // Performance log file
    transports.push(
        new DailyRotateFile({
            filename: 'logs/performance-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'debug',
            format: jsonLogFormat,
            maxSize: '50m',
            maxFiles: '7d',
            zippedArchive: true,
        })
    );

    return winston.createLogger({
        level: config.logging.level,
        format: jsonLogFormat,
        defaultMeta: {
            service: 'ai-planner-api',
            environment: config.app.env,
            version: config.app.version,
        },
        transports,
        exceptionHandlers: [
            new winston.transports.File({ filename: 'logs/exceptions.log' }),
        ],
        rejectionHandlers: [
            new winston.transports.File({ filename: 'logs/rejections.log' }),
        ],
    });
};

export const logger = createLogger();

/**
 * Create child logger with additional metadata
 */
export const createChildLogger = (metadata: Record<string, any>) => {
    return logger.child(metadata);
};

/**
 * Logger for specific domains
 */
export const domainLoggers = {
    auth: createChildLogger({ domain: 'authentication' }),
    database: createChildLogger({ domain: 'database' }),
    cache: createChildLogger({ domain: 'cache' }),
    email: createChildLogger({ domain: 'email' }),
    ai: createChildLogger({ domain: 'ai' }),
    external: createChildLogger({ domain: 'external-api' }),
    security: createChildLogger({ domain: 'security' }),
    performance: createChildLogger({ domain: 'performance' }),
    business: createChildLogger({ domain: 'business' }),
};

/**
 * Request logger helper
 */
export const requestLogger = {
    incoming: (requestId: string, method: string, url: string, ip: string) => {
        logger.info('Incoming request', { requestId, method, url, ip });
    },

    outgoing: (requestId: string, method: string, url: string, statusCode: number, duration: number) => {
        logger.info('Outgoing response', { requestId, method, url, statusCode, duration });
    },

    error: (requestId: string, error: Error, context?: any) => {
        logger.error('Request error', { requestId, error: error.message, stack: error.stack, context });
    },
};

/**
 * Performance logger helper
 */
export const performanceLogger = {
    slowQuery: (query: string, duration: number, threshold: number) => {
        logger.warn('Slow query detected', { query, duration, threshold, domain: 'performance' });
    },

    memoryUsage: (usage: NodeJS.MemoryUsage) => {
        logger.debug('Memory usage', {
            rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(usage.external / 1024 / 1024)}MB`,
            domain: 'performance',
        });
    },

    cpuUsage: (usage: NodeJS.CpuUsage) => {
        logger.debug('CPU usage', {
            user: usage.user,
            system: usage.system,
            domain: 'performance',
        });
    },
};

/**
 * Security logger helper
 */
export const securityLogger = {
    loginAttempt: (email: string, success: boolean, ip: string) => {
        const level = success ? 'info' : 'warn';
        logger[level]('Login attempt', { email, success, ip, domain: 'security' });
    },

    unauthorizedAccess: (resource: string, userId?: string, ip?: string) => {
        logger.warn('Unauthorized access attempt', { resource, userId, ip, domain: 'security' });
    },

    rateLimitExceeded: (ip: string, userId?: string, limit?: number) => {
        logger.warn('Rate limit exceeded', { ip, userId, limit, domain: 'security' });
    },

    suspiciousActivity: (activity: string, details: any) => {
        logger.warn('Suspicious activity detected', { activity, details, domain: 'security' });
    },

    dataValidationFailed: (validationErrors: any, ip: string) => {
        logger.warn('Data validation failed', { validationErrors, ip, domain: 'security' });
    },
};

/**
 * Business event logger helper
 */
export const businessLogger = {
    userRegistered: (userId: string, email: string, ip: string) => {
        logger.info('User registered', { userId, email, ip, domain: 'business' });
    },

    subscriptionChanged: (userId: string, oldPlan: string, newPlan: string) => {
        logger.info('Subscription changed', { userId, oldPlan, newPlan, domain: 'business' });
    },

    paymentProcessed: (userId: string, amount: number, currency: string) => {
        logger.info('Payment processed', { userId, amount, currency, domain: 'business' });
    },

    featureUsed: (userId: string, feature: string, metadata?: any) => {
        logger.info('Feature used', { userId, feature, metadata, domain: 'business' });
    },
};

/**
 * Database query logger
 */
export const databaseLogger = {
    query: (query: string, duration: number, collection?: string) => {
        logger.debug('Database query', { query, duration, collection, domain: 'database' });
    },

    connection: (status: string, host?: string, port?: number) => {
        logger.info('Database connection', { status, host, port, domain: 'database' });
    },

    error: (error: Error, query?: string) => {
        logger.error('Database error', { error: error.message, query, domain: 'database' });
    },

    migration: (migrationName: string, direction: 'up' | 'down') => {
        logger.info('Database migration', { migrationName, direction, domain: 'database' });
    },
};

/**
 * Cache operation logger
 */
export const cacheLogger = {
    hit: (key: string, duration?: number) => {
        logger.debug('Cache hit', { key, duration, domain: 'cache' });
    },

    miss: (key: string) => {
        logger.debug('Cache miss', { key, domain: 'cache' });
    },

    set: (key: string, ttl?: number) => {
        logger.debug('Cache set', { key, ttl, domain: 'cache' });
    },

    delete: (key: string) => {
        logger.debug('Cache delete', { key, domain: 'cache' });
    },

    error: (error: Error, operation: string, key?: string) => {
        logger.error('Cache error', { error: error.message, operation, key, domain: 'cache' });
    },
};

/**
 * External API logger
 */
export const externalLogger = {
    request: (service: string, method: string, url: string, headers?: any) => {
        logger.debug('External API request', { service, method, url, headers, domain: 'external' });
    },

    response: (service: string, statusCode: number, duration: number) => {
        logger.debug('External API response', { service, statusCode, duration, domain: 'external' });
    },

    error: (service: string, error: Error, context?: any) => {
        logger.error('External API error', { service, error: error.message, context, domain: 'external' });
    },

    timeout: (service: string, timeout: number) => {
        logger.warn('External API timeout', { service, timeout, domain: 'external' });
    },

    retry: (service: string, attempt: number, maxAttempts: number) => {
        logger.info('External API retry', { service, attempt, maxAttempts, domain: 'external' });
    },
};

/**
 * Log levels enum
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    HTTP = 'http',
    VERBOSE = 'verbose',
    DEBUG = 'debug',
    SILLY = 'silly',
}

/**
 * Structured log formatter
 */
export const formatStructuredLog = (level: LogLevel, message: string, metadata?: any) => {
    return {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...metadata,
        service: 'ai-planner-api',
        environment: config.app.env,
        version: config.app.version,
    };
};

/**
 * Log rotation helper
 */
export const setupLogRotation = () => {
    // Winston Daily Rotate File transport handles this automatically
    logger.info('Log rotation configured', {
        maxSize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles,
    });
};

/**
 * Emergency logger for critical errors
 */
export const emergencyLogger = (error: Error, context?: any) => {
    // Log to multiple places for redundancy
    console.error('EMERGENCY ERROR:', error);
    console.error('Context:', context);

    logger.error('EMERGENCY ERROR', {
        error: error.message,
        stack: error.stack,
        context,
        emergency: true,
    });
};

export const stream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

export default logger;