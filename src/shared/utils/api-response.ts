import { Response } from 'express';
import { AppError } from './errors';

/**
 * API response metadata
 */
export interface ResponseMetadata {
    timestamp: string;
    requestId?: string;
    version?: string;
    duration?: number;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = any> {
    success: true;
    data: T;
    metadata?: ResponseMetadata;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
        path?: string;
        method?: string;
    };
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * API response helper class
 */
export class ApiResponse {
    private requestId?: string;
    private startTime: number;

    constructor(private req?: any) {
        this.startTime = Date.now();
        this.requestId = req?.requestId || req?.id;
    }

    /**
     * Create success response
     */
    success<T>(data: T, message?: string): SuccessResponse<T> {
        const metadata: ResponseMetadata = {
            timestamp: new Date().toISOString(),
            requestId: this.requestId,
            version: process.env.API_VERSION || 'v1',
            duration: Date.now() - this.startTime,
        };

        const response: SuccessResponse<T> = {
            success: true,
            data,
            metadata,
        };

        // Add message if provided
        if (message) {
            (response as any).message = message;
        }

        return response;
    }

    /**
     * Create paginated response
     */
    paginated<T>(data: T[], pagination: PaginationInfo): SuccessResponse<{
        items: T[];
        pagination: PaginationInfo;
    }> {
        return this.success({
            items: data,
            pagination,
        });
    }

    /**
     * Create created response
     */
    created<T>(data: T, message: string = 'Resource created successfully'): SuccessResponse<T> {
        const response = this.success(data, message);
        (response as any).statusCode = 201;
        return response;
    }

    /**
     * Create updated response
     */
    updated<T>(data: T, message: string = 'Resource updated successfully'): SuccessResponse<T> {
        return this.success(data, message);
    }

    /**
     * Create deleted response
     */
    deleted(message: string = 'Resource deleted successfully'): SuccessResponse<null> {
        return this.success(null, message);
    }

    /**
     * Create error response
     */
    error(error: AppError): ErrorResponse {
        const metadata: ResponseMetadata = {
            timestamp: new Date().toISOString(),
            requestId: this.requestId,
            version: process.env.API_VERSION || 'v1',
            duration: Date.now() - this.startTime,
        };

        return {
            success: false,
            error: {
                code: error.getErrorCode(),
                message: error.message,
                details: error.details,
                timestamp: metadata.timestamp,
                path: this.req?.originalUrl,
                method: this.req?.method,
            },
        };
    }

    /**
     * Create validation error response
     */
    validationError(errors: any[], message: string = 'Validation failed'): ErrorResponse {
        const error = new AppError(message, 400, 'VALIDATION_ERROR', errors);
        return this.error(error);
    }

    /**
     * Create not found response
     */
    notFound(resource: string = 'Resource'): ErrorResponse {
        const error = new AppError(`${resource} not found`, 404, 'NOT_FOUND');
        return this.error(error);
    }

    /**
     * Create unauthorized response
     */
    unauthorized(message: string = 'Unauthorized'): ErrorResponse {
        const error = new AppError(message, 401, 'UNAUTHORIZED');
        return this.error(error);
    }

    /**
     * Create forbidden response
     */
    forbidden(message: string = 'Forbidden'): ErrorResponse {
        const error = new AppError(message, 403, 'FORBIDDEN');
        return this.error(error);
    }

    /**
     * Create conflict response
     */
    conflict(message: string, details?: any): ErrorResponse {
        const error = new AppError(message, 409, 'CONFLICT', details);
        return this.error(error);
    }

    /**
     * Create rate limit response
     */
    rateLimit(retryAfter?: number): ErrorResponse {
        const error = new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
        return this.error(error);
    }

    /**
     * Create internal error response
     */
    internalError(message: string = 'Internal server error'): ErrorResponse {
        const error = new AppError(message, 500, 'INTERNAL_ERROR');
        return this.error(error);
    }
}

/**
 * Express response helpers
 */
export class ExpressResponse {
    /**
     * Send success response
     */
    static success<T>(res: Response, data: T, message?: string, statusCode: number = 200): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.success(data, message);

        return res.status(statusCode).json(response);
    }

    /**
     * Send created response
     */
    static created<T>(res: Response, data: T, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.created(data, message);

        return res.status(201).json(response);
    }

    /**
     * Send paginated response
     */
    static paginated<T>(
        res: Response,
        data: T[],
        pagination: PaginationInfo,
        statusCode: number = 200
    ): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.paginated(data, pagination);

