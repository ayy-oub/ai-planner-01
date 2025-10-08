import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { PaginationOptions, PaginatedResponse, QueryOptions } from '../types';

/**
 * Base repository interface
 */
export interface IBaseRepository<T> {
    findAll(options?: QueryOptions): Promise<T[]>;
    findById(id: string): Promise<T | null>;
    findOne(options: QueryOptions): Promise<T | null>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
    count(options?: QueryOptions): Promise<number>;
    exists(id: string): Promise<boolean>;
    paginate(options: PaginationOptions): Promise<PaginatedResponse<T>>;
}

/**
 * Base repository implementation
 */
export abstract class BaseRepository<T extends { id: string }> implements IBaseRepository<T> {
    protected abstract readonly collectionName: string;
    protected abstract readonly primaryKey: string;

    /**
     * Find all entities
     */
    abstract findAll(options?: QueryOptions): Promise<T[]>;

    /**
     * Find entity by ID
     */
    abstract findById(id: string): Promise<T | null>;

    /**
     * Find one entity matching criteria
     */
    abstract findOne(options: QueryOptions): Promise<T | null>;

    /**
     * Create new entity
     */
    abstract create(data: Partial<T>): Promise<T>;

    /**
     * Update entity
     */
    abstract update(id: string, data: Partial<T>): Promise<T>;

    /**
     * Delete entity
     */
    abstract delete(id: string): Promise<boolean>;

    /**
     * Count entities matching criteria
     */
    abstract count(options?: QueryOptions): Promise<number>;

    /**
     * Check if entity exists
     */
    abstract exists(id: string): Promise<boolean>;

    /**
     * Get paginated results
     */
    abstract paginate(options: PaginationOptions): Promise<PaginatedResponse<T>>;

    /**
     * Validate entity data before creation/update
     */
    protected validate(data: Partial<T>, isUpdate: boolean = false): void {
        // Override in subclasses for specific validation
    }

    /**
     * Validate ID format
     */
    protected validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Invalid ID format');
        }
    }

    /**
     * Handle repository errors
     */
    protected handleError(error: Error, operation: string): never {
        logger.error(`Repository operation failed: ${operation}`, {
            error: error.message,
            collection: this.collectionName,
            stack: error.stack,
        });

        if (error instanceof AppError) {
            throw error;
        }

        // Convert common database errors to AppError
        if (error.message.includes('duplicate key')) {
            throw new ValidationError('Resource already exists', {
                details: { error: error.message },
            });
        }

        if (error.message.includes('not found')) {
            throw new NotFoundError(this.collectionName);
        }

        throw new AppError(
            `Database operation failed: ${error.message}`,
            500,
            'DATABASE_ERROR',
            { operation, collection: this.collectionName }
        );
    }

    /**
     * Create pagination metadata
     */
    protected createPaginationMetadata(
        total: number,
        page: number,
        limit: number
    ): PaginatedResponse<T>['pagination'] {
        const pages = Math.ceil(total / limit);
        const hasNext = page < pages;
        const hasPrev = page > 1;

        return {
            page,
            limit,
            total,
            pages,
            hasNext,
            hasPrev,
            nextPage: hasNext ? page + 1 : undefined,
            prevPage: hasPrev ? page - 1 : undefined,
        };
    }

    /**
     * Build query options
     */
    protected buildQueryOptions(options: QueryOptions = {}): QueryOptions {
        return {
            ...options,
            // Add default options here
        };
    }

    /**
     * Sanitize data before database operations
     */
    protected sanitize(data: Partial<T>): Partial<T> {
        // Remove undefined values and sensitive fields
        const sanitized = { ...data };

        // Remove undefined values
        Object.keys(sanitized).forEach(key => {
            if (sanitized[key as keyof T] === undefined) {
                delete sanitized[key as keyof T];
            }
        });

        // Remove internal fields
        delete (sanitized as any).id;
        delete (sanitized as any).createdAt;
        delete (sanitized as any).updatedAt;
        delete (sanitized as any).version;

        return sanitized;
    }

    /**
     * Add timestamps to data
     */
    protected addTimestamps(data: Partial<T>, isUpdate: boolean = false): Partial<T> {
        const now = new Date();

        if (!isUpdate) {
            (data as any).createdAt = now;
            (data as any).version = 1;
        } else {
            (data as any).updatedAt = now;
            (data as any).version = ((data as any).version || 0) + 1;
        }

        return data;
    }

    /**
     * Validate pagination options
     */
    protected validatePagination(options: PaginationOptions): void {
        if (options.page < 1) {
            throw new ValidationError('Page must be greater than 0');
        }

        if (options.limit < 1 || options.limit > 100) {
            throw new ValidationError('Limit must be between 1 and 100');
        }

        if (options.sort && typeof options.sort !== 'string') {
            throw new ValidationError('Sort must be a string');
        }

        if (options.order && !['asc', 'desc'].includes(options.order)) {
            throw new ValidationError('Order must be either "asc" or "desc"');
        }
    }

    /**
     * Log database operations
     */
    protected logOperation(operation: string, details: any = {}): void {
        logger.debug(`Repository operation: ${operation}`, {
            collection: this.collectionName,
            ...details,
        });
    }
}

