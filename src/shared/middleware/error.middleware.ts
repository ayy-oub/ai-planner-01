import { Request, Response, NextFunction } from 'express';
import { config } from '@shared/config';
import { AppError, ErrorCodes } from '@shared/utils/errors';
import { Logger } from '@shared/utils/logger';
import { CacheService } from '@shared/services/cache.service';

const cacheService = new CacheService();

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        let error: AppError;

        if (err instanceof AppError) {
            error = err;
        } else if (err.name === 'ValidationError') {
            // Handle Mongoose validation errors
            const mongooseError = err as any;
            const details = Object.values(mongooseError.errors || {}).map((error: any) => ({
                field: error.path,
                message: error.message,
                value: error.value,
            }));

            error = new AppError('Validation failed', 400, details, ErrorCodes.INVALID_INPUT);
        } else if (err.name === 'CastError') {
            // Handle Mongoose cast errors
            const castError = err as any;
            error = new AppError(
                `Invalid ${castError.path}: ${castError.value}`,
                400,
                undefined,
                ErrorCodes.INVALID_INPUT
            );
        } else if (err.code === 11000) {
            // Handle duplicate key errors
            const field = Object.keys(err.keyValue || {})[0];
            error = new AppError(
                `${field} already exists`,
                409,
                undefined,
                ErrorCodes.CONFLICT
            );
        } else if (err.name === 'JsonWebTokenError') {
            error = new AppError('Invalid token', 401, undefined, ErrorCodes.TOKEN_INVALID);
        } else if (err.name === 'TokenExpiredError') {
            error = new AppError('Token expired', 401, undefined, ErrorCodes.TOKEN_EXPIRED);
        } else if (err.code === 'ECONNREFUSED') {
            error = new AppError('Service temporarily unavailable', 503, undefined, ErrorCodes.SERVICE_UNAVAILABLE);
        } else if (err.code === 'ENOTFOUND') {
            error = new AppError('External service not found', 503, undefined, ErrorCodes.SERVICE_UNAVAILABLE);
        } else if (err.code === 'ETIMEDOUT') {
            error = new AppError('Request timeout', 408, undefined, ErrorCodes.SERVICE_UNAVAILABLE);
        } else {
            // Log unexpected errors
            Logger.error('Unexpected error', err, {
                url: req.originalUrl,
                method: req.method,
                body: req.body,
                query: req.query,
                params: req.params,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: (req as any).user?.uid,
            });

            // Don't leak error details in production
            if (config.app.env === 'production') {
                error = new AppError('Internal server error', 500, undefined, ErrorCodes.INTERNAL_SERVER_ERROR);
            } else {
                error = new AppError(
                    err.message || 'Internal server error',
                    500,
                    err.stack ? [{ stack: err.stack }] : undefined,
                    ErrorCodes.INTERNAL_SERVER_ERROR
                );
            }
        }

        // Log error for monitoring
        logError(error, req);

        // Send error response
        sendErrorResponse(error, req, res);
    } catch (processingError) {
        // If error processing itself fails, send a generic error
        Logger.error('Error processing failed', processingError);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
            },
        });
    }
};

const logError = async (error: AppError, req: Request): Promise<void> => {
    try {
        const errorLog = {
            timestamp: new Date().toISOString(),
            level: getErrorLevel(error.statusCode),
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: (req as any).user?.uid,
            details: error.details,
            stack: error.stack,
        };

        // Log to different levels based on status code
        switch (errorLog.level) {
            case 'error':
                Logger.error('Request error', errorLog);
                break;
            case 'warn':
                Logger.warn('Request warning', errorLog);
                break;
            default:
                Logger.info('Request info', errorLog);
        }

        // Store critical errors in cache for monitoring
        if (error.statusCode >= 500) {
            await cacheService.set(
                `error:${Date.now()}:${Math.random()}`,
                JSON.stringify(errorLog),
                60 * 60 * 24 // 24 hours
            );
        }
    } catch (loggingError) {
        // If logging fails, just log to console to avoid infinite loops
        console.error('Failed to log error:', loggingError);
    }
};

const getErrorLevel = (statusCode: number): 'error' | 'warn' | 'info' => {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
};

const sendErrorResponse = (error: AppError, req: Request, res: Response): void => {
    try {
        const response: any = {
            success: false,
            error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message,
                timestamp: new Date().toISOString(),
                path: req.originalUrl,
            },
        };

        // Add details if available
        if (error.details && error.details.length > 0) {
            response.error.details = error.details;
        }

        // Add request ID if available
        const requestId = (req as any).id;
        if (requestId) {
            response.error.requestId = requestId;
        }

        // Add correlation ID for distributed tracing
        const correlationId = req.get('X-Correlation-ID');
        if (correlationId) {
            response.error.correlationId = correlationId;
        }

        // Add debug information in development
        if (config.app.env === 'development' && error.stack) {
            response.error.debug = {
                stack: error.stack,
                originalError: error.message,
            };
        }

        res.status(error.statusCode).json(response);
    } catch (responseError) {
        // If response sending fails, this is critical
        console.error('Failed to send error response:', responseError);
        res.status(500).json({
            success: false,
            error: {
                code: 'RESPONSE_ERROR',
                message: 'Failed to process error response',
                timestamp: new Date().toISOString(),
            },
        });
    }
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const error = new AppError(
            `Route ${req.originalUrl} not found`,
            404,
            undefined,
            ErrorCodes.NOT_FOUND
        );
        next(error);
    } catch (error) {
        console.error('Not found handler error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'NOT_FOUND_HANDLER_ERROR',
                message: 'An error occurred while processing the request',
                timestamp: new Date().toISOString(),
            },
        });
    }
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
        try {
            // Log the error for debugging
            Logger.error('Async handler error', error, {
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userId: (req as any).user?.uid,
            });

            // Convert to AppError if not already
            if (!(error instanceof AppError)) {
                error = new AppError(
                    error.message || 'Internal server error',
                    error.statusCode || error.status || 500,
                    undefined,
                    error.code || 'INTERNAL_ERROR'
                );
            }

            next(error);
        } catch (handlerError) {
            // If error handling fails, send a generic error
            console.error('Async handler processing failed:', handlerError);
            next(new AppError('Internal server error', 500, undefined, 'INTERNAL_ERROR'));
        }
    });
};

// Global error handlers for uncaught exceptions
process.on('uncaughtException', async (error: Error) => {
    try {
        Logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', error);
        await cacheService.disconnect();
    } catch (cleanupError) {
        console.error('Cleanup failed during uncaught exception:', cleanupError);
    }
    process.exit(1);
});

process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
    try {
        Logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
            reason,
            promise: promise.toString(),
        });
        await cacheService.disconnect();
    } catch (cleanupError) {
        console.error('Cleanup failed during unhandled rejection:', cleanupError);
    }
    process.exit(1);
});

process.on('SIGTERM', async () => {
    try {
        Logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
        await cacheService.disconnect();
    } catch (cleanupError) {
        console.error('Cleanup failed during SIGTERM:', cleanupError);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    try {
        Logger.info('👋 SIGINT RECEIVED. Shutting down gracefully');
        await cacheService.disconnect();
    } catch (cleanupError) {
        console.error('Cleanup failed during SIGINT:', cleanupError);
    }
    process.exit(0);
});