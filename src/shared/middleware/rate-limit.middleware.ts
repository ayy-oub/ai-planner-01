import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { AppError, RateLimitError } from '../utils/errors';
import { CacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

const cacheService = new CacheService();

/**
 * Standard IP-based rate limiter
 */
export const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response, next: NextFunction) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            path: req.path,
            requestId: req.headers['x-request-id'],
        });

        next(new RateLimitError('Too many requests from this IP, please try again later.'));
    },
});

/**
 * Authentication-specific rate limiter (per IP)
 */
export const authRateLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response, next: NextFunction) => {
        logger.warn('Auth rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.body?.email,
            path: req.path,
            requestId: req.headers['x-request-id'],
        });

        next(new RateLimitError('Too many authentication attempts, please try again later.'));
    },
});


/**
 * Create a dynamic rate limiter
 */
export const createRateLimiter = (
    windowMs: number,
    max: number,
    keyPrefix: string = 'rl'
) => {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req: Request, res: Response, next: NextFunction) => {
            next(new RateLimitError('Rate limit exceeded'));
        },
        keyGenerator: (req: Request) => `${keyPrefix}:${req.ip}`,
    });
};

/**
 * Rate limit by user ID using Redis
 */
export const rateLimitByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.uid;
    if (!userId) return next();

    const key = `user_rate_limit:${userId}`;
    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    if (current > 1000) {
        logger.warn('User rate limit exceeded', { userId, path: req.path });
        return next(new RateLimitError('Too many requests'));
    }

    next();
};

/**
 * Rate limit by IP using Redis
 */
export const rateLimitByIp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || 'unknown';
    const key = `ip_rate_limit:${ip}`;

    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    if (current > 100) {
        logger.warn('IP rate limit exceeded', { ip, path: req.path });
        return next(new RateLimitError('Too many requests from this IP'));
    }

    next();
};

/**
 * Rate limit by API Key using Redis
 */
export const rateLimitByApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey || typeof apiKey !== 'string') {
        return next(new AppError('API key required', 401));
    }

    const key = `api_key_rate_limit:${apiKey}`;
    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    const rawLimit = await cacheService.get(`api_key_limit:${apiKey}`);
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 10000;
    const limit = Number.isNaN(parsedLimit) ? 10000 : parsedLimit;

    if (current > limit) {
        logger.warn('API key rate limit exceeded', { apiKey, path: req.path });
        return next(new RateLimitError('API key rate limit exceeded'));
    }

    next();
};

/**
 * Token Bucket–style burst rate limiter using Redis
 */
export const burstRateLimiter = (windowMs: number, max: number, burst: number) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const key = `burst:${req.ip}`;
        const now = Date.now();

        // Fetch current token bucket
        const data = await cacheService.get(key);
        let bucket = data
            ? JSON.parse(data)
            : { tokens: max, lastRefill: now };

        // Refill tokens based on time passed
        const timePassed = now - bucket.lastRefill;
        const refillRate = burst / windowMs; // tokens per ms
        const tokensToAdd = Math.floor(refillRate * timePassed);

        bucket.tokens = Math.min(max, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            await cacheService.set(key, JSON.stringify(bucket), { ttl: Math.ceil(windowMs / 1000) });
            next();
        } else {
            await cacheService.set(key, JSON.stringify(bucket), { ttl: Math.ceil(windowMs / 1000) });
            return next(new RateLimitError('Burst rate limit exceeded'));
        }
    };
};
