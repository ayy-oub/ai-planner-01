import Redis, { ChainableCommander } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheError } from '../utils/errors';
import { gzip, ungzip } from 'node-gzip';
import { inject, injectable } from 'tsyringe';
import { getRedisClient } from '@/infrastructure/database/redis';

/**
 * Cache service options
 */
export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    compress?: boolean; // Whether to compress large values
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
    evictionCount: number;
    expirationCount: number;
}

/**
 * Redis-based cache service
 */
@injectable()
export class CacheService {
    private redis: Redis;
    private stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        startTime: Date.now(),
    };
    private compressionThreshold = 1024; // 1KB

    constructor(@inject('RedisClient') redis?: Redis) {
        this.redis = redis || getRedisClient(); // shared singleton
        this.setupEventHandlers();
      }

    getClient(): Redis {
        return this.redis;
    }

    /**
     * Setup Redis event handlers
     */
    private setupEventHandlers(): void {
        this.redis.on('error', (error: any) => {
            logger.error('Redis connection error', { error: error.message, domain: 'cache' });
        });

        this.redis.on('connect', () => {
            logger.info('Connected to Redis', { domain: 'cache' });
        });

        this.redis.on('reconnecting', () => {
            logger.warn('Reconnecting to Redis', { domain: 'cache' });
        });

        this.redis.on('ready', () => {
            logger.info('Redis client ready', { domain: 'cache' });
        });

        this.redis.on('end', () => {
            logger.info('Redis connection ended', { domain: 'cache' });
        });
    }

    /**
     * Serialize value for storage
     */
    private serialize(value: any, options: CacheOptions): string {
        let serialized: string;

        if (options.json !== false) {
            serialized = JSON.stringify(value);
        } else {
            serialized = String(value);
        }

        return serialized;
    }

    /**
     * Deserialize value from storage
     */
    private deserialize(value: string | null, options: CacheOptions): any {
        if (value === null) return null;

        if (options.json !== false) {
            try {
                return JSON.parse(value);
            } catch (error: any) {
                logger.error('Failed to deserialize cache value', { error: error.message, value });
                return null;
            }
        }

        return value;
    }

    /**
     * Compress value if needed
     */
    private async compressIfNeeded(value: string, options: CacheOptions): Promise<string> {
        if (options.compress && value.length > this.compressionThreshold) {
            try {
                const compressed = await gzip(Buffer.from(value));
                return `__COMPRESSED__${compressed.toString('base64')}`;
            } catch (error: any) {
                logger.warn('Compression failed, storing uncompressed', { error: error.message });
                return value;
            }
        }
        return value;
    }

    /**
     * Decompress value if needed
     */
    private async decompressIfNeeded(value: string, options: CacheOptions): Promise<string> {
        if (value.startsWith('__COMPRESSED__')) {
            try {
                const compressed = Buffer.from(value.replace('__COMPRESSED__', ''), 'base64');
                const decompressed = await ungzip(compressed);
                return decompressed.toString();
            } catch (error: any) {
                logger.error('Decompression failed', { error: error.message });
                throw new CacheError('Failed to decompress cache value');
            }
        }
        return value;
    }

    async ping(): Promise<'PONG'> {
        // this.client is the ioredis instance
        return this.redis.ping();
      }

    /**
     * Set value in cache
     */
    async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
        try {
            let serialized = this.serialize(value, options);
            serialized = await this.compressIfNeeded(serialized, options);

            if (options.ttl) {
                await this.redis.setex(key, options.ttl, serialized);
            } else {
                await this.redis.set(key, serialized);
            }

            this.stats.sets++;
            logger.debug('Cache set', { key, ttl: options.ttl, compressed: options.compress });
        } catch (error: any) {
            logger.error('Cache set error', { error: error.message, key });
            throw new CacheError(`Failed to set cache value: ${error.message}`);
        }
    }

    /**
     * Get value from cache
     */
    async get(key: string, options: CacheOptions = {}): Promise<any | null> {
        try {
            const value = await this.redis.get(key);

            if (value === null) {
                this.stats.misses++;
                logger.debug('Cache miss', { key });
                return null;
            }

            this.stats.hits++;
            logger.debug('Cache hit', { key });

            const decompressed = await this.decompressIfNeeded(value, options);
            return this.deserialize(decompressed, options);
        } catch (error: any) {
            logger.error('Cache get error', { error: error.message, key });
            throw new CacheError(`Failed to get cache value: ${error.message}`);
        }
    }

    /**
     * Get multiple values
     */
    async getMany(keys: string[], options: CacheOptions = {}): Promise<Map<string, any>> {
        try {
            if (keys.length === 0) {
                return new Map();
            }

            const values = await this.redis.mget(...keys);
            const results = new Map<string, any>();

            for (let i = 0; i < keys.length; i++) {
                const value = values[i];
                if (value !== null) {
                    const decompressed = await this.decompressIfNeeded(value, options);
                    results.set(keys[i], this.deserialize(decompressed, options));
                    this.stats.hits++;
                } else {
                    this.stats.misses++;
                }
            }

            logger.debug('Cache getMany', { keys: keys.length, hits: results.size });
            return results;
        } catch (error: any) {
            logger.error('Cache getMany error', { error: error.message, keys });
            throw new CacheError(`Failed to get multiple cache values: ${error.message}`);
        }
    }

    /**
     * Set multiple values
     */
    async setMany(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
        try {
            if (entries.length === 0) {
                return;
            }

            const pipeline = this.redis.pipeline();

            for (const entry of entries) {
                const serialized = this.serialize(entry.value, { json: true });
                const compressed = await this.compressIfNeeded(serialized, { compress: false });

                if (entry.ttl) {
                    pipeline.setex(entry.key, entry.ttl, compressed);
                } else {
                    pipeline.set(entry.key, compressed);
                }
            }

            await pipeline.exec();
            this.stats.sets += entries.length;

            logger.debug('Cache setMany', { count: entries.length });
        } catch (error: any) {
            logger.error('Cache setMany error', { error: error.message, count: entries.length });
            throw new CacheError(`Failed to set multiple cache values: ${error.message}`);
        }
    }

    /**
   * Get cache memory usage (in bytes)
   * Returns approximate total Redis memory used, not just cache keys.
   */
    async size(): Promise<number> {
        try {
            const info = await this.redis.info('memory');

            // Try parsing "used_memory_dataset" first (actual data memory)
            const datasetMatch = info.match(/used_memory_dataset:(\d+)/);
            const usedMemoryMatch = info.match(/used_memory:(\d+)/);

            const bytes = datasetMatch
                ? parseInt(datasetMatch[1], 10)
                : usedMemoryMatch
                    ? parseInt(usedMemoryMatch[1], 10)
                    : 0;

            logger.debug('Cache memory usage retrieved', {
                usedMemory: bytes,
                unit: 'bytes',
            });

            return bytes;
        } catch (err: any) {
            logger.error('Cache size retrieval failed', {
                error: err?.message ?? String(err),
                domain: 'cache',
            });
            throw new CacheError(`Failed to get Redis memory usage: ${err?.message ?? String(err)}`);
        }
    }

    /**
     * Get cache memory usage in MB (helper)
     */
    async sizeInMB(): Promise<number> {
        const bytes = await this.size();
        return +(bytes / (1024 * 1024)).toFixed(2);
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<boolean> {
        try {
            const result = await this.redis.del(key);
            this.stats.deletes++;

            logger.debug('Cache delete', { key, result: result > 0 });
            return result > 0;
        } catch (error: any) {
            logger.error('Cache delete error', { error: error.message, key });
            throw new CacheError(`Failed to delete cache value: ${error.message}`);
        }
    }

    /**
     * Delete multiple values
     */
    async deleteMany(keys: string[]): Promise<number> {
        try {
            if (keys.length === 0) {
                return 0;
            }

            const result = await this.redis.del(...keys);
            this.stats.deletes += result;

            logger.debug('Cache deleteMany', { keys: keys.length, deleted: result });
            return result;
        } catch (error: any) {
            logger.error('Cache deleteMany error', { error: error.message, keys });
            throw new CacheError(`Failed to delete multiple cache values: ${error.message}`);
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error: any) {
            logger.error('Cache exists error', { error: error.message, key });
            throw new CacheError(`Failed to check cache key existence: ${error.message}`);
        }
    }

    /**
     * Set TTL for key
     */
    async expire(key: string, ttl: number): Promise<boolean> {
        try {
            const result = await this.redis.expire(key, ttl);
            return result === 1;
        } catch (error: any) {
            logger.error('Cache expire error', { error: error.message, key });
            throw new CacheError(`Failed to set cache key TTL: ${error.message}`);
        }
    }

    /**
     * Get TTL for key
     */
    async ttl(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key);
        } catch (error: any) {
            logger.error('Cache TTL error', { error: error.message, key });
            throw new CacheError(`Failed to get cache key TTL: ${error.message}`);
        }
    }

    /**
     * Increment numeric value
     */
    async increment(key: string, amount: number = 1): Promise<number> {
        try {
            const result = await this.redis.incrby(key, amount);
            logger.debug('Cache increment', { key, amount, result });
            return result;
        } catch (error: any) {
            logger.error('Cache increment error', { error: error.message, key });
            throw new CacheError(`Failed to increment cache value: ${error.message}`);
        }
    }

    /**
     * Decrement numeric value
     */
    async decrement(key: string, amount: number = 1): Promise<number> {
        try {
            const result = await this.redis.decrby(key, amount);
            logger.debug('Cache decrement', { key, amount, result });
            return result;
        } catch (error: any) {
            logger.error('Cache decrement error', { error: error.message, key });
            throw new CacheError(`Failed to decrement cache value: ${error.message}`);
        }
    }

    /**
     * Add value to set
     */
    async sadd(key: string, ...members: string[]): Promise<number> {
        try {
            const result = await this.redis.sadd(key, ...members);
            logger.debug('Cache sadd', { key, members: members.length, result });
            return result;
        } catch (error: any) {
            logger.error('Cache sadd error', { error: error.message, key });
            throw new CacheError(`Failed to add to set: ${error.message}`);
        }
    }

    /**
     * Remove value from set
     */
    async srem(key: string, ...members: string[]): Promise<number> {
        try {
            const result = await this.redis.srem(key, ...members);
            logger.debug('Cache srem', { key, members: members.length, result });
            return result;
        } catch (error: any) {
            logger.error('Cache srem error', { error: error.message, key });
            throw new CacheError(`Failed to remove from set: ${error.message}`);
        }
    }

    /**
     * Get set members
     */
    async smembers(key: string): Promise<string[]> {
        try {
            const result = await this.redis.smembers(key);
            logger.debug('Cache smembers', { key, count: result.length });
            return result;
        } catch (error: any) {
            logger.error('Cache smembers error', { error: error.message, key });
            throw new CacheError(`Failed to get set members: ${error.message}`);
        }
    }

    /**
     * Check if value is in set
     */
    async sismember(key: string, member: string): Promise<boolean> {
        try {
            const result = await this.redis.sismember(key, member);
            return result === 1;
        } catch (error: any) {
            logger.error('Cache sismember error', { error: error.message, key });
            throw new CacheError(`Failed to check set membership: ${error.message}`);
        }
    }

    /**
     * Add value to sorted set
     */
    async zadd(key: string, score: number, member: string): Promise<number> {
        try {
            const result = await this.redis.zadd(key, score, member);
            logger.debug('Cache zadd', { key, score, member, result });
            return result;
        } catch (error: any) {
            logger.error('Cache zadd error', { error: error.message, key });
            throw new CacheError(`Failed to add to sorted set: ${error.message}`);
        }
    }

    /**
     * Get sorted set range
     */
    async zrange(key: string, start: number, stop: number): Promise<string[]> {
        try {
            const result = await this.redis.zrange(key, start, stop);
            logger.debug('Cache zrange', { key, start, stop, count: result.length });
            return result;
        } catch (error: any) {
            logger.error('Cache zrange error', { error: error.message, key });
            throw new CacheError(`Failed to get sorted set range: ${error.message}`);
        }
    }

    /**
     * Get sorted set by score
     */
    async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
        try {
            const result = await this.redis.zrangebyscore(key, min, max);
            logger.debug('Cache zrangebyscore', { key, min, max, count: result.length });
            return result;
        } catch (error: any) {
            logger.error('Cache zrangebyscore error', { error: error.message, key });
            throw new CacheError(`Failed to get sorted set by score: ${error.message}`);
        }
    }

    /**
     * Publish message to channel
     */
    async publish(channel: string, message: string): Promise<number> {
        try {
            const result = await this.redis.publish(channel, message);
            logger.debug('Cache publish', { channel, message: message.substring(0, 100) });
            return result;
        } catch (error: any) {
            logger.error('Cache publish error', { error: error.message, channel });
            throw new CacheError(`Failed to publish message: ${error.message}`);
        }
    }

    /**
     * Subscribe to channel
     */
    subscribe(channels: string | string[], callback: (message: string, channel: string) => void): void {
        try {
            const subscriber = this.redis.duplicate();

            subscriber.subscribe(...(Array.isArray(channels) ? channels : [channels]));

            subscriber.on('message', (channel, message) => {
                logger.debug('Cache message received', { channel, message: message.substring(0, 100) });
                callback(message, channel);
            });

            logger.info('Cache subscription started', { channels });
        } catch (error: any) {
            logger.error('Cache subscribe error', { error: error.message, channels });
            throw new CacheError(`Failed to subscribe to channel: ${error.message}`);
        }
    }

    /**
 * Clear entire cache or only keys matching a pattern
 */
    async clear(pattern?: string): Promise<void> {
        try {
            if (pattern) {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                    logger.info(`Cache cleared for pattern: ${pattern}`);
                } else {
                    logger.info(`No keys found for pattern: ${pattern}`);
                }
            } else {
                await this.redis.flushdb();
                logger.info('Entire cache cleared');
            }
        } catch (error: any) {
            logger.error('Cache clear error', { error: error.message });
            throw new CacheError(`Failed to clear cache: ${error.message}`);
        }
    }


    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        try {
            const now = Date.now();
            const uptime = (now - this.stats.startTime) / 1000; // seconds

            const totalRequests = this.stats.hits + this.stats.misses;
            const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

            const info = await this.redis.info();
            const memoryMatch = info.match(/used_memory:(\d+)/);
            const keyspaceMatch = info.match(/db0:keys=(\d+)/);
            const evictedMatch = info.match(/evicted_keys:(\d+)/);
            const expiredMatch = info.match(/expired_keys:(\d+)/);

            return {
                hits: this.stats.hits,
                misses: this.stats.misses,
                sets: this.stats.sets,
                deletes: this.stats.deletes,
                hitsPerSecond: this.stats.hits / uptime,
                missesPerSecond: this.stats.misses / uptime,
                hitRate,
                memoryUsage: memoryMatch ? parseInt(memoryMatch[1]) : 0,
                keyCount: keyspaceMatch ? parseInt(keyspaceMatch[1]) : 0,
                evictionCount: evictedMatch ? parseInt(evictedMatch[1]) : 0,
                expirationCount: expiredMatch ? parseInt(expiredMatch[1]) : 0,
            };
        } catch (error: any) {
            logger.error('Cache stats error', { error: error.message });
            throw new CacheError(`Failed to get cache statistics: ${error.message}`);
        }
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
        } catch (error: any) {
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
            logger.info('Cache service disconnected');
        } catch (error: any) {
            logger.error('Cache disconnect error', { error: error.message });
            throw error;
        }
    }

    /**
 * Create pipeline for batch operations
 */
    pipeline(): ChainableCommander {
        return this.redis.pipeline();
    }

    /**
     * Create transaction for atomic operations
     */
    multi(): ChainableCommander {
        return this.redis.multi();
    }

    /* ------------------------------------------------------------------ */
    /*  NEW:  key enumeration  (simple KEYS implementation)                */
    /* ------------------------------------------------------------------ */

    /**
     * Return all keys matching a pattern (uses native Redis KEYS).
     * WARNING: O(N) – fine for admin/back-office, avoid in hot paths.
     */
    async keys(pattern: string): Promise<string[]> {
        try {
            const list = await this.redis.keys(pattern);
            logger.debug('Cache keys', { pattern, count: list.length });
            return list;
        } catch (err: any) {
            logger.error('Cache keys error', { pattern, error: err.message });
            throw new CacheError(`Failed to list keys: ${err.message}`);
        }
    }

    /**
     * Delete every key that matches the pattern.
     * Returns number of keys removed.
     */
    async deleteByPattern(pattern: string): Promise<number> {
        const keys = await this.keys(pattern);
        if (keys.length === 0) return 0;

        const deleted = await this.deleteMany(keys);
        logger.info('Cache deleteByPattern', { pattern, deleted });
        return deleted;
    }
}

