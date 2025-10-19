import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();;
    const startTime = Date.now();

    // Add request ID to request object for correlation
    (req as any).requestId = requestId;
    (req as any).startTime = startTime;

    // Log incoming request
    logger.info('Incoming request', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
        contentLength: req.get('content-length'),
        query: { ...req.query }, // ✅ shallow copy
        params: { ...req.params }, // optional copy
        // Don't log sensitive data
        body: maskSensitiveData(req.body),
    });

    // Capture response data
    const originalSend = res.send;
    let responseBody: any;

    res.send = function (data: any) {
        responseBody = data;
        return originalSend.call(this, data);
    };

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            contentLength: res.get('content-length'),
            duration: `${duration}ms`,
            userId: (req as any).user?.uid,
        };

        if (res.statusCode >= 400) {
            logger.warn('Request completed with error', {
                ...logData,
                responseBody: responseBody && typeof responseBody === 'string'
                    ? JSON.parse(responseBody)
                    : responseBody,
            });

        } else {
            logger.info('Request completed', logData);
        }
    });

    res.on('error', (error) => {
        logger.error('Response error', {
            requestId,
            error: error.message,
            stack: error.stack,
        });
    });

    next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;
    const userId = (req as any).user?.uid;

    logger.error('Request error', {
        requestId,
        userId,
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: maskSensitiveData(req.body),
    });

    next(error);
};

/**
 * Performance logging middleware
 */
export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        // Log slow requests (> 1 second)
        if (duration > 1000) {
            logger.warn('Slow request detected', {
                requestId: (req as any).requestId,
                method: req.method,
                url: req.originalUrl,
                duration: `${duration.toFixed(2)}ms`,
                statusCode: res.statusCode,
                userId: (req as any).user?.uid,
            });
        }

        // Log performance metrics
        logger.debug('Request performance', {
            requestId: (req as any).requestId,
            duration: `${duration.toFixed(2)}ms`,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
        });
    });

    next();
};

/**
 * Security event logging
 */
export const securityLogger = {
    loginAttempt: (email: string, success: boolean, ip: string, userAgent?: string) => {
        const logLevel = success ? 'info' : 'warn';
        logger[logLevel]('Login attempt', {
            email,
            success,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
        });
    },

    passwordReset: (email: string, ip: string, success: boolean) => {
        const logLevel = success ? 'info' : 'warn';
        logger[logLevel]('Password reset attempt', {
            email,
            ip,
            success,
            timestamp: new Date().toISOString(),
        });
    },

    suspiciousActivity: (activity: string, details: any) => {
        logger.warn('Suspicious activity detected', {
            activity,
            details,
            timestamp: new Date().toISOString(),
        });
    },

    rateLimitExceeded: (ip: string, userId?: string, details?: any) => {
        logger.warn('Rate limit exceeded', {
            ip,
            userId,
            details,
            timestamp: new Date().toISOString(),
        });
    },

    unauthorizedAccess: (resource: string, userId?: string, ip?: string) => {
        logger.warn('Unauthorized access attempt', {
            resource,
            userId,
            ip,
            timestamp: new Date().toISOString(),
        });
    },
};

/**
 * Business event logging
 */
export const businessLogger = {
    userRegistered: (userId: string, email: string, ip: string) => {
        logger.info('User registered', {
            userId,
            email,
            ip,
            timestamp: new Date().toISOString(),
        });
    },

    plannerCreated: (plannerId: string, userId: string, title: string) => {
        logger.info('Planner created', {
            plannerId,
            userId,
            title,
            timestamp: new Date().toISOString(),
        });
    },

    subscriptionUpgraded: (userId: string, oldPlan: string, newPlan: string) => {
        logger.info('Subscription upgraded', {
            userId,
            oldPlan,
            newPlan,
            timestamp: new Date().toISOString(),
        });
    },

    exportCompleted: (userId: string, exportType: string, fileSize: number) => {
        logger.info('Export completed', {
            userId,
            exportType,
            fileSize,
            timestamp: new Date().toISOString(),
        });
    },

    aiSuggestionUsed: (userId: string, suggestionType: string, confidence: number) => {
        logger.info('AI suggestion used', {
            userId,
            suggestionType,
            confidence,
            timestamp: new Date().toISOString(),
        });
    },
};

/**
 * Mask sensitive data in logs
 */
function maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secret',
        'creditCard',
        'ssn',
        'pin',
        'cvv',
        'authorization',
        'x-api-key',
    ];

    const maskValue = (value: string): string => {
        if (typeof value !== 'string' || value.length < 4) {
            return '***';
        }
        return `${value.substring(0, 2)}${'*'.repeat(value.length - 4)}${value.substring(value.length - 2)}`;
    };

    const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }

        if (typeof obj === 'object' && obj !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

                if (isSensitive) {
                    sanitized[key] = maskValue(String(value));
                } else if (typeof value === 'object') {
                    sanitized[key] = sanitize(value);
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }

        return obj;
    };

    return sanitize(data);
}