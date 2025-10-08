/**
 * Base entity interface for all database entities
 */
export interface DatabaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}

/**
 * Timestamped entity interface
 */
export interface TimestampedEntity {
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    updatedBy?: string;
}

/**
 * Soft deletable entity interface
 */
export interface SoftDeletableEntity {
    deletedAt?: Date;
    deletedBy?: string;
    isDeleted: boolean;
}

/**
 * Archivable entity interface
 */
export interface ArchivableEntity {
    archivedAt?: Date;
    archivedBy?: string;
    isArchived: boolean;
}

/**
 * Publishable entity interface
 */
export interface PublishableEntity {
    publishedAt?: Date;
    publishedBy?: string;
    isPublished: boolean;
}

/**
 * Base document structure for Firestore
 */
export interface BaseDocument extends DatabaseEntity, TimestampedEntity {
    metadata?: Record<string, any>;
}

/**
 * Firestore document with soft delete
 */
export interface FirestoreDocument extends BaseDocument, SoftDeletableEntity { }

/**
 * Collection names enum
 */
export enum CollectionName {
    USERS = 'users',
    USER_SESSIONS = 'userSessions',
    USER_ACTIVITIES = 'userActivities',
    USER_PREFERENCES = 'userPreferences',
    USER_SUBSCRIPTIONS = 'userSubscriptions',
    USER_NOTIFICATIONS = 'userNotifications',
    API_KEYS = 'apiKeys',
    AUDIT_LOGS = 'auditLogs',
    LOGIN_ATTEMPTS = 'loginAttempts',

    PLANNERS = 'planners',
    PLANNER_SECTIONS = 'plannerSections',
    PLANNER_ACTIVITIES = 'plannerActivities',
    PLANNER_TEMPLATES = 'plannerTemplates',
    PLANNER_SHARES = 'plannerShares',
    PLANNER_COLLABORATORS = 'plannerCollaborators',

    SECTIONS = 'sections',
    ACTIVITIES = 'activities',
    TASKS = 'tasks',
    EVENTS = 'events',
    NOTES = 'notes',
    GOALS = 'goals',

    AI_SUGGESTIONS = 'aiSuggestions',
    AI_INSIGHTS = 'aiInsights',
    AI_MODELS = 'aiModels',
    AI_TRAINING_DATA = 'aiTrainingData',

    FILES = 'files',
    FILE_UPLOADS = 'fileUploads',
    IMAGES = 'images',
    DOCUMENTS = 'documents',

    CALENDAR_EVENTS = 'calendarEvents',
    CALENDAR_SYNCS = 'calendarSyncs',
    CALENDAR_INTEGRATIONS = 'calendarIntegrations',

    EXPORTS = 'exports',
    IMPORTS = 'imports',
    BACKUPS = 'backups',

    WEBHOOKS = 'webhooks',
    WEBHOOK_EVENTS = 'webhookEvents',
    WEBHOOK_DELIVERIES = 'webhookDeliveries',

    QUEUE_JOBS = 'queueJobs',
    QUEUE_SCHEDULED = 'queueScheduled',
    QUEUE_FAILED = 'queueFailed',

    RATE_LIMITS = 'rateLimits',
    RATE_LIMIT_BUCKETS = 'rateLimitBuckets',

    FEATURE_FLAGS = 'featureFlags',
    AB_TESTS = 'abTests',

    SYSTEM_CONFIGS = 'systemConfigs',
    SYSTEM_METRICS = 'systemMetrics',
    SYSTEM_LOGS = 'systemLogs',

    EXTERNAL_INTEGRATIONS = 'externalIntegrations',
    EXTERNAL_API_CALLS = 'externalApiCalls',
    EXTERNAL_WEBHOOKS = 'externalWebhooks',
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
    type: 'firestore' | 'mongodb' | 'postgresql' | 'mysql';
    host: string;
    port: number;
    database: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    connectionLimit?: number;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}

/**
 * Firestore configuration
 */
export interface FirestoreConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    databaseURL: string;
    storageBucket: string;
    emulator?: {
        host: string;
        port: number;
    };
}

/**
 * Query options
 */