/**
 * Specialized cache services
 */

/**
 * Session cache service
 */
export class SessionCacheService extends CacheService {
    constructor(redis?: Redis) {
        super(redis);
    }

    /**
     * Cache user session
     */
    async cacheSession(sessionId: string, userId: string, sessionData: any): Promise<void> {
        const key = `session:${sessionId}`;
        const data = {
            userId,
            ...sessionData,
            createdAt: new Date().toISOString(),
        };

        await this.set(key, data, { ttl: 3600 }); // 1 hour
    }

    /**
     * Get cached session
     */
    async getSession(sessionId: string): Promise<any | null> {
        const key = `session:${sessionId}`;
        return this.get(key);
    }

    /**
     * Extend session TTL
     */
    async extendSession(sessionId: string, ttl: number = 3600): Promise<boolean> {
        const key = `session:${sessionId}`;
        return this.expire(key, ttl);
    }

    /**
     * Invalidate session
     */
    async invalidateSession(sessionId: string): Promise<void> {
        const key = `session:${sessionId}`;
        await this.delete(key);
    }

    /**
     * Cache user sessions index
     */
    async cacheUserSessionsIndex(userId: string, sessionIds: string[]): Promise<void> {
        const key = `user_sessions:${userId}`;
        await this.set(key, sessionIds, { ttl: 3600 }); // 1 hour
    }

