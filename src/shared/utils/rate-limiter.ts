import  RedisClientType  from 'ioredis';
import { config } from '../config';
import { AppError, RateLimitError } from './errors';
import { logger } from './logger';

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (identifier: string) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

/**
 * Rate limiter result
 */
export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
}

/**
 * Redis-based rate limiter
 */
export class RateLimiter {
    private redis: RedisClientType;
    private config: RateLimitConfig;

    constructor(redis: RedisClientType, config: RateLimitConfig) {
        this.redis = redis;
        this.config = config;
    }

    /**
     * Check if request is allowed
     */
    async checkLimit(identifier: string): Promise<RateLimitResult> {
        const key = this.config.keyGenerator
            ? this.config.keyGenerator(identifier)
            : `rate_limit:${identifier}`;

        const windowSeconds = Math.floor(this.config.windowMs / 1000);
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        try {
            // Use Redis pipeline for atomic operations
            const pipeline = this.redis.pipeline();

            // Remove expired entries
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Count current requests in window
            pipeline.zcard(key);

            // Add current request
            pipeline.zadd(key, now, now.toString());

            // Set expiration
            pipeline.expire(key, windowSeconds);

            const results = await pipeline.exec();

            if (!results) {
                throw new Error('Redis pipeline failed');
            }

            const currentRequests = results[1][1] as number;
            const allowed = currentRequests < this.config.maxRequests;
            const remaining = Math.max(0, this.config.maxRequests - currentRequests);
            const reset = new Date(now + this.config.windowMs);
            const retryAfter = allowed ? undefined : Math.ceil(this.config.windowMs / 1000);

            // Log rate limit check
            if (!allowed) {
                logger.warn('Rate limit exceeded', {
                    identifier,
                    key,
                    currentRequests,
                    limit: this.config.maxRequests,
                    windowMs: this.config.windowMs,
                });
            }

            return {
                allowed,
                limit: this.config.maxRequests,
                remaining,
                reset,
                retryAfter,
            };
        } catch (error: any) {
            logger.error('Rate limiter error', { error: error.message, identifier });
            // Fail open - allow request if rate limiter is down
            return {
                allowed: true,
                limit: this.config.maxRequests,
                remaining: this.config.maxRequests,
                reset: new Date(now + this.config.windowMs),
            };
        }
    }

    /**
     * Consume one request from the limit
     */
    async consume(identifier: string): Promise<RateLimitResult> {
        const result = await this.checkLimit(identifier);

        if (!result.allowed) {
            throw new RateLimitError('Rate limit exceeded', result.retryAfter);
        }

        return result;
    }

    /**
     * Reset rate limit for identifier
     */
    async reset(identifier: string): Promise<void> {
        const key = this.config.keyGenerator
            ? this.config.keyGenerator(identifier)
            : `rate_limit:${identifier}`;

        try {
            await this.redis.del(key);
            logger.info('Rate limit reset', { identifier, key });
        } catch (error: any) {
            logger.error('Failed to reset rate limit', { error: error.message, identifier });
            throw new AppError('Failed to reset rate limit', 500, 'RATE_LIMIT_RESET_ERROR');
        }
    }

    /**
     * Get current usage statistics
     */
    async getStats(identifier: string): Promise<{
        current: number;
        limit: number;
        reset: Date;
    }> {
        const key = this.config.keyGenerator
            ? this.config.keyGenerator(identifier)
            : `rate_limit:${identifier}`;

        const windowStart = Date.now() - this.config.windowMs;

        try {
            const pipeline = this.redis.pipeline();
            pipeline.zremrangebyscore(key, 0, windowStart);
            pipeline.zcard(key);
            pipeline.ttl(key);

            const results = await pipeline.exec();

            if (!results) {
                throw new Error('Redis pipeline failed');
            }

            const current = results[1][1] as number;
            const ttl = results[2][1] as number;
            const reset = new Date(Date.now() + (ttl * 1000));

            return {
                current,
                limit: this.config.maxRequests,
                reset,
            };
        } catch (error: any) {
            logger.error('Failed to get rate limit stats', { error: error.message, identifier });
            throw new AppError('Failed to get rate limit statistics', 500, 'RATE_LIMIT_STATS_ERROR');
        }
    }
}

/**
 * Token bucket rate limiter
 */
export class TokenBucketRateLimiter {
    private redis: RedisClientType;

    constructor(redis: RedisClientType) {
        this.redis = redis;
    }

