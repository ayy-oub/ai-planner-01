import { Redis } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError, CacheError } from '../utils/errors';
import { CacheService, CacheOptions } from '../utils/cache';

/**
 * Cache repository interface
 */
export interface ICacheRepository<T = any> {
    get(key: string): Promise<T | null>;
    set(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    expire(key: string, ttl: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    increment(key: string, amount?: number): Promise<number>;
    decrement(key: string, amount?: number): Promise<number>;
    getMany(keys: string[]): Promise<Map<string, T | null>>;
    setMany(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
    deleteMany(keys: string[]): Promise<number>;
    clear(pattern?: string): Promise<void>;
    size(): Promise<number>;
}

/**
 * Cache repository configuration
 */
export interface CacheRepositoryConfig {
    prefix?: string;
    defaultTTL?: number;
    compression?: boolean;
    json?: boolean;
}

/**
 * Base cache repository
 */
export abstract class CacheRepository<T = any> implements ICacheRepository<T> {
    protected cache: CacheService;
    protected config: Required<CacheRepositoryConfig>;

    constructor(
        cacheService: CacheService,
        config: CacheRepositoryConfig = {}
    ) {
        this.cache = cacheService;
        this.config = {
            prefix: config.prefix || 'cache',
            defaultTTL: config.defaultTTL || 300, // 5 minutes
            compression: config.compression || false,
            json: config.json !== false, // Default to true
        };
    }

    /**
     * Generate cache key with prefix
     */
    protected generateKey(key: string): string {
        return `${this.config.prefix}:${key}`;
    }

    /**
     * Get value from cache
     */
    async get(key: string): Promise<T | null> {
        try {
            const cacheKey = this.generateKey(key);
            const options: CacheOptions = {
                json: this.config.json,
            };

            const value = await this.cache.get(cacheKey, options);

            if (value !== null) {
                logger.debug('Cache hit', { key: cacheKey, prefix: this.config.prefix });
            } else {
                logger.debug('Cache miss', { key: cacheKey, prefix: this.config.prefix });
            }

            return value;
        } catch (error) {
            logger.error('Cache get error', { error: error.message, key });
            throw new CacheError(`Failed to get cache value: ${error.message}`);
        }
    }

    /**
     * Set value in cache
     */
    async set(key: string, value: T, ttl: number = this.config.defaultTTL): Promise<void> {
        try {
            const cacheKey = this.generateKey(key);
            const options: CacheOptions = {
                ttl,
                json: this.config.json,
            };

            await this.cache.set(cacheKey, value, options);

            logger.debug('Cache set', { key: cacheKey, ttl, prefix: this.config.prefix });
        } catch (error) {
            logger.error('Cache set error', { error: error.message, key });
            throw new CacheError(`Failed to set cache value: ${error.message}`);
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key);
            const result = await this.cache.delete(cacheKey);

            logger.debug('Cache delete', { key: cacheKey, result, prefix: this.config.prefix });

            return result;
        } catch (error) {
            logger.error('Cache delete error', { error: error.message, key });
            throw new CacheError(`Failed to delete cache value: ${error.message}`);
        }
    }

    /**
     * Check if key exists in cache
     */
    async exists(key: string): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key);
            return await this.cache.exists(cacheKey);
        } catch (error) {
            logger.error('Cache exists error', { error: error.message, key });
            throw new CacheError(`Failed to check cache key existence: ${error.message}`);
        }
    }

    /**
     * Set TTL for key
     */
    async expire(key: string, ttl: number): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key);
            const result = await this.cache.expire(cacheKey, ttl);

            logger.debug('Cache expire', { key: cacheKey, ttl, result, prefix: this.config.prefix });

            return result;
        } catch (error) {
            logger.error('Cache expire error', { error: error.message, key });
            throw new CacheError(`Failed to set cache key TTL: ${error.message}`);
        }
    }

    /**
     * Get TTL for key
     */
    async ttl(key: string): Promise<number> {
        try {
            const cacheKey = this.generateKey(key);
            return await this.cache.ttl(cacheKey);
        } catch (error) {
            logger.error('Cache TTL error', { error: error.message, key });
            throw new CacheError(`Failed to get cache key TTL: ${error.message}`);
        }
    }

    /**
     * Increment numeric value
     */
    async increment(key: string, amount: number = 1): Promise<number> {
        try {
            const cacheKey = this.generateKey(key);
            const result = await this.cache.increment(cacheKey, amount);

            logger.debug('Cache increment', { key: cacheKey, amount, result, prefix: this.config.prefix });

            return result;
        } catch (error) {
            logger.error('Cache increment error', { error: error.message, key });
            throw new CacheError(`Failed to increment cache value: ${error.message}`);
        }
    }

    /**
     * Decrement numeric value
     */
    async decrement(key: string, amount: number = 1): Promise<number> {
        try {
            const cacheKey = this.generateKey(key);
            const result = await this.cache.decrement(cacheKey, amount);

            logger.debug('Cache decrement', { key: cacheKey, amount, result, prefix: this.config.prefix });

            return result;
        } catch (error) {
            logger.error('Cache decrement error', { error: error.message, key });
            throw new CacheError(`Failed to decrement cache value: ${error.message}`);
        }
    }

    /**
     * Get multiple values
     */
    async getMany(keys: string[]): Promise<Map<string, T | null>> {
        try {
            const cacheKeys = keys.map(key => this.generateKey(key));
            const options: CacheOptions = {
                json: this.config.json,
            };

            const results = await this.cache.getMany(cacheKeys, options);

            // Map back to original keys
            const mappedResults = new Map<string, T | null>();
            keys.forEach((key, index) => {
                mappedResults.set(key, results.get(cacheKeys[index]) || null);
            });

            logger.debug('Cache getMany', { keys: cacheKeys, count: results.size, prefix: this.config.prefix });

            return mappedResults;
        } catch (error) {
            logger.error('Cache getMany error', { error: error.message, keys });
            throw new CacheError(`Failed to get multiple cache values: ${error.message}`);
        }
    }

    /**
     * Set multiple values
     */
    async setMany(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
        try {
            for (const entry of entries) {
                await this.set(entry.key, entry.value, entry.ttl || this.config.defaultTTL);
            }

            logger.debug('Cache setMany', { count: entries.length, prefix: this.config.prefix });
        } catch (error) {
            logger.error('Cache setMany error', { error: error.message, count: entries.length });
            throw new CacheError(`Failed to set multiple cache values: ${error.message}`);
        }
    }

    /**
     * Delete multiple values
     */
    async deleteMany(keys: string[]): Promise<number> {
        try {
            const cacheKeys = keys.map(key => this.generateKey(key));
            const result = await this.cache.deleteMany(cacheKeys);

            logger.debug('Cache deleteMany', { keys: cacheKeys, count: result, prefix: this.config.prefix });

            return result;
        } catch (error) {
            logger.error('Cache deleteMany error', { error: error.message, keys });
            throw new CacheError(`Failed to delete multiple cache values: ${error.message}`);
        }
    }

    /**
     * Clear cache with optional pattern
     */
    async clear(pattern?: string): Promise<void> {
        try {
            const clearPattern = pattern
                ? `${this.config.prefix}:${pattern}`
                : `${this.config.prefix}:*`;

            await this.cache.clear(clearPattern);

            logger.info('Cache cleared', { pattern: clearPattern, prefix: this.config.prefix });
        } catch (error) {
            logger.error('Cache clear error', { error: error.message, pattern });
            throw new CacheError(`Failed to clear cache: ${error.message}`);
        }
    }

    /**
     * Get cache size
     */
    async size(): Promise<number> {
        try {
            return await this.cache.size();
        } catch (error) {
            logger.error('Cache size error', { error: error.message });
            throw new CacheError(`Failed to get cache size: ${error.message}`);
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
        hitRate: number;
    }> {
        return this.cache.getStats();
    }

    /**
     * Reset cache statistics
     */
    async resetStats(): Promise<void> {
        this.cache.resetStats();
    }
}

