/**
 * Application error codes
 */
export enum AppErrorCode {
    // Authentication & Authorization
    AUTH_FAILED = 'AUTH_FAILED',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_INVALID = 'TOKEN_INVALID',
    ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
    EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
    TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
    TWO_FACTOR_INVALID = 'TWO_FACTOR_INVALID',

    // Validation Errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    BAD_REQUEST = 'BAD_REQUEST',
    INVALID_ID = 'INVALID_ID',
    INVALID_EMAIL = 'INVALID_EMAIL',
    INVALID_URL = 'INVALID_URL',
    INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
    INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
    INVALID_JSON = 'INVALID_JSON',
    INVALID_QUERY_PARAMETER = 'INVALID_QUERY_PARAMETER',
    INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',

    // Not Found Errors
    NOT_FOUND = 'NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    PLANNER_NOT_FOUND = 'PLANNER_NOT_FOUND',
    SECTION_NOT_FOUND = 'SECTION_NOT_FOUND',
    ACTIVITY_NOT_FOUND = 'ACTIVITY_NOT_FOUND',
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
    API_KEY_NOT_FOUND = 'API_KEY_NOT_FOUND',

    // Conflict Errors
    CONFLICT = 'CONFLICT',
    DUPLICATE = 'DUPLICATE',
    EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
    USERNAME_ALREADY_EXISTS = 'USERNAME_ALREADY_EXISTS',
    RESOURCE_IN_USE = 'RESOURCE_IN_USE',
    VERSION_CONFLICT = 'VERSION_CONFLICT',
    CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
    BURST_RATE_LIMIT_EXCEEDED = 'BURST_RATE_LIMIT_EXCEEDED',
    DAILY_RATE_LIMIT_EXCEEDED = 'DAILY_RATE_LIMIT_EXCEEDED',

    // Service Errors
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    CACHE_ERROR = 'CACHE_ERROR',
    QUEUE_ERROR = 'QUEUE_ERROR',
    EMAIL_ERROR = 'EMAIL_ERROR',
    FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
    FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
    PAYMENT_ERROR = 'PAYMENT_ERROR',
    SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',

    // Service Availability Errors
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    BAD_GATEWAY = 'BAD_GATEWAY',
    GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
    CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
    MAINTENANCE_MODE = 'MAINTENANCE_MODE',

    // Authentication Service Errors
    AUTH_SERVICE_ERROR = 'AUTH_SERVICE_ERROR',
    AUTH_SERVICE_UNAVAILABLE = 'AUTH_SERVICE_UNAVAILABLE',
    INVALID_AUTH_TOKEN = 'INVALID_AUTH_TOKEN',
    EXPIRED_AUTH_TOKEN = 'EXPIRED_AUTH_TOKEN',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',

    // Database Errors
    DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
    DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
    DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
    DUPLICATE_KEY_ERROR = 'DUPLICATE_KEY_ERROR',
    FOREIGN_KEY_CONSTRAINT_ERROR = 'FOREIGN_KEY_CONSTRAINT_ERROR',
    TRANSACTION_ERROR = 'TRANSACTION_ERROR',
    MIGRATION_ERROR = 'MIGRATION_ERROR',

    // Cache Errors
    CACHE_CONNECTION_ERROR = 'CACHE_CONNECTION_ERROR',
    CACHE_TIMEOUT = 'CACHE_TIMEOUT',
    CACHE_MISS = 'CACHE_MISS',
    CACHE_INVALIDATION_ERROR = 'CACHE_INVALIDATION_ERROR',

    // File Operation Errors
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
    FILE_READ_ERROR = 'FILE_READ_ERROR',
    FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
    FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
    FILE_MOVE_ERROR = 'FILE_MOVE_ERROR',
    FILE_COPY_ERROR = 'FILE_COPY_ERROR',
    INVALID_FILE_PATH = 'INVALID_FILE_PATH',
    FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',

    // External API Errors
    API_CONNECTION_ERROR = 'API_CONNECTION_ERROR',
    API_TIMEOUT_ERROR = 'API_TIMEOUT_ERROR',
    API_RESPONSE_ERROR = 'API_RESPONSE_ERROR',
    API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
    API_AUTHENTICATION_ERROR = 'API_AUTHENTICATION_ERROR',
    API_PERMISSION_DENIED = 'API_PERMISSION_DENIED',
    API_NOT_FOUND = 'API_NOT_FOUND',
    API_VALIDATION_ERROR = 'API_VALIDATION_ERROR',
    API_SERVER_ERROR = 'API_SERVER_ERROR',