    /**
     * Consume tokens from bucket
     */
    async consume(
        identifier: string,
        tokens: number = 1,
        bucketSize: number = 10,
        refillRate: number = 1,
        refillPeriod: number = 1000
    ): Promise<{
        allowed: boolean;
        remaining: number;
        retryAfter?: number;
    }> {
        const key = `token_bucket:${identifier}`;
        const now = Date.now();
        const refillTime = Math.floor(now / refillPeriod);

        try {
            const script = `
        local key = KEYS[1]
        local tokens = tonumber(ARGV[1])
        local bucketSize = tonumber(ARGV[2])
        local refillRate = tonumber(ARGV[3])
        local refillPeriod = tonumber(ARGV[4])
        local now = tonumber(ARGV[5])
        local refillTime = tonumber(ARGV[6])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local currentTokens = tonumber(bucket[1]) or bucketSize
        local lastRefill = tonumber(bucket[2]) or refillTime
        
        -- Calculate tokens to add
        local periodsPassed = refillTime - lastRefill
        local tokensToAdd = periodsPassed * refillRate
        currentTokens = math.min(bucketSize, currentTokens + tokensToAdd)
        
        -- Check if we can consume tokens
        local allowed = currentTokens >= tokens
        local remaining
        
        if allowed then
          remaining = currentTokens - tokens
          currentTokens = remaining
        else
          remaining = currentTokens
        end
        
        -- Update bucket
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', refillTime)
        redis.call('EXPIRE', key, 3600)
        
        return {allowed and 1 or 0, remaining}
      `;

            const result = await this.redis.eval(
                script,
                1,
                key,
                tokens,
                bucketSize,
                refillRate,
                refillPeriod,
                now,
                refillTime
            ) as [number, number];

            const allowed = result[0] === 1;
            const remaining = result[1];

            let retryAfter: number | undefined;

            if (!allowed) {
                retryAfter = Math.ceil((tokens - remaining) / refillRate * refillPeriod);
                logger.warn('Token bucket rate limit exceeded', {
                    identifier,
                    tokens,
                    remaining,
                    bucketSize,
                    refillRate,
                });
            }

            return {
                allowed,
                remaining,
                retryAfter,
            };
        } catch (error: any) {
            logger.error('Token bucket rate limiter error', { error: error.message, identifier });
            // Fail open
            return {
                allowed: true,
                remaining: bucketSize,
            };
        }
    }
}

/**
 * Sliding window rate limiter
 */
export class SlidingWindowRateLimiter {
    private redis: RedisClientType;

    constructor(redis: RedisClientType) {
        this.redis = redis;
    }

    /**
     * Check if request is allowed using sliding window
     */
    async checkLimit(
        identifier: string,
        windowMs: number,
        maxRequests: number
    ): Promise<RateLimitResult> {
        const key = `sliding_window:${identifier}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        try {
            const script = `
        local key = KEYS[1]
        local windowStart = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])
        local maxRequests = tonumber(ARGV[3])
        
        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
        
        -- Count current requests
        local currentRequests = redis.call('ZCARD', key)
        
        -- Check if allowed
        local allowed = currentRequests < maxRequests
        
        if allowed then
          -- Add current request
          redis.call('ZADD', key, now, now)
          redis.call('EXPIRE', key, math.ceil(${windowMs} / 1000))
        end
        
        -- Get oldest request for retry-after calculation
        local oldestRequest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retryAfter = 0
        
        if #oldestRequest > 0 then
          retryAfter = math.ceil((tonumber(oldestRequest[2]) + ${windowMs} - now) / 1000)
        end
        
        return {allowed and 1 or 0, currentRequests, retryAfter}
      `;

            const result = await this.redis.eval(
                script,
                1,
                key,
                windowStart,
                now,
                maxRequests
            ) as [number, number, number];

            const allowed = result[0] === 1;
            const currentRequests = result[1];
            const retryAfter = result[2];

            return {
                allowed,
                limit: maxRequests,
                remaining: Math.max(0, maxRequests - currentRequests),
                reset: new Date(now + windowMs),
                retryAfter: allowed ? undefined : retryAfter,
            };
        } catch (error: any) {
            logger.error('Sliding window rate limiter error', { error: error.message, identifier });
            // Fail open
            return {
                allowed: true,
                limit: maxRequests,
                remaining: maxRequests,
                reset: new Date(now + windowMs),
            };
        }
    }
}

/**
 * Rate limiter middleware factory
 */
export const createRateLimiter = (redis: RedisClientType, config: RateLimitConfig) => {
    return new RateLimiter(redis, config);
};

/**
 * Pre-configured rate limiters
 */
export const createRateLimiters = (redis: RedisClientType) => ({
    // General API rate limiting
    general: createRateLimiter(redis, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
    }),

    // Authentication endpoints
    auth: createRateLimiter(redis, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
    }),

    // Password reset
    passwordReset: createRateLimiter(redis, {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
    }),

    // Email verification
    emailVerification: createRateLimiter(redis, {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,
    }),

    // File upload
    fileUpload: createRateLimiter(redis, {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
    }),

    // Premium users
    premium: createRateLimiter(redis, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 500,
    }),

    // Admin users
    admin: createRateLimiter(redis, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
    }),
});

/**
 * Distributed rate limiter with Redis Cluster support
 */
export class DistributedRateLimiter {
    private rateLimiters: Map<string, RateLimiter>;

    constructor(private redis: RedisClientType) {
        this.rateLimiters = new Map();
    }

    /**
     * Get or create rate limiter for specific type
     */
    getRateLimiter(type: string, config: RateLimitConfig): RateLimiter {
        if (!this.rateLimiters.has(type)) {
            this.rateLimiters.set(type, new RateLimiter(this.redis, config));
        }
        return this.rateLimiters.get(type)!;
    }

    /**
     * Check rate limit for multiple types
     */
    async checkLimits(limits: Array<{
        type: string;
        identifier: string;
        config: RateLimitConfig;
    }>): Promise<Map<string, RateLimitResult>> {
        const results = new Map<string, RateLimitResult>();

        const promises = limits.map(async ({ type, identifier, config }) => {
            const rateLimiter = this.getRateLimiter(type, config);
            const result = await rateLimiter.checkLimit(identifier);
            results.set(`${type}:${identifier}`, result);
        });

        await Promise.all(promises);
        return results;
    }
}

export default {
    RateLimiter,
    TokenBucketRateLimiter,
    SlidingWindowRateLimiter,
    DistributedRateLimiter,
    createRateLimiter,
    createRateLimiters,
};