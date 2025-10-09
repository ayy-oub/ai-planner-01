/**
 * Common utility types used throughout the application
 */

/**
 * Pagination options for list endpoints
 */
export interface PaginationOptions {
    page: number;
    limit: number;
    offset: number;
    sort?: string;
    order?: 'asc' | 'desc';
    cursor?: string | FirebaseFirestore.DocumentSnapshot;
}

/**
 * Pagination metadata returned with paginated responses
 */
export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage?: number;
    prevPage?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

/**
 * Cursor-based pagination options
 */
export interface CursorPaginationOptions {
    cursor?: string;
    limit: number;
    order?: 'asc' | 'desc';
    sort?: string;
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMetadata {
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
}

/**
 * Cursor-based paginated response
 */
export interface CursorPaginatedResponse<T> {
    data: T[];
    pagination: CursorPaginationMetadata;
}

/**
 * Sort options for queries
 */
export interface SortOptions {
    field: string;
    order: 'asc' | 'desc';
}

/**
 * Filter options for queries
 */
export interface FilterOptions {
    [key: string]: any;
}

/**
 * Search options for queries
 */
export interface SearchOptions {
    query: string;
    fields?: string[];
    fuzzy?: boolean;
    highlight?: boolean;
}

/**
 * Date range filter
 */
export interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Time range filter
 */
export interface TimeRange {
    start: string; // HH:MM format
    end: string; // HH:MM format
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
    latitude: number;
    longitude: number;
}

/**
 * Address information
 */
export interface Address {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    coordinates?: Coordinates;
}

/**
 * File information
 */
export interface FileInfo {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    url?: string;
    uploadedAt: Date;
    checksum?: string;
}

/**
 * Image information
 */
export interface ImageInfo extends FileInfo {
    width?: number;
    height?: number;
    thumbnailUrl?: string;
}

/**
 * Media information
 */
export interface MediaInfo extends FileInfo {
    duration?: number; // in seconds
    thumbnailUrl?: string;
    metadata?: Record<string, any>;
}

/**
 * Color information
 */
export interface ColorInfo {
    hex: string;
    rgb: { r: number; g: number; b: number };
    hsl: { h: number; s: number; l: number };
    name?: string;
}

/**
 * Icon information
 */
export interface IconInfo {
    name: string;
    type: 'material' | 'fontawesome' | 'custom' | 'emoji';
    url?: string;
    color?: string;
}

/**
 * Metadata for any entity
 */
export interface EntityMetadata {
    createdAt: Date;
    updatedAt: Date;
    version: number;
    createdBy?: string;
    updatedBy?: string;
    tags?: string[];
    customFields?: Record<string, any>;
}

/**
 * Soft delete interface
 */
export interface SoftDeletable {
    deletedAt?: Date;
    deletedBy?: string;
    isDeleted: boolean;
}

/**
 ** Archivable interface
 */
export interface Archivable {
    archivedAt?: Date;
    archivedBy?: string;
    isArchived: boolean;
}

/**
 * Publishable interface
 */
export interface Publishable {
    publishedAt?: Date;
    publishedBy?: string;
    isPublished: boolean;
}

/**
 * Shareable interface
 */
export interface Shareable {
    isPublic: boolean;
    shareToken?: string;
    shareUrl?: string;
    sharedAt?: Date;
    sharedBy?: string;
    sharedWith?: string[];
    permissions: SharePermissions;
}

/**
 * Share permissions
 */
export interface SharePermissions {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
    canComment: boolean;
}

/**
 * Collaborative interface
 */
export interface Collaborative {
    collaborators: Collaborator[];
    collaborationSettings: CollaborationSettings;
}

/**
 * Collaborator information
 */
export interface Collaborator {
    userId: string;
    email: string;
    displayName: string;
    role: CollaboratorRole;
    permissions: SharePermissions;
    invitedAt: Date;
    joinedAt?: Date;
    lastActiveAt?: Date;
    status: CollaboratorStatus;
}

/**
 * Collaborator role
 */
export enum CollaboratorRole {
    VIEWER = 'viewer',
    EDITOR = 'editor',
    ADMIN = 'admin',
    OWNER = 'owner',
}

/**
 * Collaborator status
 */
export enum CollaboratorStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    REMOVED = 'removed',
}

/**
 * Collaboration settings
 */
export interface CollaborationSettings {
    allowPublicAccess: boolean;
    allowCollaborators: boolean;
    requireApproval: boolean;
    maxCollaborators: number;
    editingPermissions: 'all' | 'admin_only' | 'owner_only';
    commentPermissions: 'all' | 'collaborators_only' | 'none';
}

/**
 * Activity log entry
 */
export interface ActivityLog {
    id: string;
    action: string;
    actor: {
        userId: string;
        email: string;
        displayName: string;
    };
    target: {
        type: string;
        id: string;
        name?: string;
    };
    changes?: any;
    metadata?: Record<string, any>;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    sms: boolean;
    frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
    quietHours?: TimeRange;
    categories: {
        [category: string]: boolean;
    };
}

/**
 * API rate limit information
 */
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
}

