/**
 * API response metadata
 */
export interface ResponseMetadata {
    timestamp: string;
    requestId?: string;
    version?: string;
    duration?: number;
    serverTime?: string;
    timezone?: string;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage?: number;
    prevPage?: number;
    nextCursor?: string;
    prevCursor?: string;
}

/**
 * Basic API response structure
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: ApiError;
    metadata?: ResponseMetadata;
    pagination?: PaginationInfo;
    links?: Record<string, string>;
}

/**
 * API error structure
 */
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
    method?: string;
    requestId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical' | 'fatal';
    category?: string;
    help?: string;
    docs?: string;
    stack?: string; // Only in development
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T = any> extends ApiResponse<T> {
    success: true;
    data: T;
    error?: never;
}

/**
 * Error response wrapper
 */
export interface ErrorResponse extends ApiResponse<never> {
    success: false;
    data?: never;
    error: ApiError;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T = any> extends SuccessResponse<T> {
    pagination: PaginationInfo;
}

/**
 * List response with items
 */
export interface ListResponse<T = any> extends PaginatedResponse<{
    items: T[];
}> {
    data: {
        items: T[];
    };
}

/**
 * Single item response
 */
export interface ItemResponse<T = any> extends SuccessResponse<T> {
    data: T;
}

/**
 * Create response
 */
export interface CreateResponse<T = any> extends SuccessResponse<T> {
    data: T;
    links?: {
        self: string;
        parent?: string;
    };
}

/**
 * Update response
 */
export interface UpdateResponse<T = any> extends SuccessResponse<T> {
    data: T;
    links?: {
        self: string;
    };
}

/**
 * Delete response
 */
export interface DeleteResponse extends SuccessResponse<null> {
    data: null;
    message: string;
}

/**
 * Bulk operation response
 */
export interface BulkResponse<T = any> extends SuccessResponse<{
    successful: T[];
    failed: Array<{
        item: T;
        error: string;
    }>;
    total: number;
    successfulCount: number;
    failedCount: number;
}> {
    data: {
        successful: T[];
        failed: Array<{
            item: T;
            error: string;
        }>;
        total: number;
        successfulCount: number;
        failedCount: number;
    };
}

/**
 * Import/Export response
 */
export interface ImportExportResponse extends SuccessResponse<{
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: {
        total: number;
        processed: number;
        errors: number;
        warnings: string[];
    };
    downloadUrl?: string;
    expiresAt?: Date;
}> {
    data: {
        jobId: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        progress?: number;
        result?: {
            total: number;
            processed: number;
            errors: number;
            warnings: string[];
        };
        downloadUrl?: string;
        expiresAt?: Date;
    };
}

/**
 * Health check response
 */
export interface HealthResponse extends SuccessResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    environment: string;
    timestamp: string;
    checks: Record<string, {
        status: 'healthy' | 'unhealthy';
        message?: string;
        responseTime?: number;
    }>;
}> {
    data: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        uptime: number;
        version: string;
        environment: string;
        timestamp: string;
        checks: Record<string, {
            status: 'healthy' | 'unhealthy';
            message?: string;
            responseTime?: number;
        }>;
    };
}

/**
 * Authentication response
 */
