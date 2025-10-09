import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import slowDown from 'express-slow-down';
import { config } from '../config';
import { CacheService } from '../services/cache.service';
import { AppError, RateLimitError } from '../utils/errors';
import { logger } from '../utils/logger';

const cacheService = new CacheService();

// Rate limiter instances
const rateLimiter = new RateLimiterRedis({
    storeClient: cacheService.getClient(),
    keyPrefix: 'rl:',
    points: config.rateLimit.maxRequests,
    duration: Math.floor(config.rateLimit.windowMs / 1000),
    blockDuration: 60 * 5, // 5 minutes block
});

const authRateLimiter = new RateLimiterRedis({
    storeClient: cacheService.getClient(),
    keyPrefix: 'arl:',
    points: config.rateLimit.authMaxRequests,
    duration: Math.floor(config.rateLimit.authWindowMs / 1000),
    blockDuration: 60 * 15, // 15 minutes block
});

// API Key rate limiter
const apiKeyRateLimiter = new RateLimiterRedis({
    storeClient: cacheService.getClient(),
    keyPrefix: 'krl:',
    points: 1000, // 1000 requests per hour for API keys
    duration: 60 * 60,
});

export class SecurityMiddleware {
    /**
     * General rate limiting middleware
     */
    static rateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const key = req.ip || 'unknown';
            await rateLimiter.consume(key);
            next();
        } catch (rateLimiterRes: any) {
            const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
            res.set('Retry-After', String(secs));
            next(new RateLimitError(`Too many requests, please try again in ${secs} seconds`));
        }
    };

    /**
     * Authentication rate limiting middleware
     */
    static authRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const key = req.ip || 'unknown';
            await authRateLimiter.consume(key);
            next();
        } catch (rateLimiterRes: any) {
            const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
            res.set('Retry-After', String(secs));
            next(new RateLimitError(`Too many authentication attempts, please try again in ${secs} seconds`));
        }
    };

    /**
     * API Key rate limiting middleware
     */
    static apiKeyRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const apiKey = req.headers['x-api-key'] as string;
            if (!apiKey) {
                return next(new AppError('API key required', 401));
            }

            await apiKeyRateLimiter.consume(apiKey);
            next();
        } catch (rateLimiterRes: any) {
            const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
            res.set('Retry-After', String(secs));
            next(new RateLimitError(`API key rate limit exceeded, please try again in ${secs} seconds`));
        }
    };

    /**
     * Slow down responses for repeated requests
     */
    static speedLimiter = slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 10, // Allow 10 requests per 15 minutes, then...
        delayMs: 500, // Add 500ms delay per request
        maxDelayMs: 20000, // Maximum delay of 20 seconds
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
    });

    /**
     * Block known malicious IPs
     */
    static blockMaliciousIPs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const maliciousIPs = await cacheService.get('malicious_ips');
        if (maliciousIPs && maliciousIPs.includes(req.ip)) {
            logger.warn('Blocked request from malicious IP', { ip: req.ip });
            return next(new AppError('Access denied', 403));
        }
        next();
    };

    /**
     * Validate API key
     */
    static validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
            return next(new AppError('API key required', 401));
        }

        // Validate API key format
        if (!/^[a-zA-Z0-9]{32,64}$/.test(apiKey)) {
            return next(new AppError('Invalid API key format', 401));
        }

        // Check if API key exists and is active
        const isValid = await cacheService.get(`api_key:${apiKey}`);
        if (!isValid) {
            return next(new AppError('Invalid API key', 401));
        }

        // Attach API key info to request
        req.apiKey = {
            key: apiKey,
            permissions: JSON.parse(isValid),
        };

        next();
    };

    /**
     * Request signature validation
     */
    static validateSignature = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const signature = req.headers['x-request-signature'] as string;
        const timestamp = req.headers['x-request-timestamp'] as string;

        if (!signature || !timestamp) {
            return next(new AppError('Missing request signature', 401));
        }

        // Check timestamp to prevent replay attacks (5 minute window)
        const requestTime = parseInt(timestamp);
        const now = Date.now();
        if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
            return next(new AppError('Request timestamp too old', 401));
        }

        // Validate signature (implementation depends on your signing algorithm)
        const isValid = await this.verifyRequestSignature(req, signature, timestamp);
        if (!isValid) {
            return next(new AppError('Invalid request signature', 401));
        }

        next();
    };

    private static async verifyRequestSignature(req: Request, signature: string, timestamp: string): Promise<boolean> {
        // Implement your signature verification logic here
        // This is a placeholder implementation
        try {
            const expectedSignature = this.generateSignature(req, timestamp);
            return signature === expectedSignature;
        } catch (error) {
            logger.error('Signature verification failed', error);
            return false;
        }
    }

    private static generateSignature(req: Request, timestamp: string): string {
        // Implement your signature generation logic here
        // This should match the client's signing algorithm
        const crypto = require('crypto');
        const payload = `${req.method}:${req.originalUrl}:${timestamp}:${JSON.stringify(req.body)}`;
        return crypto
            .createHmac('sha256', config.security.apiKeySecret)
            .update(payload)
            .digest('hex');
    }
}

export const securityMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Apply basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
};

export const speedLimiter = SecurityMiddleware.speedLimiter;
export const blockMaliciousIPs = SecurityMiddleware.blockMaliciousIPs;
export const validateApiKey = SecurityMiddleware.validateApiKey;
export const validateSignature = SecurityMiddleware.validateSignature;