/**
 * API key information
 */
export interface ApiKeyInfo {
    id: string;
    name: string;
    permissions: string[];
    lastUsed?: Date;
    createdAt: Date;
    expiresAt?: Date;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
    id: string;
    type: string;
    event: string;
    data: any;
    timestamp: Date;
    signature?: string;
    retries: number;
    status: 'pending' | 'delivered' | 'failed';
}

/**
 * Export options
 */
export interface ExportOptions {
    format: 'pdf' | 'csv' | 'json' | 'xml' | 'xlsx';
    fields?: string[];
    filters?: FilterOptions;
    dateRange?: DateRange;
    includeMetadata?: boolean;
    includeActivityLog?: boolean;
}

/**
 * Import options
 */
export interface ImportOptions {
    format: 'csv' | 'json' | 'xlsx';
    fieldMapping?: Record<string, string>;
    skipValidation?: boolean;
    dryRun?: boolean;
    batchSize?: number;
}

/**
 * Import result
 */
export interface ImportResult {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
    errorsDetails: Array<{
        row: number;
        error: string;
    }>;
    warnings: string[];
    duration: number;
}

/**
 * Backup information
 */
export interface BackupInfo {
    id: string;
    name: string;
    size: number;
    createdAt: Date;
    type: 'full' | 'incremental' | 'partial';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    expiresAt?: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
    id: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    changes: any;
    metadata?: Record<string, any>;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

/**
 * System information
 */
export interface SystemInfo {
    version: string;
    environment: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: {
        loadAverage: number[];
        count: number;
    };
    disk: {
        free: number;
        total: number;
        used: number;
    };
    timestamp: Date;
}

/**
 * Health status
 */
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    version: string;
    uptime: number;
    checks: Record<string, {
        status: 'healthy' | 'unhealthy';
        message?: string;
        responseTime?: number;
    }>;
}

/**
 * Error tracking information
 */
export interface ErrorTrackingInfo {
    errorId: string;
    userId?: string;
    sessionId?: string;
    error: {
        name: string;
        message: string;
        stack?: string;
    };
    context: {
        url: string;
        method: string;
        userAgent?: string;
        ip?: string;
        timestamp: Date;
    };
    metadata?: Record<string, any>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    timestamp: Date;
    userId?: string;
    metadata?: Record<string, any>;
}

/**
 * Feature flag
 */
export interface FeatureFlag {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage?: number;
    targetedUsers?: string[];
    targetedRoles?: string[];
    startDate?: Date;
    endDate?: Date;
    metadata?: Record<string, any>;
}

/**
 * A/B test configuration
 */
export interface ABTest {
    id: string;
    name: string;
    description: string;
    variants: Array<{
        name: string;
        weight: number;
        config: Record<string, any>;
    }>;
    startDate: Date;
    endDate?: Date;
    targetedUsers?: string[];
    metrics: string[];
}

/**
 * Search result
 */
export interface SearchResult<T> {
    items: T[];
    total: number;
    suggestions?: string[];
    highlights?: Array<{
        field: string;
        snippets: string[];
    }>;
    filters: Array<{
        field: string;
        values: Array<{
            value: string;
            count: number;
        }>;
    }>;
}

/**
 * Recommendation
 */
export interface Recommendation<T> {
    item: T;
    score: number;
    reason: string;
    type: 'collaborative' | 'content_based' | 'hybrid';
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
    event: string;
    userId?: string;
    sessionId?: string;
    properties: Record<string, any>;
    timestamp: Date;
    context: {
        ip?: string;
        userAgent?: string;
        url?: string;
        referrer?: string;
    };
}

/**
 * Machine learning prediction
 */
export interface MLPrediction<T> {
    prediction: T;
    confidence: number;
    model: string;
    version: string;
    features: Record<string, any>;
    timestamp: Date;
}

/**
 * Data validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    warnings: Array<{
        field: string;
        message: string;
    }>;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
    successful: T[];
    failed: Array<{
        item: T;
        error: string;
    }>;
    total: number;
    successfulCount: number;
    failedCount: number;
    duration: number;
}

/**
 * Queue job
 */
export interface QueueJob<T = any> {
    id: string;
    name: string;
    data: T;
    priority: number;
    attempts: number;
    maxAttempts: number;
    delay?: number;
    backoff?: 'fixed' | 'exponential';
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
}

/**
 * Queue job result
 */
export interface QueueJobResult {
    jobId: string;
    status: 'completed' | 'failed' | 'retrying';
    result?: any;
    error?: string;
    duration: number;
    attempts: number;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    ttl: number;
    createdAt: Date;
    accessedAt: Date;
    accessCount: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: any) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    successThreshold: number;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
    name: string;
    version: string;
    environment: string;
    port: number;
    host: string;
    apiPrefix: string;
    cors: {
        origins: string[];
        credentials: boolean;
    };
    rateLimiting: RateLimiterConfig;
    circuitBreaker: CircuitBreakerConfig;
    logging: {
        level: string;
        format: 'json' | 'simple';
    };
    monitoring: {
        enabled: boolean;
        metricsPort?: number;
    };
}