    /**
     * Get user sessions index
     */
    async getUserSessionsIndex(userId: string): Promise<string[] | null> {
        const key = `user_sessions:${userId}`;
        return this.get(key);
    }

    /**
 * Invalidate all user sessions
 */
    async invalidateAllUserSessions(userId: string): Promise<void> {
        const indexKey = `user_sessions:${userId}`;
        const sessionIds = await this.get(indexKey) as string[] | null;

        if (sessionIds) {
            // Delete all sessions
            const deletePromises = sessionIds.map((sessionId: string) =>
                this.invalidateSession(sessionId)
            );

            await Promise.all(deletePromises);

            // Delete index
            await this.delete(indexKey);
        }
    }
}

/**
 * User cache service
 */
export class UserCacheService extends CacheService {
    constructor(redis?: Redis) {
        super(redis);
    }

    /**
     * Cache user profile
     */
    async cacheUserProfile(userId: string, profile: any): Promise<void> {
        const key = `user_profile:${userId}`;
        await this.set(key, profile, { ttl: 1800 }); // 30 minutes
    }

    /**
     * Get cached user profile
     */
    async getUserProfile(userId: string): Promise<any | null> {
        const key = `user_profile:${userId}`;
        return this.get(key);
    }

    /**
     * Cache user by email
     */
    async cacheUserByEmail(email: string, userData: any): Promise<void> {
        const key = `user_email:${email.toLowerCase()}`;
        await this.set(key, userData, { ttl: 1800 }); // 30 minutes
    }