/**
 * Specialized cache repositories
 */

/**
 * User cache repository
 */
export class UserCacheRepository extends CacheRepository {
    constructor(cacheService: CacheService) {
        super(cacheService, {
            prefix: 'users',
            defaultTTL: 1800, // 30 minutes
            json: true,
        });
    }

    /**
     * Cache user by ID
     */
    async cacheUser(userId: string, userData: any): Promise<void> {
        await this.set(`user:${userId}`, userData);
    }

    /**
     * Get cached user
     */
    async getCachedUser(userId: string): Promise<any | null> {
        return this.get(`user:${userId}`);
    }

    /**
     * Cache user by email
     */
    async cacheUserByEmail(email: string, userData: any): Promise<void> {
        await this.set(`user:email:${email.toLowerCase()}`, userData);
    }

    /**
     * Get cached user by email
     */
    async getCachedUserByEmail(email: string): Promise<any | null> {
        return this.get(`user:email:${email.toLowerCase()}`);
    }

    /**
     * Cache user sessions
     */
    async cacheUserSessions(userId: string, sessions: any[]): Promise<void> {
        await this.set(`user:${userId}:sessions`, sessions, 3600); // 1 hour
    }

    /**
     * Get cached user sessions
     */
    async getCachedUserSessions(userId: string): Promise<any[] | null> {
        return this.get(`user:${userId}:sessions`);
    }

