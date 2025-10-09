import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Enhanced CORS middleware with additional security features
 */
export class CorsMiddleware {
    private allowedOrigins: string[];
    private allowedOriginsPatterns: RegExp[];

    constructor() {
        this.allowedOrigins = Array.isArray(config.cors.origin)
            ? config.cors.origin
            : [config.cors.origin];

        // Convert wildcard origins to regex patterns
        this.allowedOriginsPatterns = this.allowedOrigins
            .filter(origin => origin.includes('*'))
            .map(origin => new RegExp(origin.replace(/\*/g, '.*')));
    }

    /**
     * Main CORS middleware
     */
    cors = cors({
        origin: this.validateOrigin.bind(this),
        credentials: config.cors.credentials,
        methods: this.getAllowedMethods(),
        allowedHeaders: this.getAllowedHeaders(),
        exposedHeaders: this.getExposedHeaders(),
        maxAge: this.getMaxAge(),
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    /**
     * Validate origin against allowed origins
     */
    private validateOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }

        // Check exact match
        if (this.allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Check pattern match
        if (this.allowedOriginsPatterns.some(pattern => pattern.test(origin))) {
            return callback(null, true);
        }

        // Check if it's a development environment
        if (config.app.env === 'development' && this.isDevelopmentOrigin(origin)) {
            logger.debug('Allowing development origin:', origin);
            return callback(null, true);
        }

        // Block the request
        logger.warn('Blocked CORS request from unauthorized origin:', {
            origin,
            allowedOrigins: this.allowedOrigins,
            ip: this.getClientIp(arguments[2] as any),
        });

        callback(new Error('Not allowed by CORS'));
    }

    /**
     * Dynamic CORS middleware for different routes
     */
    dynamicCors = (options: {
        origins?: string[];
        methods?: string[];
        allowCredentials?: boolean;
    } = {}) => {
        return cors({
            origin: (origin, callback) => {
                const allowedOrigins = options.origins || this.allowedOrigins;

                if (!origin) return callback(null, true);
                if (allowedOrigins.includes(origin)) return callback(null, true);

                callback(new Error('Not allowed by CORS'));
            },
            methods: options.methods || this.getAllowedMethods(),
            credentials: options.allowCredentials ?? config.cors.credentials,
            allowedHeaders: this.getAllowedHeaders(),
            exposedHeaders: this.getExposedHeaders(),
            maxAge: this.getMaxAge(),
        });
    };

    /**
     * API-specific CORS middleware
     */
    apiCors = this.dynamicCors({
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowCredentials: false, // API endpoints typically don't need credentials
    });

    /**
     * Admin-specific CORS middleware with stricter rules
     */
    adminCors = this.dynamicCors({
        origins: config.app.env === 'production'
            ? ['https://admin.aiplanner.com']
            : ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowCredentials: true,
    });

    /**
     * Public CORS middleware for public endpoints
     */
    publicCors = this.dynamicCors({
        origins: ['*'],
        methods: ['GET', 'OPTIONS'],
        allowCredentials: false,
    });

    /**
     * WebSocket CORS middleware
     */
    websocketCors = {
        origin: this.validateWebSocketOrigin.bind(this),
        credentials: config.cors.credentials,
    };

    /**
     * Handle preflight requests
     */
    handlePreflight = (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'OPTIONS') {
            logger.debug('Handling preflight request', {
                origin: req.headers.origin,
                method: req.headers['access-control-request-method'],
                headers: req.headers['access-control-request-headers'],
            });
        }
        next();
    };

    /**
     * CORS error handler
     */
    handleCorsError = (error: Error, req: Request, res: Response, next: NextFunction) => {
        if (error.message === 'Not allowed by CORS') {
            logger.warn('CORS error', {
                origin: req.headers.origin,
                ip: this.getClientIp(req),
                url: req.originalUrl,
                method: req.method,
            });

            return res.status(403).json({
                success: false,
                error: {
                    code: 'CORS_ERROR',
                    message: 'Cross-origin request not allowed',
                },
            });
        }
        next(error);
    };

    /**
     * Validate WebSocket origin
     */
    private validateWebSocketOrigin(origin: string): boolean {
        if (!origin) return false;

        // Check exact match
        if (this.allowedOrigins.includes(origin)) {
            return true;
        }

        // Check pattern match
        if (this.allowedOriginsPatterns.some(pattern => pattern.test(origin))) {
            return true;
        }

        return false;
    }

    /**
     * Check if origin is a development origin
     */
    private isDevelopmentOrigin(origin: string): boolean {
        const devPatterns = [
            /^http:\/\/localhost:/,
            /^http:\/\/127\.0\.0\.1:/,
            /^http:\/\/192\.168\./,
            /^http:\/\/10\./,
        ];

        return devPatterns.some(pattern => pattern.test(origin));
    }

    /**
     * Get client IP from request
     */
    private getClientIp(req: Request): string {
        return (
            req.ip ||
            (req.connection as any)?.remoteAddress ||
            (req.socket as any)?.remoteAddress ||
            'unknown'
        );
    }

    /**
     * Get allowed HTTP methods
     */
    private getAllowedMethods(): string[] {
        return [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
            'HEAD',
        ];
    }

    /**
     * Get allowed headers
     */
    private getAllowedHeaders(): string[] {
        return [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'Accept-Language',
            'Content-Language',
            'Authorization',
            'X-API-Key',
            'X-Request-ID',
            'X-Correlation-ID',
            'Access-Control-Request-Headers',
            'Access-Control-Request-Method',
        ];
    }

    /**
     * Get exposed headers
     */
    private getExposedHeaders(): string[] {
        return [
            'X-Total-Count',
            'X-Page',
            'X-Limit',
            'X-Request-ID',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset',
        ];
    }

    /**
     * Get max age for preflight cache
     */
    private getMaxAge(): number {
        return 86400; // 24 hours
    }

    /**
     * Security-focused CORS middleware
     */
    strictCors = cors({
        origin: (origin, callback) => {
            // Only allow specific origins in production
            if (config.app.env === 'production') {
                const allowedOrigins = [
                    'https://aiplanner.com',
                    'https://www.aiplanner.com',
                    'https://app.aiplanner.com',
                ];

                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            } else {
                // Allow more origins in development
                callback(null, true);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Request-ID',
        ],
        maxAge: 3600, // 1 hour
    });
}

export const corsMiddleware = new CorsMiddleware();