        return res.status(statusCode).json(response);
    }

    /**
     * Send updated response
     */
    static updated<T>(res: Response, data: T, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.updated(data, message);

        return res.status(200).json(response);
    }

    /**
     * Send deleted response
     */
    static deleted(res: Response, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.deleted(message);

        return res.status(200).json(response);
    }

    /**
     * Send error response
     */
    static error(res: Response, error: AppError): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.error(error);

        return res.status(error.getStatusCode()).json(response);
    }

    /**
     * Send validation error response
     */
    static validationError(res: Response, errors: any[], message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.validationError(errors, message);

        return res.status(400).json(response);
    }

    /**
     * Send not found response
     */
    static notFound(res: Response, resource?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.notFound(resource);

        return res.status(404).json(response);
    }

    /**
     * Send unauthorized response
     */
    static unauthorized(res: Response, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.unauthorized(message);

        return res.status(401).json(response);
    }

    /**
     * Send forbidden response
     */
    static forbidden(res: Response, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.forbidden(message);

        return res.status(403).json(response);
    }

    /**
     * Send conflict response
     */
    static conflict(res: Response, message: string, details?: any): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.conflict(message, details);

        return res.status(409).json(response);
    }

    /**
     * Send rate limit response
     */
    static rateLimit(res: Response, retryAfter?: number): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.rateLimit(retryAfter);

        return res.status(429).json(response);
    }

    /**
     * Send internal error response
     */
    static internalError(res: Response, message?: string): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.internalError(message);

        return res.status(500).json(response);
    }

    /**
     * Send no content response
     */
    static noContent(res: Response): Response {
        return res.status(204).send();
    }

    /**
     * Send accepted response
     */
    static accepted<T>(res: Response, data?: T): Response {
        const apiResponse = new ApiResponse(res.req);
        const response = apiResponse.success(data || null, 'Request accepted');

        return res.status(202).json(response);
    }
}

/**
 * Response utilities
 */
export const responseUtils = {
    /**
     * Create HATEOAS links
     */
    createLinks(baseUrl: string, links: Record<string, string>): Record<string, string> {
        const result: Record<string, string> = {};

        for (const [rel, path] of Object.entries(links)) {
            result[rel] = new URL(path, baseUrl).toString();
        }

        return result;
    },

    /**
     * Create pagination headers
     */
    createPaginationHeaders(pagination: PaginationInfo): Record<string, string> {
        return {
            'X-Total-Count': pagination.total.toString(),
            'X-Page': pagination.page.toString(),
            'X-Limit': pagination.limit.toString(),
            'X-Pages': pagination.pages.toString(),
            'X-Has-Next': pagination.hasNext.toString(),
            'X-Has-Prev': pagination.hasPrev.toString(),
        };
    },

    /**
     * Create rate limit headers
     */
    createRateLimitHeaders(
        limit: number,
        remaining: number,
        reset: Date,
        retryAfter?: number
    ): Record<string, string> {
        const headers: Record<string, string> = {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': Math.floor(reset.getTime() / 1000).toString(),
        };

        if (retryAfter) {
            headers['Retry-After'] = retryAfter.toString();
        }

        return headers;
    },

    /**
     * Standard response times
     */
    responseTimes: {
        OK: 200,
        CREATED: 201,
        ACCEPTED: 202,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
        BAD_GATEWAY: 502,
        SERVICE_UNAVAILABLE: 503,
    },

    /**
     * Common response messages
     */
    messages: {
        CREATED: 'Resource created successfully',
        UPDATED: 'Resource updated successfully',
        DELETED: 'Resource deleted successfully',
        NOT_FOUND: 'Resource not found',
        UNAUTHORIZED: 'Authentication required',
        FORBIDDEN: 'Access denied',
        VALIDATION_ERROR: 'Validation failed',
        INTERNAL_ERROR: 'Internal server error',
        RATE_LIMIT: 'Too many requests',
        SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    },
};

/**
 * API versioning utilities
 */
export const versioningUtils = {
    /**
     * Get API version from request
     */
    getVersionFromRequest(req: any): string {
        // Check headers first
        const headerVersion = req.headers['api-version'];
        if (headerVersion) return headerVersion as string;

        // Check query parameters
        const queryVersion = req.query.version;
        if (queryVersion) return queryVersion as string;

        // Check URL path
        const pathMatch = req.path.match(/\/v(\d+)\//);
        if (pathMatch) return pathMatch[1];

        // Default version
        return process.env.API_VERSION || '1';
    },

    /**
     * Check if version is supported
     */
    isVersionSupported(version: string, supportedVersions: string[]): boolean {
        return supportedVersions.includes(version);
    },

    /**
     * Create versioned response
     */
    createVersionedResponse<T>(version: string, data: T): T {
        // Add version metadata
        (data as any).apiVersion = version;
        (data as any).versionedAt = new Date().toISOString();
        return data;
    },
};

/**
 * Response caching utilities
 */
export const cachingUtils = {
    /**
     * Set cache headers
     */
    setCacheHeaders(
        res: Response,
        options: {
            maxAge?: number;
            etag?: string;
            lastModified?: Date;
            private?: boolean;
            noCache?: boolean;
            noStore?: boolean;
        } = {}
    ): void {
        const {
            maxAge = 0,
            etag,
            lastModified,
            private: isPrivate = false,
            noCache = false,
            noStore = false,
        } = options;

        if (noStore) {
            res.setHeader('Cache-Control', 'no-store');
            return;
        }

        if (noCache) {
            res.setHeader('Cache-Control', 'no-cache');
            return;
        }

        let cacheControl = isPrivate ? 'private' : 'public';

        if (maxAge > 0) {
            cacheControl += `, max-age=${maxAge}`;
        }

        res.setHeader('Cache-Control', cacheControl);

        if (etag) {
            res.setHeader('ETag', `"${etag}"`);
        }

        if (lastModified) {
            res.setHeader('Last-Modified', lastModified.toUTCString());
        }
    },

    /**
     * Check if client cache is still valid
     */
    isCacheValid(req: any, etag?: string, lastModified?: Date): boolean {
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];

        if (ifNoneMatch && etag) {
            return ifNoneMatch === `"${etag}"`;
        }

        if (ifModifiedSince && lastModified) {
            return new Date(ifModifiedSince) >= lastModified;
        }

        return false;
    },
};