    /**
     * Get cached user by email
     */
    async getUserByEmail(email: string): Promise<any | null> {
        const key = `user_email:${email.toLowerCase()}`;
        return this.get(key);
    }

    /**
     * Cache user permissions
     */
    async cacheUserPermissions(userId: string, permissions: string[]): Promise<void> {
        const key = `user_permissions:${userId}`;
        await this.set(key, permissions, { ttl: 3600 }); // 1 hour
    }

    /**
     * Get cached user permissions
     */
    async getUserPermissions(userId: string): Promise<string[] | null> {
        const key = `user_permissions:${userId}`;
        return this.get(key);
    }

    /**
     * Cache user subscription
     */
    async cacheUserSubscription(userId: string, subscription: any): Promise<void> {
        const key = `user_subscription:${userId}`;
        await this.set(key, subscription, { ttl: 900 }); // 15 minutes
    }

    /**
     * Get cached user subscription
     */
    async getUserSubscription(userId: string): Promise<any | null> {
        const key = `user_subscription:${userId}`;
        return this.get(key);
    }

    /**
     * Invalidate user cache
     */
    async invalidateUser(userId: string): Promise<void> {
        const keys = [
            `user_profile:${userId}`,
            `user_permissions:${userId}`,
            `user_subscription:${userId}`,
        ];

        await this.deleteMany(keys);
    }

