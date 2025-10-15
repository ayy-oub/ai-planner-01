/**
 * Base application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;
    public readonly details?: any;
    public readonly isOperational: boolean;
    public code: string;

    constructor(
        message: string,
        statusCode: number = 500,
        errorCode: string = 'INTERNAL_ERROR',
        details?: any,
        isOperational: boolean = true,
        code = "INTERNAL_ERROR"
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);

        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = isOperational;
        this.code = code;

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON representation
     */
    toJSON() {
        return {
            error: {
                code: this.errorCode,
                message: this.message,
                details: this.details,
                timestamp: new Date().toISOString(),
            },
        };
    }

    /**
     * Get HTTP status code
     */
    getStatusCode(): number {
        return this.statusCode;
    }

    /**
     * Get error code
     */
    getErrorCode(): string {
        return this.errorCode;
    }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed', errorCode: string = 'AUTH_FAILED') {
        super(message, 401, errorCode);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized access', errorCode: string = 'UNAUTHORIZED') {
        super(message, 403, errorCode);
    }
}

export class TokenExpiredError extends AppError {
    constructor(message: string = 'Token has expired', errorCode: string = 'TOKEN_EXPIRED') {
        super(message, 401, errorCode);
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string = 'Validation failed', details?: any) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = 'Bad request', details?: any) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'FORBIDDEN', details?: any) {
        super(message, 403, 'FORBIDDEN', details);
    }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
    constructor(message: string = 'Database operation failed', details?: any) {
        super(message, 500, 'DATABASE_ERROR', details);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource', details?: any) {
        super(`${resource} not found`, 404, 'NOT_FOUND', details);
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource conflict', details?: any) {
        super(message, 409, 'CONFLICT', details);
    }
}

export class DuplicateError extends AppError {
    constructor(resource: string = 'Resource', details?: any) {
        super(`${resource} already exists`, 409, 'DUPLICATE', details);
    }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests', retryAfter?: number) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    }
}

/**
 * Service errors
 */
export class ServiceUnavailableError extends AppError {
    constructor(message: string = 'Service temporarily unavailable', details?: any) {
        super(message, 503, 'SERVICE_UNAVAILABLE', details);
    }
}

export class ExternalServiceError extends AppError {
    constructor(service: string, details?: any) {
        super(`${service} service error`, 503, 'EXTERNAL_SERVICE_ERROR', details);
    }
}

/**
 * File operation errors
 */
export class FileUploadError extends AppError {
    constructor(message: string = 'File upload failed', details?: any) {
        super(message, 400, 'FILE_UPLOAD_ERROR', details);
    }
}