export interface QueryOptions {
    select?: string[];
    where?: Array<{
        field: string;
        operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
        value: any;
    }>;
    orderBy?: Array<{
        field: string;
        direction?: 'asc' | 'desc';
    }>;
    limit?: number;
    offset?: number;
    startAfter?: any;
    startAt?: any;
    endAt?: any;
    endBefore?: any;
}

/**
 * Firestore query options
 */
export interface FirestoreQueryOptions extends QueryOptions {
    collection: string;
    subcollections?: Array<{
        name: string;
        documentId?: string;
    }>;
}

/**
 * Database query result
 */
export interface QueryResult<T> {
    data: T[];
    total: number;
    hasMore: boolean;
    lastCursor?: any;
}

/**
 * Database batch operation
 */
export interface BatchOperation {
    type: 'create' | 'update' | 'delete' | 'set';
    collection: string;
    documentId: string;
    data?: any;
    options?: any;
}

/**
 * Database transaction
 */
export interface DatabaseTransaction {
    id: string;
    operations: BatchOperation[];
    createdAt: Date;
    committedAt?: Date;
    rolledBackAt?: Date;
    status: 'pending' | 'committed' | 'rolled_back' | 'failed';
    error?: string;
}

/**
 * Database index
 */
export interface DatabaseIndex {
    name: string;
    collection: string;
    fields: Array<{
        field: string;
        order: 1 | -1;
    }>;
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: any;
}

/**
 * Database backup
 */
export interface DatabaseBackup {
    id: string;
    name: string;
    type: 'full' | 'incremental' | 'partial';
    status: 'pending' | 'running' | 'completed' | 'failed';
    size: number;
    collectionCount: number;
    documentCount: number;
    startedAt: Date;
    completedAt?: Date;
    expiresAt?: Date;
    location: string;
    checksum: string;
    metadata?: Record<string, any>;
}

/**
 * Database restore
 */