    /**
     * Invalidate user by email
     */
    async invalidateUserByEmail(email: string): Promise<void> {
        const key = `user_email:${email.toLowerCase()}`;
        await this.delete(key);
    }
}

/**
 * Rate limit cache service
 */
export class RateLimitCacheService extends CacheService {
    constructor(redis?: Redis) {
        super(redis);
    }

    /**
     * Check rate limit using sliding window
     */
    async checkRateLimit(
        identifier: string,
        limit: number,
        windowMs: number
    ): Promise<{
        allowed: boolean;
        remaining: number;
        reset: number;
        retryAfter?: number;
    }> {
        const now = Date.now();
        const window = Math.floor(now / windowMs);
        const key = `rate_limit:${identifier}:${window}`;

        const current = await this.increment(key);

        if (current === 1) {
            // Set expiration for new window
            await this.expire(key, Math.ceil(windowMs / 1000));
        }

        const allowed = current <= limit;
        const remaining = Math.max(0, limit - current);
        const reset = Math.ceil((now + windowMs) / 1000);
        const retryAfter = allowed ? undefined : Math.ceil((window + 1) * windowMs / 1000 - now / 1000);

        return { allowed, remaining, reset, retryAfter };
    }

    /**
     * Check rate limit using token bucket
     */
    async checkTokenBucket(
        identifier: string,
        capacity: number,
        refillRate: number,
        refillPeriod: number
    ): Promise<{
        allowed: boolean;
        remaining: number;
        retryAfter?: number;
    }> {
        const key = `token_bucket:${identifier}`;
        const now = Date.now();

        // Get current bucket state
        const bucketData = await this.get(key) || {
            tokens: capacity,
            lastRefill: now,
        };

        // Calculate tokens to add
        const timePassed = now - bucketData.lastRefill;
        const tokensToAdd = Math.floor((timePassed / refillPeriod) * refillRate);
        const newTokens = Math.min(capacity, bucketData.tokens + tokensToAdd);

        // Check if request can be processed
        const allowed = newTokens >= 1;
        const remaining = allowed ? newTokens - 1 : newTokens;

        if (allowed) {
            // Update bucket
            await this.set(key, {
                tokens: remaining,
                lastRefill: now,
            }, { ttl: Math.ceil(refillPeriod / 1000) });
        }

        const retryAfter = allowed ? undefined : Math.ceil((1 - newTokens) / refillRate * refillPeriod / 1000);

        return { allowed, remaining, retryAfter };
    }