export class FileTypeError extends AppError {
    constructor(allowedTypes: string[], actualType: string) {
        super(
            `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
            400,
            'INVALID_FILE_TYPE',
            { allowedTypes, actualType }
        );
    }
}

export class FileSizeError extends AppError {
    constructor(maxSize: number, actualSize: number) {
        super(
            `File too large. Maximum size: ${maxSize} bytes`,
            400,
            'FILE_TOO_LARGE',
            { maxSize, actualSize }
        );
    }
}

/**
 * Cache errors
 */
export class CacheError extends AppError {
    constructor(message: string = 'Cache operation failed', details?: any) {
        super(message, 500, 'CACHE_ERROR', details);
    }
}

/**
 * Queue errors
 */
export class QueueError extends AppError {
    constructor(message: string = 'Queue operation failed', details?: any) {
        super(message, 500, 'QUEUE_ERROR', details);
    }
}

/**
 * Email errors
 */
export class EmailError extends AppError {
    constructor(message: string = 'Email operation failed', details?: any) {
        super(message, 500, 'EMAIL_ERROR', details);
    }
}

/**
 * AI service errors
 */
export class AIServiceError extends AppError {
    constructor(message: string = 'AI service error', details?: any) {
        super(message, 503, 'AI_SERVICE_ERROR', details);
    }
}

/**
 * Circuit breaker errors
 */
export class CircuitBreakerError extends AppError {
    constructor(service: string, state: string) {
        super(
            `${service} service is unavailable (circuit breaker: ${state})`,
            503,
            'CIRCUIT_BREAKER_OPEN',
            { service, state }
        );
    }
}

/**
 * Error codes enum
 */
export enum ErrorCode {
    // Authentication errors
    AUTH_FAILED = 'AUTH_FAILED',
    UNAUTHORIZED = 'UNAUTHORIZED',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_INVALID = 'TOKEN_INVALID',
    ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
    EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',

    // Validation errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    BAD_REQUEST = 'BAD_REQUEST',
    INVALID_ID = 'INVALID_ID',
    INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',

    // Not found errors
    NOT_FOUND = 'NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    PLANNER_NOT_FOUND = 'PLANNER_NOT_FOUND',
    SECTION_NOT_FOUND = 'SECTION_NOT_FOUND',
    ACTIVITY_NOT_FOUND = 'ACTIVITY_NOT_FOUND',
    EXPORT_FILE_NOT_FOUND = 'EXPORT_FILE_NOT_FOUND',

    // Conflict errors
    CONFLICT = 'CONFLICT',
    DUPLICATE = 'DUPLICATE',
    EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
    RESOURCE_IN_USE = 'RESOURCE_IN_USE',

    // Rate limiting errors
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

    // Service errors
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
    CACHE_ERROR = 'CACHE_ERROR',
    QUEUE_ERROR = 'QUEUE_ERROR',
    EMAIL_ERROR = 'EMAIL_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

    // File errors
    FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
    STORAGE_DELETE_FAILED = "STORAGE_DELETE_FAILED",

    // Payment errors
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PAYMENT_PROCESSING_ERROR = 'PAYMENT_PROCESSING_ERROR',
    SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

    // Permission errors
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

    // External API errors
    API_CONNECTION_ERROR = 'API_CONNECTION_ERROR',
    API_TIMEOUT_ERROR = 'API_TIMEOUT_ERROR',
    API_RESPONSE_ERROR = 'API_RESPONSE_ERROR',
    API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',

    INVALID_INPUT = 'INVALID_INPUT'
}

/**
 * HTTP status codes
 */
export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
    GATEWAY_TIMEOUT = 504,
}

/**
 * Error response interface
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
 * Success response interface
 */
export interface SuccessResponse<T = any> {
    success: true;
    data: T;
    metadata?: {
        timestamp: string;
        requestId?: string;
        version?: string;
    };
}

/**
 * Error handler utility
 */
export class ErrorHandler {
    private static instance: ErrorHandler;

    private constructor() { }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle different types of errors and return appropriate AppError
     */
    handleError(error: any): AppError {
        // Already an AppError
        if (error instanceof AppError) {
            return error;
        }

        // Firebase errors
        if (error.code?.startsWith('auth/')) {
            return this.handleFirebaseAuthError(error);
        }

        // MongoDB errors
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            return this.handleMongoError(error);
        }

        // Redis errors
        if (error.code === 'ECONNREFUSED' && error.address === '127.0.0.1') {
            return new ServiceUnavailableError('Redis connection failed');
        }

        // JWT errors
        if (error.name === 'TokenExpiredError') {
            return new TokenExpiredError();
        }
        if (error.name === 'JsonWebTokenError') {
            return new AuthenticationError('Invalid token', 'INVALID_TOKEN');
        }

        // Validation errors
        if (error.name === 'ValidationError') {
            return new ValidationError('Validation failed', error.errors);
        }

        // Multer errors (file upload)
        if (error.code === 'LIMIT_FILE_SIZE') {
            return new FileSizeError(error.limit, error.size);
        }
        if (error.code === 'LIMIT_FILE_TYPE') {
            return new FileTypeError(error.allowedTypes, error.fileType);
        }

        // Default to internal error
        return new AppError(
            error.message || 'An unexpected error occurred',
            500,
            'INTERNAL_ERROR',
            { originalError: error.message }
        );
    }

    /**
     * Handle Firebase authentication errors
     */
    private handleFirebaseAuthError(error: any): AppError {
        const errorMap: Record<string, AppError> = {
            'auth/user-not-found': new NotFoundError('User'),
            'auth/wrong-password': new AuthenticationError('Invalid credentials'),
            'auth/too-many-requests': new RateLimitError('Too many failed login attempts'),
            'auth/user-disabled': new AuthenticationError('Account is disabled', 'ACCOUNT_DISABLED'),
            'auth/email-already-exists': new DuplicateError('Email address'),
            'auth/invalid-email': new ValidationError('Invalid email address'),
            'auth/weak-password': new ValidationError('Password is too weak'),
        };

        return errorMap[error.code] || new AuthenticationError(error.message);
    }

    /**
     * Handle MongoDB errors
     */
    private handleMongoError(error: any): AppError {
        if (error.code === 11000) {
            // Duplicate key error
            const field = Object.keys(error.keyValue || {})[0];
            return new DuplicateError(field || 'Resource');
        }

        if (error.name === 'CastError') {
            return new ValidationError('Invalid ID format', { field: error.path });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors || {}).map((err: any) => ({
                field: err.path,
                message: err.message,
            }));
            return new ValidationError('Validation failed', errors);
        }

        return new DatabaseError(error.message);
    }

    /**
     * Check if error is operational (expected) or programming error
     */
    isOperationalError(error: any): boolean {
        if (error instanceof AppError) {
            return error.isOperational;
        }

        // Consider these as operational errors
        const operationalErrors = [
            'ValidationError',
            'CastError',
            'TokenExpiredError',
            'JsonWebTokenError',
        ];

        return operationalErrors.includes(error.name);
    }
}

export const errorHandler = ErrorHandler.getInstance();