export interface DatabaseRestore {
    id: string;
    backupId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    collections: string[];
    startedAt: Date;
    completedAt?: Date;
    progress: number;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Database migration
 */
export interface DatabaseMigration {
    id: string;
    name: string;
    version: number;
    description: string;
    up: string;
    down: string;
    checksum: string;
    executedAt?: Date;
    executionTime?: number;
    success?: boolean;
    error?: string;
}

/**
 * Database statistics
 */
export interface DatabaseStatistics {
    totalCollections: number;
    totalDocuments: number;
    totalSize: number;
    averageDocumentSize: number;
    indexCount: number;
    indexSize: number;
    collectionStats: Array<{
        collection: string;
        documentCount: number;
        size: number;
        averageDocumentSize: number;
        indexCount: number;
        indexSize: number;
    }>;
    generatedAt: Date;
}

/**
 * Database performance metrics
 */
export interface DatabasePerformanceMetrics {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: Array<{
        query: string;
        executionTime: number;
        timestamp: Date;
    }>;
    connectionPoolStats: {
        totalConnections: number;
        activeConnections: number;
        idleConnections: number;
        waitingConnections: number;
    };
    cacheHitRatio: number;
    indexUsage: Array<{
        index: string;
        usageCount: number;
        lastUsed: Date;
    }>;
    measuredAt: Date;
}

/**
 * Database connection pool
 */
export interface DatabaseConnectionPool {
    min: number;
    max: number;
    idle: number;
    acquire: number;
    evict: number;
    handleDisconnects: boolean;
}

/**
 * Database query log
 */
export interface DatabaseQueryLog {
    id: string;
    query: string;
    parameters?: any[];
    executionTime: number;
    timestamp: Date;
    userId?: string;
    collection: string;
    operation: 'find' | 'findOne' | 'insert' | 'update' | 'delete' | 'aggregate';
    resultCount?: number;
    error?: string;
}

/**
 * Database security rules
 */
export interface DatabaseSecurityRules {
    read: boolean | string | ((user: any, resource: any) => boolean);
    write: boolean | string | ((user: any, resource: any) => boolean);
    create: boolean | string | ((user: any, resource: any) => boolean);
    update: boolean | string | ((user: any, resource: any) => boolean);
    delete: boolean | string | ((user: any, resource: any) => boolean);
}

/**
 * Database audit log
 */
export interface DatabaseAuditLog {
    id: string;
    userId?: string;
    collection: string;
    documentId: string;
    operation: 'create' | 'read' | 'update' | 'delete';
    data?: any;
    changes?: any;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

/**
 * Database constraint
 */
export interface DatabaseConstraint {
    name: string;
    type: 'unique' | 'check' | 'foreign_key' | 'primary_key';
    collection: string;
    fields: string[];
    condition?: string;
    referencedCollection?: string;
    referencedFields?: string[];
    onDelete?: 'cascade' | 'restrict' | 'set_null';
    onUpdate?: 'cascade' | 'restrict' | 'set_null';
}

/**
 * Database trigger
 */
export interface DatabaseTrigger {
    name: string;
    collection: string;
    operation: 'insert' | 'update' | 'delete';
    timing: 'before' | 'after';
    function: string;
    enabled: boolean;
    condition?: string;
}

/**
 * Database view
 */
export interface DatabaseView {
    name: string;
    query: string;
    collections: string[];
    fields: string[];
    permissions?: DatabaseSecurityRules;
}

/**
 * Database connection status
 */
export interface DatabaseConnectionStatus {
    connected: boolean;
    host: string;
    port: number;
    database: string;
    latency: number;
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    lastCheck: Date;
}

/**
 * Database health check
 */
export interface DatabaseHealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionStatus: DatabaseConnectionStatus;
    performanceMetrics: DatabasePerformanceMetrics;
    slowQueries: DatabaseQueryLog[];
    errors: string[];
    lastCheck: Date;
}

/**
 * Database configuration options
 */
export interface DatabaseOptions {
    enableQueryLogging?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableCaching?: boolean;
    cacheTtl?: number;
    maxQueryTime?: number;
    connectionPool?: DatabaseConnectionPool;
    retryAttempts?: number;
    retryDelay?: number;
    enableTransactions?: boolean;
    enableAuditing?: boolean;
    securityRules?: DatabaseSecurityRules;
}

/**
 * Firestore document reference
 */
export interface FirestoreDocumentReference {
    id: string;
    path: string;
    parent: string;
    collection: string;
}

/**
 * Firestore query snapshot
 */
export interface FirestoreQuerySnapshot<T = any> {
    docs: Array<{
        id: string;
        data: T;
        exists: boolean;
        createTime: Date;
        updateTime: Date;
        readTime: Date;
    }>;
    empty: boolean;
    size: number;
    readTime: Date;
}

/**
 * Firestore document snapshot
 */
export interface FirestoreDocumentSnapshot<T = any> {
    id: string;
    data: T | undefined;
    exists: boolean;
    createTime?: Date;
    updateTime?: Date;
    readTime: Date;
    ref: FirestoreDocumentReference;
}

/**
 * Firestore batch write result
 */
export interface FirestoreBatchWriteResult {
    success: boolean;
    writeTime: Date;
    error?: string;
}

/**
 * Firestore transaction options
 */
export interface FirestoreTransactionOptions {
    readOnly?: boolean;
    readWrite?: boolean;
    maxAttempts?: number;
}

/**
 * MongoDB aggregation pipeline
 */
export interface MongoDBAggregationPipeline {
    pipeline: any[];
    options?: {
        allowDiskUse?: boolean;
        cursor?: any;
        explain?: boolean;
        hint?: any;
    };
}

/**
 * MongoDB index options
 */
export interface MongoDBIndexOptions {
    background?: boolean;
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: any;
    collation?: any;
    expireAfterSeconds?: number;
    hidden?: boolean;
    name?: string;
}

/**
 * Database query builder options
 */
export interface QueryBuilderOptions {
    table: string;
    select?: string[];
    where?: Record<string, any>;
    whereIn?: Record<string, any[]>;
    whereNotIn?: Record<string, any[]>;
    whereNull?: string[];
    whereNotNull?: string[];
    whereBetween?: Record<string, [any, any]>;
    whereNotBetween?: Record<string, [any, any]>;
    whereRaw?: string[];
    join?: Array<{
        table: string;
        first: string;
        operator: string;
        second: string;
        type?: 'inner' | 'left' | 'right' | 'full';
    }>;
    orderBy?: Array<{
        column: string;
        direction?: 'asc' | 'desc';
    }>;
    groupBy?: string[];
    having?: string[];
    limit?: number;
    offset?: number;
}