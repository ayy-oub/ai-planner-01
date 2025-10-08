import { Redis } from 'ioredis';
import { config } from '../config';
import { AppError, CacheError } from './errors';
import { logger } from './logger';
import { promisify } from 'util';

/**
 * Cache options interface
 */
export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    compress?: boolean; // Whether to compress large values
    prefix?: string; // Key prefix
    json?: boolean; // Whether to serialize as JSON
}

/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitsPerSecond: number;
    missesPerSecond: number;
    hitRate: number;
    memoryUsage: number;
    keyCount: number;
}

/**
 * Redis-based cache service
 */
export class CacheService {
    private redis: Redis;
    private stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        startTime: Date.now(),
    };

    constructor(redis?: Redis) {
        this.redis = redis || new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
        });

        this.setupEventHandlers();
    }

    /**
     * Setup Redis event handlers
     */
    private setupEventHandlers(): void {
        this.redis.on('error', (error) => {
            logger.error('Redis connection error', { error: error.message, domain: 'cache' });
        });

        this.redis.on('connect', () => {
            logger.info('Connected to Redis', { domain: 'cache' });
        });

        this.redis.on('reconnecting', () => {
            logger.warn('Reconnecting to Redis', { domain: 'cache' });
        });
    }

    /**
     * Generate cache key with prefix
     */
    private generateKey(key: string, prefix?: string): string {
        const keyPrefix = prefix || 'cache';
        return `${keyPrefix}:${key}`;
    }

    /**
     * Serialize value for storage
     */
    private serialize(value: any, options: CacheOptions): string {
        if (options.json !== false) {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Deserialize value from storage
     */
    private deserialize(value: string | null, options: CacheOptions): any {
        if (value === null) return null;

        if (options.json !== false) {
            try {
                return JSON.parse(value);
            } catch (error) {
                logger.error('Failed to deserialize cache value', { error: error.message, value });
                return null;
            }
        }
        return value;
    }

    /**
     * Set cache value
     */
    async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const serializedValue = this.serialize(value, options);

            if (options.ttl) {
                await this.redis.setex(cacheKey, options.ttl, serializedValue);
            } else {
                await this.redis.set(cacheKey, serializedValue);
            }

            this.stats.sets++;
            logger.debug('Cache set', { key: cacheKey, ttl: options.ttl, domain: 'cache' });
        } catch (error) {
            logger.error('Cache set error', { error: error.message, key, domain: 'cache' });
            throw new CacheError(`Failed to set cache value: ${error.message}`);
        }
    }

    /**
     * Get cache value
     */
    async get(key: string, options: CacheOptions = {}): Promise<any | null> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const value = await this.redis.get(cacheKey);

            if (value === null) {
                this.stats.misses++;
                logger.debug('Cache miss', { key: cacheKey, domain: 'cache' });
                return null;
            }

            this.stats.hits++;
            logger.debug('Cache hit', { key: cacheKey, domain: 'cache' });
            return this.deserialize(value, options);
        } catch (error) {
            logger.error('Cache get error', { error: error.message, key, domain: 'cache' });
            throw new CacheError(`Failed to get cache value: ${error.message}`);
        }
    }

    /**
     * Get multiple cache values
     */
    async getMany(keys: string[], options: CacheOptions = {}): Promise<Map<string, any>> {
        try {
            const cacheKeys = keys.map(key => this.generateKey(key, options.prefix));
            const values = await this.redis.mget(...cacheKeys);

            const result = new Map<string, any>();
            keys.forEach((key, index) => {
                const value = values[index];
                if (value !== null) {
                    result.set(key, this.deserialize(value, options));
                    this.stats.hits++;
                } else {
                    this.stats.misses++;
                }
            });

            logger.debug('Cache getMany', { keys: cacheKeys, count: result.size, domain: 'cache' });
            return result;
        } catch (error) {
            logger.error('Cache getMany error', { error: error.message, keys, domain: 'cache' });
            throw new CacheError(`Failed to get multiple cache values: ${error.message}`);
        }
    }

    /**
     * Delete cache key
     */
    async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.del(cacheKey);

            this.stats.deletes++;
            logger.debug('Cache delete', { key: cacheKey, domain: 'cache' });
            return result > 0;
        } catch (error) {
            logger.error('Cache delete error', { error: error.message, key, domain: 'cache' });
            throw new CacheError(`Failed to delete cache value: ${error.message}`);
        }
    }

    /**
     * Delete multiple cache keys
     */
    async deleteMany(keys: string[], options: CacheOptions = {}): Promise<number> {
        try {
            const cacheKeys = keys.map(key => this.generateKey(key, options.prefix));
            const result = await this.redis.del(...cacheKeys);

            this.stats.deletes += result;
            logger.debug('Cache deleteMany', { keys: cacheKeys, count: result, domain: 'cache' });
            return result;
        } catch (error) {
            logger.error('Cache deleteMany error', { error: error.message, keys, domain: 'cache' });
            throw new CacheError(`Failed to delete multiple cache values: ${error.message}`);
        }
    }

    /**
     * Increment numeric cache value
     */
    async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.incrby(cacheKey, amount);

            // Set TTL if provided
            if (options.ttl) {
                await this.redis.expire(cacheKey, options.ttl);
            }

            logger.debug('Cache increment', { key: cacheKey, amount, result, domain: 'cache' });
            return result;
        } catch (error) {
            logger.error('Cache increment error', { error: error.message, key, amount, domain: 'cache' });
            throw new CacheError(`Failed to increment cache value: ${error.message}`);
        }
    }

    /**
     * Decrement numeric cache value
     */
    async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.decrby(cacheKey, amount);

            // Set TTL if provided
            if (options.ttl) {
                await this.redis.expire(cacheKey, options.ttl);
            }

            logger.debug('Cache decrement', { key: cacheKey, amount, result, domain: 'cache' });
            return result;
        } catch (error) {
            logger.error('Cache decrement error', { error: error.message, key, amount, domain: 'cache' });
            throw new CacheError(`Failed to decrement cache value: ${error.message}`);
        }
    }

    /**
     * Set cache value with TTL in milliseconds
     */
    async setWithTTL(key: string, value: any, ttlMs: number, options: CacheOptions = {}): Promise<void> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const serializedValue = this.serialize(value, options);
            const ttlSeconds = Math.ceil(ttlMs / 1000);

            await this.redis.psetex(cacheKey, ttlMs, serializedValue);

            this.stats.sets++;
            logger.debug('Cache setWithTTL', { key: cacheKey, ttlMs, ttlSeconds, domain: 'cache' });
        } catch (error) {
            logger.error('Cache setWithTTL error', { error: error.message, key, ttlMs, domain: 'cache' });
            throw new CacheError(`Failed to set cache value with TTL: ${error.message}`);
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.exists(cacheKey);

            return result === 1;
        } catch (error) {
            logger.error('Cache exists error', { error: error.message, key, domain: 'cache' });
            throw new CacheError(`Failed to check cache key existence: ${error.message}`);
        }
    }

    /**
     * Get TTL for key
     */
    async ttl(key: string, options: CacheOptions = {}): Promise<number> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.ttl(cacheKey);

            return result;
        } catch (error) {
            logger.error('Cache ttl error', { error: error.message, key, domain: 'cache' });
            throw new CacheError(`Failed to get cache key TTL: ${error.message}`);
        }
    }

    /**
     * Set TTL for key
     */
    async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
        try {
            const cacheKey = this.generateKey(key, options.prefix);
            const result = await this.redis.expire(cacheKey, ttl);

            logger.debug('Cache expire', { key: cacheKey, ttl, result, domain: 'cache' });
            return result === 1;
        } catch (error) {
            logger.error('Cache expire error', { error: error.message, key, ttl, domain: 'cache' });
            throw new CacheError(`Failed to set cache key TTL: ${error.message}`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const now = Date.now();
        const uptime = (now - this.stats.startTime) / 1000; // seconds

        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitsPerSecond: this.stats.hits / uptime,
            missesPerSecond: this.stats.misses / uptime,
            hitRate,
            memoryUsage: 0, // Would need Redis INFO command
            keyCount: 0, // Would need Redis DBSIZE command
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            startTime: Date.now(),
        };
    }

    /**
     * Clear all cache keys with prefix
     */
    async clear(prefix?: string): Promise<void> {
        try {
            const pattern = prefix ? `${prefix}:*` : 'cache:*';
            let cursor = '0';
            let deleted = 0;

            do {
                const result = await this.redis.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100
                );

                cursor = result[0];
                const keys = result[1];

                if (keys.length > 0) {
                    const deletedCount = await this.redis.del(...keys);
                    deleted += deletedCount;
                }
            } while (cursor !== '0');

            logger.info('Cache cleared', { pattern, deleted, domain: 'cache' });
        } catch (error) {
            logger.error('Cache clear error', { error: error.message, prefix, domain: 'cache' });
            throw new CacheError(`Failed to clear cache: ${error.message}`);
        }
    }

    /**
     * Get cache size (approximate)
     */
    async size(): Promise<number> {
        try {
            const info = await this.redis.info('memory');
            const usedMemoryMatch = info.match(/used_memory:(\d+)/);
            return usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
        } catch (error) {
            logger.error('Cache size error', { error: error.message, domain: 'cache' });
            return 0;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency: number;
        error?: string;
    }> {
        const start = Date.now();

        try {
            await this.redis.ping();
            const latency = Date.now() - start;

            return {
                status: 'healthy',
                latency,
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                latency: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Disconnect from Redis
     */
    async disconnect(): Promise<void> {
        try {
            await this.redis.quit();
            logger.info('Cache service disconnected', { domain: 'cache' });
        } catch (error) {
            logger.error('Cache disconnect error', { error: error.message, domain: 'cache' });
            throw error;
        }
    }
}

/**
 * Cache wrapper with automatic serialization
 */
export class CacheWrapper<T = any> {
    constructor(
        private cacheService: CacheService,
        private key: string,
        private options: CacheOptions = {}
    ) { }

    /**
     * Get value from cache
     */
    async get(): Promise<T | null> {
        return this.cacheService.get(this.key, this.options);
    }

    /**
     * Set value in cache
     */
    async set(value: T): Promise<void> {
        return this.cacheService.set(this.key, value, this.options);
    }

    /**
     * Delete from cache
     */
    async delete(): Promise<boolean> {
        return this.cacheService.delete(this.key, this.options);
    }

    /**
     * Get or set value (cache-aside pattern)
     */
    async getOrSet(factory: () => Promise<T>): Promise<T> {
        let value = await this.get();

        if (value === null) {
            value = await factory();
            await this.set(value);
        }

        return value;
    }

    /**
     * Update value atomically
     */
    async update(updater: (value: T | null) => T): Promise<T> {
        const currentValue = await this.get();
        const newValue = updater(currentValue);
        await this.set(newValue);
        return newValue;
    }
}

/**
 * Memory cache for development/testing
 */
export class MemoryCacheService {
    private cache = new Map<string, { value: any; expires: number }>();
    private stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
    };

    async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
        const expires = options.ttl ? Date.now() + (options.ttl * 1000) : Infinity;
        this.cache.set(key, { value, expires });
        this.stats.sets++;
    }

    async get(key: string): Promise<any | null> {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return null;
        }

        if (item.expires < Date.now()) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    async delete(key: string): Promise<boolean> {
        const existed = this.cache.has(key);
        this.cache.delete(key);
        if (existed) this.stats.deletes++;
        return existed;
    }

    async exists(key: string): Promise<boolean> {
        const item = this.cache.get(key);
        if (!item) return false;

        if (item.expires < Date.now()) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    getStats() {
        return { ...this.stats };
    }

    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    }
}

/**
 * Cache decorators
 */
export function Cacheable(options: CacheOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const cacheService = new CacheService();

        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

            // Try to get from cache
            const cached = await cacheService.get(cacheKey, options);
            if (cached !== null) {
                return cached;
            }

            // Execute original method
            const result = await originalMethod.apply(this, args);

            // Store in cache
            if (result !== null && result !== undefined) {
                await cacheService.set(cacheKey, result, options);
            }

            return result;
        };

        return descriptor;
    };
}

/**
 * Cache eviction decorator
 */
export function CacheEvict(pattern: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const cacheService = new CacheService();

        descriptor.value = async function (...args: any[]) {
            // Execute original method first
            const result = await originalMethod.apply(this, args);

            // Clear matching cache entries
            await cacheService.clear(pattern);

            return result;
        };

        return descriptor;
    };
}

export default CacheService;