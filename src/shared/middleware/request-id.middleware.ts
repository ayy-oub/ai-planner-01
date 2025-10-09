import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
const { v4: uuidv4 } = require('uuid');
/**
 * Request ID middleware configuration
 */
export interface RequestIdOptions {
    headerName?: string;
    generateId?: () => string;
    setHeader?: boolean;
    attributeName?: string;
}

/**
 * Request ID middleware
 */
export class RequestIdMiddleware {
    private options: Required<RequestIdOptions>;

    constructor(options: RequestIdOptions = {}) {
        this.options = {
            headerName: options.headerName || 'x-request-id',
            generateId: options.generateId || (() => uuidv4()),
            setHeader: options.setHeader !== false,
            attributeName: options.attributeName || 'requestId',
        };
    }

    /**
     * Main request ID middleware
     */
    middleware = (req: Request, res: Response, next: NextFunction) => {
        // Get request ID from header or generate new one
        const requestId = req.headers[this.options.headerName] as string || this.options.generateId();

        // Store request ID in request object
        (req as any)[this.options.attributeName] = requestId;

        // Set request ID in response header
        if (this.options.setHeader) {
            res.setHeader(this.options.headerName, requestId);
        }

        // Add request ID to logger context
        logger.defaultMeta = {
            ...logger.defaultMeta,
            requestId,
        };

        next();
    };

    /**
     * Express middleware function
     */
    express = (req: Request, res: Response, next: NextFunction) => {
        this.middleware(req, res, next);
    };
}

/**
 * Create request ID middleware with custom options
 */
export const createRequestIdMiddleware = (options?: RequestIdOptions) => {
    const middleware = new RequestIdMiddleware(options);
    return middleware.express;
};

/**
 * Default request ID middleware
 */
export const requestId = createRequestIdMiddleware();

/**
 * Request ID middleware with correlation ID support
 */
export const requestIdWithCorrelation = (req: Request, res: Response, next: NextFunction) => {
    // Get correlation ID from header or generate new one
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const requestId = req.headers['x-request-id'] as string || uuidv4();

    // Store both IDs in request
    (req as any).requestId = requestId;
    (req as any).correlationId = correlationId;

    // Set headers in response
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    // Update logger context
    logger.defaultMeta = {
        ...logger.defaultMeta,
        requestId,
        correlationId,
    };

    next();
};

/**
 * Request tracing middleware with multiple IDs
 */
export const requestTracing = (req: Request, res: Response, next: NextFunction) => {
    const ids = {
        requestId: req.headers['x-request-id'] as string || uuidv4(),
        correlationId: req.headers['x-correlation-id'] as string || uuidv4(),
        traceId: req.headers['x-trace-id'] as string || uuidv4(),
        spanId: req.headers['x-span-id'] as string || uuidv4(),
        parentId: req.headers['x-parent-id'] as string,
    };

    // Store all IDs in request
    Object.entries(ids).forEach(([key, value]) => {
        if (value) {
            (req as any)[key] = value;
            res.setHeader(`x-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
        }
    });

    // Create trace context
    const traceContext = {
        ...ids,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('user-agent'),
        ip: req.ip,
    };

    // Store trace context
    (req as any).traceContext = traceContext;

    // Update logger
    logger.defaultMeta = {
        ...logger.defaultMeta,
        ...ids,
    };

    next();
};

/**
 * Request ID propagation for service-to-service calls
 */
export const propagateRequestId = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        const requestId = (req as any).requestId || uuidv4();

        // Store in a way that can be accessed by HTTP clients
        (req as any).headers = {
            ...req.headers,
            'x-request-id': requestId,
        };

        // For axios/fetch interceptors
        (req as any).getRequestHeaders = () => ({
            'x-request-id': requestId,
            'x-correlation-id': (req as any).correlationId || requestId,
            'x-trace-id': (req as any).traceId || requestId,
        });

        next();
    };
};

/**
 * Request timing middleware with ID
 */
export const requestTiming = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId || uuidv4();
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        logger.info('Request timing', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration.toFixed(2)}ms`,
            userId: (req as any).user?.uid,
        });
    });

    next();
};

/**
 * Request ID validation middleware
 */
export const validateRequestId = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;

    if (requestId && !isValidUuid(requestId)) {
        logger.warn('Invalid request ID format', {
            requestId,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
        });

        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST_ID',
                message: 'Invalid request ID format',
            },
        });
    }

    next();
};

/**
 * UUID validation
 */
function isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Request ID namespace middleware for multi-tenant applications
 */
export const requestIdNamespace = (namespace: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const baseRequestId = req.headers['x-request-id'] as string || uuidv4();
        const namespacedRequestId = `${namespace}-${baseRequestId}`;

        (req as any).requestId = namespacedRequestId;
        (req as any).baseRequestId = baseRequestId;
        res.setHeader('x-request-id', namespacedRequestId);

        next();
    };
};

/**
 * Default request ID middleware options
 */
export const defaultRequestIdOptions: Required<RequestIdOptions> = {
    headerName: 'x-request-id',
    generateId: () => uuidv4(),
    setHeader: true,
    attributeName: 'requestId',
};