    // Payment Errors
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PAYMENT_PROCESSING_ERROR = 'PAYMENT_PROCESSING_ERROR',
    PAYMENT_METHOD_INVALID = 'PAYMENT_METHOD_INVALID',
    PAYMENT_METHOD_EXPIRED = 'PAYMENT_METHOD_EXPIRED',
    PAYMENT_DECLINED = 'PAYMENT_DECLINED',
    PAYMENT_REQUIRES_ACTION = 'PAYMENT_REQUIRES_ACTION',
    PAYMENT_INTENT_INVALID = 'PAYMENT_INTENT_INVALID',
    SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
    SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
    SUBSCRIPTION_PAST_DUE = 'SUBSCRIPTION_PAST_DUE',
    INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
    INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
    REFUND_FAILED = 'REFUND_FAILED',
    REFUND_EXCEEDS_PAYMENT = 'REFUND_EXCEEDS_PAYMENT',

    // Security Errors
    SECURITY_ERROR = 'SECURITY_ERROR',
    INVALID_CSRF_TOKEN = 'INVALID_CSRF_TOKEN',
    XSS_DETECTED = 'XSS_DETECTED',
    SQL_INJECTION_DETECTED = 'SQL_INJECTION_DETECTED',
    MALICIOUS_INPUT_DETECTED = 'MALICIOUS_INPUT_DETECTED',
    SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
    IP_BLOCKED = 'IP_BLOCKED',
    GEO_RESTRICTION_VIOLATED = 'GEO_RESTRICTION_VIOLATED',

    // Validation and Business Logic Errors
    BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
    INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
    OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INVALID_PROMOTION_CODE = 'INVALID_PROMOTION_CODE',
    PROMOTION_CODE_EXPIRED = 'PROMOTION_CODE_EXPIRED',
    PROMOTION_CODE_ALREADY_USED = 'PROMOTION_CODE_ALREADY_USED',

    // Third-Party Service Errors
    EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
    SMS_SERVICE_ERROR = 'SMS_SERVICE_ERROR',
    PUSH_NOTIFICATION_SERVICE_ERROR = 'PUSH_NOTIFICATION_SERVICE_ERROR',
    STORAGE_SERVICE_ERROR = 'STORAGE_SERVICE_ERROR',
    CDN_SERVICE_ERROR = 'CDN_SERVICE_ERROR',
    ANALYTICS_SERVICE_ERROR = 'ANALYTICS_SERVICE_ERROR',
    MONITORING_SERVICE_ERROR = 'MONITORING_SERVICE_ERROR',
    AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
    AI_SERVICE_TIMEOUT = 'AI_SERVICE_TIMEOUT',
    AI_SERVICE_RATE_LIMIT = 'AI_SERVICE_RATE_LIMIT',

    // Client Errors
    CLIENT_ERROR = 'CLIENT_ERROR',
    BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
    DEVICE_NOT_SUPPORTED = 'DEVICE_NOT_SUPPORTED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    OFFLINE_MODE_NOT_AVAILABLE = 'OFFLINE_MODE_NOT_AVAILABLE',

    // Configuration Errors
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
    MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
    ENVIRONMENT_VARIABLE_MISSING = 'ENVIRONMENT_VARIABLE_MISSING',

    // Operational Errors
    OPERATION_FAILED = 'OPERATION_FAILED',
    OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
    OPERATION_CANCELLED = 'OPERATION_CANCELLED',
    OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',
    BATCH_OPERATION_FAILED = 'BATCH_OPERATION_FAILED',
    PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',

    // Unknown or Unexpected Errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
    UNHANDLED_ERROR = 'UNHANDLED_ERROR',
}

/**
 * HTTP status codes
 */
export enum HttpStatusCode {
    // Success codes
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    PARTIAL_CONTENT = 206,

    // Redirection codes
    MOVED_PERMANENTLY = 301,
    FOUND = 302,
    NOT_MODIFIED = 304,
    TEMPORARY_REDIRECT = 307,
    PERMANENT_REDIRECT = 308,

    // Client error codes
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    PAYMENT_REQUIRED = 402,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    NOT_ACCEPTABLE = 406,
    PROXY_AUTHENTICATION_REQUIRED = 407,
    REQUEST_TIMEOUT = 408,
    CONFLICT = 409,
    GONE = 410,
    LENGTH_REQUIRED = 411,
    PRECONDITION_FAILED = 412,
    PAYLOAD_TOO_LARGE = 413,
    URI_TOO_LONG = 414,
    UNSUPPORTED_MEDIA_TYPE = 415,
    RANGE_NOT_SATISFIABLE = 416,
    EXPECTATION_FAILED = 417,
    IM_A_TEAPOT = 418,
    UNPROCESSABLE_ENTITY = 422,
    TOO_EARLY = 425,
    UPGRADE_REQUIRED = 426,
    PRECONDITION_REQUIRED = 428,
    TOO_MANY_REQUESTS = 429,
    REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
    UNAVAILABLE_FOR_LEGAL_REASONS = 451,

    // Server error codes
    INTERNAL_SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
    GATEWAY_TIMEOUT = 504,
    HTTP_VERSION_NOT_SUPPORTED = 505,
    VARIANT_ALSO_NEGOTIATES = 506,
    INSUFFICIENT_STORAGE = 507,
    LOOP_DETECTED = 508,
    NOT_EXTENDED = 510,
    NETWORK_AUTHENTICATION_REQUIRED = 511,
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
    FATAL = 'fatal',
}