    /**
     * Invalidate user cache
     */
    async invalidateUser(userId: string): Promise<void> {
        await this.delete(`user:${userId}`);
        await this.delete(`user:${userId}:sessions`);
    }

    /**
     * Invalidate user by email
     */
    async invalidateUserByEmail(email: string): Promise<void> {
        await this.delete(`user:email:${email.toLowerCase()}`);
    }
}

/**
 * Session cache repository
 */
export class SessionCacheRepository extends CacheRepository {
    constructor(cacheService: CacheService) {
        super(cacheService, {
            prefix: 'sessions',
            defaultTTL: 3600, // 1 hour
            json: true,
        });
    }

    /**
     * Cache session
     */
    async cacheSession(sessionId: string, sessionData: any): Promise<void> {
        await this.set(`session:${sessionId}`, sessionData);
    }

    /**
     * Get cached session
     */
    async getCachedSession(sessionId: string): Promise<any | null> {
        return this.get(`session:${sessionId}`);
    }

    /**
     * Cache session by user ID
     */
    async cacheSessionByUserId(userId: string, sessionData: any): Promise<void> {
        await this.set(`session:user:${userId}`, sessionData);
    }

    /**
     * Get cached session by user ID
     */
    async getCachedSessionByUserId(userId: string): Promise<any | null> {
        return this.get(`session:user:${userId}`);
    }

    /**
     * Extend session TTL
     */
    async extendSession(sessionId: string, ttl: number = 3600): Promise<boolean> {
        return this.expire(`session:${sessionId}`, ttl);
    }

    /**
     * Invalidate session
     */
    async invalidateSession(sessionId: string): Promise<void> {
        await this.delete(`session:${sessionId}`);
    }

    /**
     * Invalidate user sessions
     */
    async invalidateUserSessions(userId: string): Promise<void> {
        await this.delete(`session:user:${userId}`);
    }
}

/**
 * Rate limit cache repository
 */
export class RateLimitCacheRepository extends CacheRepository {
    constructor(cacheService: CacheService) {
        super(cacheService, {
            prefix: 'rate_limit',
            defaultTTL: 900, // 15 minutes
            json: true,
        });
    }

    /**
     * Check rate limit
     */
    async checkRateLimit(identifier: string, limit: number, window: number): Promise<{
        allowed: boolean;
        remaining: number;
        reset: number;
    }> {
        const key = `rate:${identifier}:${Math.floor(Date.now() / window)}`;
        const current = await this.increment(key);

        if (current === 1) {
            await this.expire(key, Math.ceil(window / 1000));
        }

        const allowed = current <= limit;
        const remaining = Math.max(0, limit - current);
        const reset = Math.ceil((Date.now() + window) / 1000);

        return { allowed, remaining, reset };
    }

    /**
     * Get rate limit stats
     */
    async getRateLimitStats(identifier: string, window: number): Promise<{
        current: number;
        limit: number;
        reset: number;
    }> {
        const key = `rate:${identifier}:${Math.floor(Date.now() / window)}`;
        const current = await this.get(key) || 0;
        const ttl = await this.ttl(key);
        const reset = ttl > 0 ? Math.ceil(Date.now() / 1000) + ttl : 0;

        return { current, limit: 0, reset };
    }

    /**
     * Reset rate limit
     */
    async resetRateLimit(identifier: string, window: number): Promise<void> {
        const key = `rate:${identifier}:${Math.floor(Date.now() / window)}`;
        await this.delete(key);
    }
}

/**
 * API response cache repository
 */