    /**
     * Get rate limit stats
     */
    async getRateLimitStats(identifier: string, windowMs: number): Promise<{
        current: number;
        limit: number;
        reset: number;
    }> {
        const window = Math.floor(Date.now() / windowMs);
        const key = `rate_limit:${identifier}:${window}`;
        const current = await this.get(key) || 0;
        const ttl = await this.ttl(key);
        const reset = ttl > 0 ? Math.ceil(Date.now() / 1000) + ttl : 0;

        return { current, limit: 0, reset };
    }

    /**
     * Reset rate limit
     */
    async resetRateLimit(identifier: string, windowMs: number): Promise<void> {
        const window = Math.floor(Date.now() / windowMs);
        const key = `rate_limit:${identifier}:${window}`;
        await this.delete(key);
    }
}

/**
 * API response cache service
 */
export class ApiResponseCacheService extends CacheService {
    constructor(redis?: Redis) {
        super(redis);
    }

    /**
     * Cache API response
     */
    async cacheResponse(
        method: string,
        path: string,
        query: any,
        response: any,
        ttl: number = 300
    ): Promise<void> {
        const key = this.generateResponseKey(method, path, query);
        await this.set(key, response, { ttl: ttl });
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
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(queryStr).digest('hex');
        return `api_response:${method}:${path}:${hash}`;
    }

