import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const getCache = () => {
  const { cacheService } = require('@/shared/services/cache.service');
  return cacheService.instance;
};

/**
 * Safely extract request data to avoid getter-only properties
 */
const safeRequestData = (req: Request) => ({
  url: req.originalUrl,
  method: req.method,
  body: req.body,
  query: { ...req.query },
  params: { ...req.params },
  headers: { ...req.headers },
  ip: req.ip,
  userAgent: req.get('user-agent'),
  userId: (req as any).user?.uid,
});

/**
 * Error handling middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  try {
    let error: AppError;

    if (err instanceof AppError) {
      error = err;
    } else if (err.name === 'ValidationError') {
      const mongooseError = err as any;
      const details = Object.values(mongooseError.errors || {}).map((error: any) => ({
        field: error.path,
        message: error.message,
        value: error.value,
      }));
      error = new AppError('Validation failed', 400, JSON.stringify(details), ErrorCode.INVALID_INPUT);
    } else if (err.name === 'CastError') {
      const castError = err as any;
      error = new AppError(
        `Invalid ${castError.path}: ${castError.value}`,
        400,
        undefined,
        ErrorCode.INVALID_INPUT
      );
    } else if ((err as any).code === 11000) {
      const field = Object.keys((err as any).keyValue || {})[0];
      error = new AppError(
        `${field} already exists`,
        409,
        undefined,
        ErrorCode.CONFLICT
      );
    } else if (err.name === 'JsonWebTokenError') {
      error = new AppError('Invalid token', 401, undefined, ErrorCode.TOKEN_INVALID);
    } else if (err.name === 'TokenExpiredError') {
      error = new AppError('Token expired', 401, undefined, ErrorCode.TOKEN_EXPIRED);
    } else if ((err as any).code === 'ECONNREFUSED') {
      error = new AppError('Service temporarily unavailable', 503, undefined, ErrorCode.SERVICE_UNAVAILABLE);
    } else if ((err as any).code === 'ENOTFOUND') {
      error = new AppError('External service not found', 503, undefined, ErrorCode.SERVICE_UNAVAILABLE);
    } else if ((err as any).code === 'ETIMEDOUT') {
      error = new AppError('Request timeout', 408, undefined, ErrorCode.SERVICE_UNAVAILABLE);
    } else {
      logger.error('Unexpected error', err, safeRequestData(req));

      if (config.app.env === 'production') {
        error = new AppError('Internal server error', 500, undefined, ErrorCode.EXTERNAL_SERVICE_ERROR);
      } else {
        error = new AppError(
          err.message || 'Internal server error',
          500,
          err.stack || undefined,
          ErrorCode.EXTERNAL_SERVICE_ERROR
        );
      }
    }

    logError(error, req);
    sendErrorResponse(error, req, res);
  } catch (processingError) {
    logger.error('Error processing failed', processingError);
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

/**
 * Log error for monitoring
 */
const logError = async (error: AppError, req: Request): Promise<void> => {
  try {
    const errorLog = {
      timestamp: new Date().toISOString(),
      level: getErrorLevel(error.statusCode),
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...safeRequestData(req),
      details: error.details,
      stack: error.stack,
    };

    switch (errorLog.level) {
      case 'error':
        logger.error('Request error', errorLog);
        break;
      case 'warn':
        logger.warn('Request warning', errorLog);
        break;
      default:
        logger.info('Request info', errorLog);
    }

    if (error.statusCode >= 500) {
      await getCache().set(
        `error:${Date.now()}:${Math.random()}`,
        JSON.stringify(errorLog),
        { ttl: 60 * 60 * 24 }
      );
    }
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
};

const getErrorLevel = (statusCode: number): 'error' | 'warn' | 'info' => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
};

/**
 * Send error response to client
 */
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

    if (error.details && error.details.length > 0) {
      response.error.details = error.details;
    }

    const requestId = (req as any).requestId;
    if (requestId) response.error.requestId = requestId;

    const correlationId = req.get('X-Correlation-ID');
    if (correlationId) response.error.correlationId = correlationId;

    if (config.app.env === 'development' && error.stack) {
      response.error.debug = {
        stack: error.stack,
        originalError: error.message,
      };
    }

    res.status(error.statusCode).json(response);
  } catch (responseError) {
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

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    undefined,
    ErrorCode.NOT_FOUND
  );
  next(error);
};

/**
 * Async handler wrapper
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error('Async handler error', error, safeRequestData(req));

    if (!(error instanceof AppError)) {
      error = new AppError(
        error.message || 'Internal server error',
        (error.statusCode as number) || (error.status as number) || 500,
        undefined,
        (error.code as string) || 'INTERNAL_ERROR'
      );
    }

    next(error);
  });
};

// Global shutdown handlers
['uncaughtException', 'unhandledRejection'].forEach((event) =>
  process.on(event as any, async (err: any, promise?: Promise<any>) => {
    try {
      logger.error(event === 'unhandledRejection' ? 'UNHANDLED REJECTION! 💥' : 'UNCAUGHT EXCEPTION! 💥', err);
      await getCache().disconnect();
    } catch (cleanupError) {
      console.error('Cleanup failed during shutdown:', cleanupError);
    }
    process.exit(1);
  })
);

['SIGTERM', 'SIGINT'].forEach((sig) =>
  process.on(sig, async () => {
    try {
      logger.info(`👋 ${sig} RECEIVED. Shutting down gracefully`);
      await getCache().disconnect();
    } catch (cleanupError) {
      console.error(`Cleanup failed during ${sig}:`, cleanupError);
    }
    process.exit(0);
  })
);