export class ApiResponseCacheRepository extends CacheRepository {
    constructor(cacheService: CacheService) {
        super(cacheService, {
            prefix: 'api_responses',
            defaultTTL: 300, // 5 minutes
            json: true,
        });
    }

    /**
     * Cache API response
     */
    async cacheResponse(
        method: string,
        path: string,
        query: any,
        response: any,
        ttl?: number
    ): Promise<void> {
        const key = this.generateResponseKey(method, path, query);
        await this.set(key, response, ttl);
    }

    /**
     * Get cached API response
     */
    async getCachedResponse(
        method: string,
        path: string,
        query: any
    ): Promise<any | null> {
        const key = this.generateResponseKey(method, path, query);
        return this.get(key);
    }

    /**
     * Invalidate API response cache
     */
    async invalidateResponse(
        method: string,
        path: string,
        query?: any
    ): Promise<void> {
        if (query) {
            const key = this.generateResponseKey(method, path, query);
            await this.delete(key);
        } else {
            // Invalidate all responses for this path
            await this.clear(`${method}:${path}:*`);
        }
    }

    /**
     * Generate response cache key
     */
    private generateResponseKey(method: string, path: string, query: any): string {
        const queryStr = query ? JSON.stringify(query) : '';
        const hash = require('crypto').createHash('md5').update(queryStr).digest('hex');
        return `${method}:${path}:${hash}`;
    }
}

/**
 * Entity cache repository
 */
export class EntityCacheRepository<T = any> extends CacheRepository<T> {
    constructor(
        cacheService: CacheService,
        private entityName: string,
        config: CacheRepositoryConfig = {}
    ) {
        super(cacheService, {
            prefix: `entities:${entityName}`,
            ...config,
        });
    }

    /**
     * Cache entity
     */
    async cacheEntity(id: string, entity: T, ttl?: number): Promise<void> {
        await this.set(id, entity, ttl);
    }

    /**
     * Get cached entity
     */
    async getCachedEntity(id: string): Promise<T | null> {
        return this.get(id);
    }

    /**
     * Cache entity list
     */
    async cacheEntityList(entities: T[], ttl?: number): Promise<void> {
        const entries = entities.map((entity: any) => ({
            key: entity.id,
            value: entity,
            ttl,
        }));

        await this.setMany(entries);
    }

    /**
     * Get cached entity list
     */
    async getCachedEntityList(ids: string[]): Promise<Map<string, T | null>> {
        return this.getMany(ids);
    }

    /**
     * Invalidate entity
     */
    async invalidateEntity(id: string): Promise<void> {
        await this.delete(id);
    }

    /**
     * Invalidate entity list
     */
    async invalidateEntityList(ids: string[]): Promise<void> {
        await this.deleteMany(ids);
    }

    /**
     * Invalidate all entities
     */
    async invalidateAll(): Promise<void> {
        await this.clear();
    }
}

/**
 * Cache repository factory
 */
export class CacheRepositoryFactory {
    private repositories = new Map<string, ICacheRepository<any>>();

    constructor(private cacheService: CacheService) { }

    /**
     * Create cache repository
     */
    create<T>(name: string, config?: CacheRepositoryConfig): ICacheRepository<T> {
        if (this.repositories.has(name)) {
            return this.repositories.get(name)!;
        }

        const repository = new CacheRepository<T>(this.cacheService, config);
        this.repositories.set(name, repository);

        return repository;
    }

    /**
     * Create user cache repository
     */
    createUserCache(): UserCacheRepository {
        return new UserCacheRepository(this.cacheService);
    }

    /**
     * Create session cache repository
     */
    createSessionCache(): SessionCacheRepository {
        return new SessionCacheRepository(this.cacheService);
    }

    /**
     * Create rate limit cache repository
     */
    createRateLimitCache(): RateLimitCacheRepository {
        return new RateLimitCacheRepository(this.cacheService);
    }

    /**
     * Create API response cache repository
     */
    createApiResponseCache(): ApiResponseCacheRepository {
        return new ApiResponseCacheRepository(this.cacheService);
    }

    /**
     * Create entity cache repository
     */
    createEntityCache<T>(entityName: string, config?: CacheRepositoryConfig): EntityCacheRepository<T> {
        return new EntityCacheRepository<T>(this.cacheService, entityName, config);
    }
}