export interface AuthResponse extends SuccessResponse<{
    user: any;
    tokens: {
        access: string;
        refresh: string;
        expiresIn: number;
        tokenType: 'Bearer';
    };
}> {
    data: {
        user: any;
        tokens: {
            access: string;
            refresh: string;
            expiresIn: number;
            tokenType: 'Bearer';
        };
    };
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse extends SuccessResponse<{
    access: string;
    refresh?: string;
    expiresIn: number;
    tokenType: 'Bearer';
}> {
    data: {
        access: string;
        refresh?: string;
        expiresIn: number;
        tokenType: 'Bearer';
    };
}

/**
 * Error response with additional details
 */
export interface DetailedErrorResponse extends ErrorResponse {
    error: ApiError & {
        details?: {
            fields?: Array<{
                field: string;
                message: string;
                value?: any;
            }>;
            constraints?: string[];
            suggestions?: string[];
            documentation?: string;
            examples?: any[];
        };
    };
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse extends DetailedErrorResponse {
    error: ApiError & {
        code: 'VALIDATION_ERROR';
        details: {
            fields: Array<{
                field: string;
                message: string;
                value?: any;
                code?: string;
            }>;
        };
    };
}

/**
 * Rate limit error response
 */
export interface RateLimitErrorResponse extends ErrorResponse {
    error: ApiError & {
        code: 'RATE_LIMIT_EXCEEDED';
        details: {
            limit: number;
            remaining: number;
            reset: string; // ISO date string
            retryAfter: number; // seconds
            window: string;
        };
    };
}

/**
 * HATEOAS link
 */
export interface HateoasLink {
    rel: string;
    href: string;
    method?: string;
    title?: string;
    type?: string;
    deprecation?: string;
    name?: string;
    profile?: string;
    hreflang?: string;
}

/**
 * HATEOAS response
 */
export interface HateoasResponse<T = any> extends SuccessResponse<T> {
    links: HateoasLink[];
    embedded?: Record<string, any>;
}

/**
 * API versioning information
 */
export interface VersionInfo {
    version: string;
    releaseDate: string;
    changelog: string;
    deprecationDate?: string;
    sunsetDate?: string;
    supported: boolean;
    features: string[];
    breakingChanges?: string[];
}

/**
 * API version response
 */
export interface VersionResponse extends SuccessResponse<{
    current: VersionInfo;
    supported: VersionInfo[];
    deprecated: VersionInfo[];
}> {
    data: {
        current: VersionInfo;
        supported: VersionInfo[];
        deprecated: VersionInfo[];
    };
}

/**
 * Error tracking response
 */
export interface ErrorTrackingResponse extends SuccessResponse<{
    errorId: string;
    message: string;
    timestamp: string;
    reportUrl?: string;
}> {
    data: {
        errorId: string;
        message: string;
        timestamp: string;
        reportUrl?: string;
    };
}

/**
 * Analytics response
 */
export interface AnalyticsResponse extends SuccessResponse<{
    event: string;
    sessionId: string;
    timestamp: string;
}> {
    data: {
        event: string;
        sessionId: string;
        timestamp: string;
    };
}

/**
 * Feature flag response
 */
export interface FeatureFlagResponse extends SuccessResponse<{
    flags: Record<string, boolean>;
    experiments: Record<string, string>;
}> {
    data: {
        flags: Record<string, boolean>;
        experiments: Record<string, string>;
    };
}

/**
 * Webhook response
 */
export interface WebhookResponse extends SuccessResponse<{
    webhookId: string;
    event: string;
    status: 'delivered' | 'failed';
    attempts: number;
    lastAttempt?: string;
}> {
    data: {
        webhookId: string;
        event: string;
        status: 'delivered' | 'failed';
        attempts: number;
        lastAttempt?: string;
    };
}

/**
 * File upload response
 */
export interface FileUploadResponse extends SuccessResponse<{
    fileId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
    metadata?: Record<string, any>;
}> {
    data: {
        fileId: string;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
        thumbnailUrl?: string;
        metadata?: Record<string, any>;
    };
}

/**
 * Search response
 */
export interface SearchResponse<T = any> extends PaginatedResponse<T> {
    suggestions?: string[];
    highlights?: Array<{
        field: string;
        snippets: string[];
    }>;
    filters?: Array<{
        field: string;
        values: Array<{
            value: string;
            count: number;
        }>;
    }>;
}

/**
 * Recommendation response
 */
export interface RecommendationResponse<T = any> extends SuccessResponse<{
    recommendations: Array<{
        item: T;
        score: number;
        reason: string;
        type: 'collaborative' | 'content_based' | 'hybrid';
    }>;
}> {
    data: {
        recommendations: Array<{
            item: T;
            score: number;
            reason: string;
            type: 'collaborative' | 'content_based' | 'hybrid';
        }>;
    };
}

/**
 * Batch operation status response
 */
export interface BatchStatusResponse extends SuccessResponse<{
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    total: number;
    processed: number;
    successful: number;
    failed: number;
    estimatedTimeRemaining?: number;
    startedAt: string;
    completedAt?: string;
}> {
    data: {
        jobId: string;
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
        progress: number;
        total: number;
        processed: number;
        successful: number;
        failed: number;
        estimatedTimeRemaining?: number;
        startedAt: string;
        completedAt?: string;
    };
}

/**
 * Export status response
 */
export interface ExportStatusResponse extends BatchStatusResponse {
    data: BatchStatusResponse['data'] & {
        downloadUrl?: string;
        expiresAt?: string;
        format: string;
        size?: number;
    };
}

/**
 * Import status response
 */
export interface ImportStatusResponse extends BatchStatusResponse {
    data: BatchStatusResponse['data'] & {
        format: string;
        warnings: string[];
        errors: Array<{
            row: number;
            error: string;
        }>;
    };
}

/**
 * Notification response
 */
export interface NotificationResponse extends SuccessResponse<{
    notificationId: string;
    status: 'sent' | 'queued' | 'failed';
    channels: string[];
    scheduledFor?: string;
}> {
    data: {
        notificationId: string;
        status: 'sent' | 'queued' | 'failed';
        channels: string[];
        scheduledFor?: string;
    };
}

/**
 * Subscription response
 */
export interface SubscriptionResponse extends SuccessResponse<{
    subscriptionId: string;
    status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
    currentPeriod: {
        start: string;
        end: string;
    };
    plan: {
        id: string;
        name: string;
        features: string[];
        limits: Record<string, number>;
    };
    paymentMethod?: {
        id: string;
        type: string;
        last4?: string;
        brand?: string;
    };
}> {
    data: {
        subscriptionId: string;
        status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
        currentPeriod: {
            start: string;
            end: string;
        };
        plan: {
            id: string;
            name: string;
            features: string[];
            limits: Record<string, number>;
        };
        paymentMethod?: {
            id: string;
            type: string;
            last4?: string;
            brand?: string;
        };
    };
}

/**
 * API response wrapper for dynamic responses
 */
export type DynamicApiResponse<T = any> =
    | SuccessResponse<T>
    | ErrorResponse
    | PaginatedResponse<T>
    | HateoasResponse<T>;

/**
 * Response transformer function
 */
export type ResponseTransformer<T = any, R = any> = (data: T) => R;

/**
 * Response interceptor
 */
export interface ResponseInterceptor {
    transform?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
    beforeSend?: <T>(response: ApiResponse<T>, req: any, res: any) => void;
    afterSend?: <T>(response: ApiResponse<T>, req: any, res: any) => void;
}