/**
 * Repository factory interface
 */
export interface IRepositoryFactory {
    create<T extends { id: string }>(name: string): IBaseRepository<T>;
}

/**
 * Repository cache interface
 */
export interface IRepositoryCache<T> {
    get(key: string): Promise<T | null>;
    set(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
}

/**
 * Repository cache implementation
 */
export class RepositoryCache<T> implements IRepositoryCache<T> {
    private cache = new Map<string, { value: T; expiry: number }>();
    private defaultTTL = 300; // 5 minutes

    async get(key: string): Promise<T | null> {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
        const expiry = Date.now() + (ttl * 1000);
        this.cache.set(key, { value, expiry });
    }

    async delete(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    /**
     * Generate cache key
     */
    generateKey(operation: string, ...args: any[]): string {
        const argsStr = args.map(arg => JSON.stringify(arg)).join(':');
        return `${operation}:${argsStr}`;
    }
}

/**
 * Repository with caching mixin
 */
export abstract class CachedRepository<T extends { id: string }> extends BaseRepository<T> {
    protected cache: IRepositoryCache<T>;
    protected cacheTTL = 300; // 5 minutes

    constructor() {
        super();
        this.cache = new RepositoryCache<T>();
    }

    /**
     * Find by ID with caching
     */
    async findById(id: string): Promise<T | null> {
        this.validateId(id);

        const cacheKey = this.cache.generateKey('findById', id);

        // Try cache first
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            this.logOperation('findById (cached)', { id });
            return cached;
        }

        // Fetch from database
        const result = await this.findByIdFromDatabase(id);

        if (result) {
            await this.cache.set(cacheKey, result, this.cacheTTL);
        }

        return result;
    }

    /**
     * Abstract method to fetch from database
     */
    protected abstract findByIdFromDatabase(id: string): Promise<T | null>;

    /**
     * Update with cache invalidation
     */
    async update(id: string, data: Partial<T>): Promise<T> {
        const result = await super.update(id, data);

        // Invalidate cache
        const cacheKey = this.cache.generateKey('findById', id);
        await this.cache.delete(cacheKey);

        return result;
    }

    /**
     * Delete with cache invalidation
     */
    async delete(id: string): Promise<boolean> {
        const result = await super.delete(id);

        if (result) {
            // Invalidate cache
            const cacheKey = this.cache.generateKey('findById', id);
            await this.cache.delete(cacheKey);
        }

        return result;
    }
}

/**
 * Repository with soft delete support
 */
export abstract class SoftDeleteRepository<T extends { id: string }> extends BaseRepository<T> {
    /**
     * Soft delete entity
     */
    async softDelete(id: string, deletedBy?: string): Promise<T> {
        const entity = await this.findById(id);

        if (!entity) {
            throw new NotFoundError(this.collectionName);
        }

        const updateData = {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy,
        } as any;

        return this.update(id, updateData);
    }

    /**
     * Restore soft deleted entity
     */
    async restore(id: string): Promise<T> {
        const entity = await this.findById(id);

        if (!entity) {
            throw new NotFoundError(this.collectionName);
        }

        const updateData = {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
        } as any;

        return this.update(id, updateData);
    }

    /**
     * Find only non-deleted entities
     */
    abstract findActive(options?: QueryOptions): Promise<T[]>;

    /**
     * Find only deleted entities
     */
    abstract findDeleted(options?: QueryOptions): Promise<T[]>;