/**
 * Error category
 */
export enum ErrorCategory {
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    VALIDATION = 'validation',
    BUSINESS_LOGIC = 'business_logic',
    INFRASTRUCTURE = 'infrastructure',
    EXTERNAL_SERVICE = 'external_service',
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    UNKNOWN = 'unknown',
}

/**
 * Field error for validation errors
 */
export interface FieldError {
    field: string;
    message: string;
    value?: any;
    code?: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
    message: string;
    field?: string;
    value?: any;
    code?: string;
    constraints?: string[];
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: AppErrorCode;
        message: string;
        details?: any;
        timestamp: string;
        path?: string;
        method?: string;
        requestId?: string;
        severity?: ErrorSeverity;
        category?: ErrorCategory;
        help?: string;
        docs?: string;
    };
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = any> {
    success: true;
    data: T;
    metadata?: {
        timestamp: string;
        requestId?: string;
        version?: string;
        duration?: number;
    };
}

/**
 * Error context for logging and tracking
 */
export interface ErrorContext {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    url?: string;
    method?: string;
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
    timestamp: Date;
    environment: string;
    version: string;
    service: string;
    region?: string;
    availabilityZone?: string;
    instanceId?: string;
}

/**
 * Error tracking information
 */
export interface ErrorTrackingInfo {
    errorId: string;
    code: AppErrorCode;
    message: string;
    stack?: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    context: ErrorContext;
    fingerprint?: string;
    occurredAt: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
    resolution?: string;
    recurring: boolean;
    count: number;
    lastOccurredAt: Date;
    userImpact: {
        affectedUsers: number;
        affectedSessions: number;
    };
    metadata?: Record<string, any>;
}

/**
 * Error rate limiting information
 */
export interface ErrorRateLimitInfo {
    windowStart: Date;
    windowEnd: Date;
    errorCount: number;
    errorThreshold: number;
    rateLimitExceeded: boolean;
    errors: Array<{
        code: AppErrorCode;
        count: number;
        lastOccurred: Date;
    }>;
}

/**
 * Error aggregation data
 */
export interface ErrorAggregation {
    timeRange: {
        start: Date;
        end: Date;
    };
    totalErrors: number;
    uniqueErrors: number;
    errorsByCode: Record<AppErrorCode, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    topErrors: Array<{
        code: AppErrorCode;
        message: string;
        count: number;
        percentage: number;
    }>;
    errorTrend: Array<{
        timestamp: Date;
        count: number;
    }>;
    affectedUsers: number;
    errorRate: number; // errors per minute
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
    code: AppErrorCode;
    strategy: 'retry' | 'fallback' | 'circuit_break' | 'degrade' | 'fail';
    maxRetries?: number;
    retryDelay?: number;
    fallbackResponse?: any;
    circuitBreakerThreshold?: number;
    circuitBreakerTimeout?: number;
    degradationResponse?: any;
}

/**
 * HTTP error response headers
 */
export interface ErrorResponseHeaders {
    'X-Error-Code'?: AppErrorCode;
    'X-Error-ID'?: string;
    'X-Request-ID'?: string;
    'Retry-After'?: number;
    'X-RateLimit-Limit'?: number;
    'X-RateLimit-Remaining'?: number;
    'X-RateLimit-Reset'?: number;
}

/**
 * Error logging configuration
 */
export interface ErrorLoggingConfig {
    enabled: boolean;
    level: 'error' | 'warn' | 'info' | 'debug';
    includeStackTrace: boolean;
    includeContext: boolean;
    includeMetadata: boolean;
    redactSensitiveData: boolean;
    maxErrorDepth: number;
    samplingRate: number;
    bufferSize: number;
    flushInterval: number;
}

/**
 * Error alerting configuration
 */
export interface ErrorAlertingConfig {
    enabled: boolean;
    thresholds: {
        errorRate: number;
        errorCount: number;
        uniqueErrors: number;
        severity: {
            [ErrorSeverity.CRITICAL]: number;
            [ErrorSeverity.HIGH]: number;
            [ErrorSeverity.MEDIUM]: number;
        };
    };
    channels: Array<{
        type: 'email' | 'slack' | 'webhook' | 'sms';
        config: any;
        severity: ErrorSeverity[];
    }>;
    cooldownPeriod: number; // in seconds
    escalationRules: Array<{
        condition: string;
        action: string;
        delay: number;
    }>;
}

export {
    AppErrorCode,
    HttpStatusCode,
    ErrorSeverity,
    ErrorCategory,
    FieldError,
    ValidationError,
    ErrorResponse,
    SuccessResponse,
    ErrorContext,
    ErrorTrackingInfo,
    ErrorRateLimitInfo,
    ErrorAggregation,
    ErrorRecoveryStrategy,
    ErrorResponseHeaders,
    ErrorLoggingConfig,
    ErrorAlertingConfig,
};