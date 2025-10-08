import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '@shared/config';
import { AppError, TooManyRequestsError } from '@shared/utils/errors';
import { CacheService } from '@shared/services/cache.service';
import { Logger } from '@shared/utils/logger';

const cacheService = new CacheService();

export const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response, next: NextFunction) => {
        next(new TooManyRequestsError('Too many requests from this IP'));
    },
    onLimitReached: (req: Request) => {
        Logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
        });
    },
});

export const authRateLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMaxRequests,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response, next: NextFunction) => {
        next(new TooManyRequestsError('Too many authentication attempts'));
    },
    onLimitReached: (req: Request) => {
        Logger.warn('Auth rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.body.email,
        });
    },
});

export const createRateLimiter = (windowMs: number, max: number, keyPrefix: string = 'rl') => {
    return rateLimit({
        windowMs,
        max,
        message: 'Rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req: Request, res: Response, next: NextFunction) => {
            next(new TooManyRequestsError('Rate limit exceeded'));
        },
        keyGenerator: (req: Request) => {
            return `${keyPrefix}:${req.ip}`;
        },
    });
};

export const rateLimitByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.uid;
    if (!userId) {
        return next();
    }

    const key = `user_rate_limit:${userId}`;
    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    if (current > 1000) { // 1000 requests per hour per user
        Logger.warn('User rate limit exceeded', { userId, path: req.path });
        return next(new TooManyRequestsError('Too many requests'));
    }

    next();
};

export const rateLimitByIp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || 'unknown';
    const key = `ip_rate_limit:${ip}`;

    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    if (current > 100) { // 100 requests per hour per IP
        Logger.warn('IP rate limit exceeded', { ip, path: req.path });
        return next(new TooManyRequestsError('Too many requests from this IP'));
    }

    next();
};

export const rateLimitByApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
        return next(new AppError('API key required', 401));
    }

    const key = `api_key_rate_limit:${apiKey}`;
    const current = await cacheService.increment(key);

    if (current === 1) {
        await cacheService.expire(key, 3600); // 1 hour
    }

    // Different limits based on API key tier (default: 10000 per hour)
    const limit = await cacheService.get(`api_key_limit:${apiKey}`) || 10000;

    if (current > limit) {
        Logger.warn('API key rate limit exceeded', { apiKey, path: req.path });
        return next(new TooManyRequestsError('API key rate limit exceeded'));
    }

    next();
};

export const burstRateLimiter = (windowMs: number, max: number, burst: number) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const key = `burst:${req.ip}`;
        const now = Date.now();

        // Get current bucket state
        const bucketData = await cacheService.get(key);
        let bucket = bucketData ? JSON.parse(bucketData) : { tokens: max, lastRefill: now };

        // Refill tokens
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(timePassed / windowMs) * burst;
        bucket.tokens = Math.min(max, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        // Check if request can be processed
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            await cacheService.set(key, JSON.stringify(bucket), Math.ceil(windowMs / 1000));
            next();
        } else {
            await cacheService.set(key, JSON.stringify(bucket), Math.ceil(windowMs / 1000));
            next(new TooManyRequestsError('Burst rate limit exceeded'));
        }
    };
};