    /**
     * Cache health check response
     */
    async cacheHealthCheck(service: string, status: any, ttl: number = 60): Promise<void> {
        const key = `health_check:${service}`;
        await this.set(key, status, { ttl: ttl });
    }

    /**
     * Get cached health check
     */
    async getCachedHealthCheck(service: string): Promise<any | null> {
        const key = `health_check:${service}`;
        return this.get(key);
    }
}

/**
 * Distributed lock using Redis
 */
export class RedisDistributedLock {
    constructor(private redis: Redis) { }

    /**
     * Acquire lock
     */
    async acquire(
        resource: string,
        ttl: number = 30000,
        timeout: number = 10000
    ): Promise<string | null> {
        const lockId = require('crypto').randomBytes(16).toString('hex');
        const lockKey = `lock:${resource}`;
        const ttlSeconds = Math.ceil(ttl / 1000);

        const start = Date.now();

        while (Date.now() - start < timeout) {
            const result = await this.redis.set(
                lockKey,
                lockId,
                'PX',
                ttl,
                'NX'
            );

            if (result === 'OK') {
                return lockId;
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return null; // Failed to acquire lock
    }

    /**
     * Release lock
     */
    async release(resource: string, lockId: string): Promise<boolean> {
        const lockKey = `lock:${resource}`;

        // Use Lua script for atomic operation
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

        const result = await this.redis.eval(script, 1, lockKey, lockId);
        return result === 1;
    }

    /**
     * Extend lock TTL
     */
    async extend(resource: string, lockId: string, ttl: number): Promise<boolean> {
        const lockKey = `lock:${resource}`;

        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

        const result = await this.redis.eval(script, 1, lockKey, lockId, ttl);
        return result === 1;
    }
}

/**
 * Cache warming service
 */
export class CacheWarmingService {
    constructor(private cacheService: CacheService) { }

    /**
     * Warm cache with frequently accessed data
     */
    async warmCache(data: Array<{
        key: string;
        value: any;
        ttl?: number;
    }>): Promise<void> {
        logger.info('Starting cache warming', { entries: data.length });

        const batchSize = 100;
        const batches = [];

        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            await this.cacheService.setMany(batch);
        }

        logger.info('Cache warming completed', { entries: data.length });
    }

    /**
     * Schedule cache warming
     */
    scheduleCacheWarming(
        dataProvider: () => Promise<Array<{
            key: string;
            value: any;
            ttl?: number;
        }>>,
        interval: number = 3600000 // 1 hour
    ): void {
        const warmCache = async () => {
            try {
                const data = await dataProvider();
                await this.warmCache(data);
            } catch (error: any) {
                logger.error('Scheduled cache warming failed', { error: error.message });
            }
        };

        // Initial warm
        warmCache();

        // Schedule recurring warming
        setInterval(warmCache, interval);
    }
}

export const cacheService = new CacheService();