    /**
     * Find all entities including deleted
     */
    abstract findAllWithDeleted(options?: QueryOptions): Promise<T[]>;
}

/**
 * Repository with version support
 */
export abstract class VersionedRepository<T extends { id: string; version: number }> extends BaseRepository<T> {
    /**
     * Update with optimistic locking
     */
    async updateWithVersion(id: string, data: Partial<T>, expectedVersion: number): Promise<T> {
        const entity = await this.findById(id);

        if (!entity) {
            throw new NotFoundError(this.collectionName);
        }

        if (entity.version !== expectedVersion) {
            throw new AppError(
                'Version conflict: resource was modified by another user',
                409,
                'VERSION_CONFLICT'
            );
        }

        return this.update(id, data);
    }

    /**
     * Increment version
     */
    protected incrementVersion(entity: T): T {
        (entity as any).version += 1;
        (entity as any).updatedAt = new Date();
        return entity;
    }
}

/**
 * Repository with audit support
 */
export abstract class AuditableRepository<T extends { id: string }> extends BaseRepository<T> {
    /**
     * Create with audit information
     */
    async createWithAudit(data: Partial<T>, createdBy: string): Promise<T> {
        (data as any).createdBy = createdBy;
        return this.create(data);
    }

    /**
     * Update with audit information
     */
    async updateWithAudit(id: string, data: Partial<T>, updatedBy: string): Promise<T> {
        (data as any).updatedBy = updatedBy;
        return this.update(id, data);
    }

    /**
     * Find by creator
     */
    abstract findByCreator(userId: string, options?: QueryOptions): Promise<T[]>;

    /**
     * Find recently created
     */
    abstract findRecentlyCreated(limit: number): Promise<T[]>;

    /**
     * Find recently updated
     */
    abstract findRecentlyUpdated(limit: number): Promise<T[]>;
}

/**
 * Bulk operations interface
 */
export interface IBulkOperations<T> {
    createMany(items: Partial<T>[]): Promise<T[]>;
    updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>;
    deleteMany(ids: string[]): Promise<number>;
    upsertMany(items: Partial<T>[]): Promise<T[]>;
}

/**
 * Repository with bulk operations support
 */
export abstract class BulkOperationsRepository<T extends { id: string }>
    extends BaseRepository<T>
    implements IBulkOperations<T> {
    /**
     * Create multiple entities
     */
    abstract createMany(items: Partial<T>[]): Promise<T[]>;

    /**
     * Update multiple entities
     */
    abstract updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>;

    /**
     * Delete multiple entities
     */
    abstract deleteMany(ids: string[]): Promise<number>;

    /**
     * Upsert multiple entities
     */
    abstract upsertMany(items: Partial<T>[]): Promise<T[]>;

    /**
     * Bulk operation with transaction support
     */
    abstract bulkOperation(
        operations: Array<{
            type: 'create' | 'update' | 'delete' | 'upsert';
            data: any;
        }>
    ): Promise<any[]>;
}

/**
 * Repository events
 */
export interface IRepositoryEvents<T> {
    onBeforeCreate?(data: Partial<T>): Promise<void>;
    onAfterCreate?(entity: T): Promise<void>;
    onBeforeUpdate?(id: string, data: Partial<T>): Promise<void>;
    onAfterUpdate?(entity: T): Promise<void>;
    onBeforeDelete?(id: string): Promise<void>;
    onAfterDelete?(id: string): Promise<void>;
}

/**
 * Event-driven repository
 */
export abstract class EventDrivenRepository<T extends { id: string }>
    extends BaseRepository<T>
    implements IRepositoryEvents<T> {
    async create(data: Partial<T>): Promise<T> {
        await this.onBeforeCreate?.(data);

        const entity = await super.create(data);

        await this.onAfterCreate?.(entity);

        return entity;
    }

    async update(id: string, data: Partial<T>): Promise<T> {
        await this.onBeforeUpdate?.(id, data);

        const entity = await super.update(id, data);

        await this.onAfterUpdate?.(entity);

        return entity;
    }

    async delete(id: string): Promise<boolean> {
        await this.onBeforeDelete?.(id);

        const result = await super.delete(id);

        if (result) {
            await this.onAfterDelete?.(id);
        }

        return result;
    }

    // Optional event handlers
    onBeforeCreate?(data: Partial<T>): Promise<void>;
    onAfterCreate?(entity: T): Promise<void>;
    onBeforeUpdate?(id: string, data: Partial<T>): Promise<void>;
    onAfterUpdate?(entity: T): Promise<void>;
    onBeforeDelete?(id: string): Promise<void>;
    onAfterDelete?(id: string): Promise<void>;
}