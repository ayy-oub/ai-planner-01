import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@shared/config';
import { AppError, ErrorCodes } from '@shared/utils/errors';
import { AuthRequest, JWTPayload, User } from './auth.types';
import { AuthService } from './auth.service';
import { logger } from '@shared/utils/logger';

export class AuthMiddleware {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Authenticate user with JWT token
     */
    authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError('No token provided', 401, undefined, ErrorCodes.TOKEN_INVALID);
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix

            // Verify token
            const decoded = jwt.verify(token, config.security.jwtSecret) as JWTPayload;

            // Check token type
            if (decoded.type !== 'access') {
                throw new AppError('Invalid token type', 401, undefined, ErrorCodes.TOKEN_INVALID);
            }

            // Check if user exists
            const user = await this.authService.getProfile(decoded.uid);
            if (!user) {
                throw new AppError('User not found', 404, undefined, ErrorCodes.USER_NOT_FOUND);
            }

            // Check if account is locked
            if (user.lockedUntil && user.lockedUntil > new Date()) {
                throw new AppError('Account is locked', 423, undefined, ErrorCodes.ACCOUNT_LOCKED);
            }

            // Check if email is verified (if required)
            if (!user.emailVerified && config.features.enableEmailVerification) {
                throw new AppError('Email not verified', 403, undefined, ErrorCodes.EMAIL_NOT_VERIFIED);
            }

            // Add user to request
            req.user = user;

            // Log successful authentication
            logger.debug('User authenticated', { userId: user.uid, email: user.email });

            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                next(new AppError('Token expired', 401, undefined, ErrorCodes.TOKEN_EXPIRED));
            } else if (error instanceof jwt.JsonWebTokenError) {
                next(new AppError('Invalid token', 401, undefined, ErrorCodes.TOKEN_INVALID));
            } else {
                next(error);
            }
        }
    };

    /**
     * Require specific roles
     */
    requireRoles = (...roles: string[]) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                throw new AppError('User not authenticated', 401, undefined, ErrorCodes.UNAUTHORIZED);
            }

            // Check if user has required role
            const userRole = req.user.subscription.plan;
            const hasRole = roles.some(role => role === userRole);

            if (!hasRole) {
                throw new AppError('Insufficient permissions', 403, undefined, ErrorCodes.INSUFFICIENT_PERMISSIONS);
            }

            next();
        };
    };

    /**
     * Require premium subscription
     */
    requirePremium = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            throw new AppError('User not authenticated', 401, undefined, ErrorCodes.UNAUTHORIZED);
        }

        const isPremium = req.user.subscription.plan === 'premium' || req.user.subscription.plan === 'enterprise';

        if (!isPremium) {
            throw new AppError('Premium subscription required', 403, undefined, ErrorCodes.INSUFFICIENT_PERMISSIONS);
        }

        next();
    };

    /**
     * Optional authentication - doesn't fail if no token provided
     */
    optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next(); // Continue without authentication
            }

            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, config.security.jwtSecret) as JWTPayload;

            if (decoded.type !== 'access') {
                return next(); // Continue without authentication
            }

            const user = await this.authService.getProfile(decoded.uid);
            if (user && (!user.lockedUntil || user.lockedUntil <= new Date())) {
                req.user = user;
            }

            next();
        } catch (error) {
            // Don't fail the request, just continue without authentication
            next();
        }
    };

    /**
     * Check if user can perform action on resource
     */
    checkResourceAccess = (resourceUserId: string) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                throw new AppError('User not authenticated', 401, undefined, ErrorCodes.UNAUTHORIZED);
            }

            // Users can access their own resources
            if (req.user.uid === resourceUserId) {
                return next();
            }

            // Admin users can access any resource
            if (req.user.subscription.plan === 'enterprise') {
                return next();
            }

            // Check if user is collaborator (would need to be implemented based on your logic)
            // This is a placeholder - implement based on your collaboration system

            throw new AppError('Access denied to this resource', 403, undefined, ErrorCodes.RESOURCE_ACCESS_DENIED);
        };
    };

    /**
     * Verify API key for service-to-service communication
     */
    verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
        try {
            const apiKey = req.headers['x-api-key'] as string;

            if (!apiKey) {
                throw new AppError('API key required', 401, undefined, ErrorCodes.UNAUTHORIZED);
            }

            // Simple API key verification (implement your own logic)
            if (apiKey !== config.security.apiKeySecret) {
                throw new AppError('Invalid API key', 401, undefined, ErrorCodes.UNAUTHORIZED);
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    /**
     * Rate limiting by user ID
     */
    rateLimitByUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            return next();
        }

        try {
            // Implement rate limiting logic based on user ID
            // This would typically use Redis or similar
            const userId = req.user.uid;
            const key = `rate_limit:user:${userId}`;

            // Placeholder for rate limiting implementation
            logger.debug(`Rate limit check for user: ${userId}`);

            next();
        } catch (error) {
            next(error);
        }
    };

    /**
     * Log user activity
     */
    logActivity = (action: string, metadata?: any) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (req.user) {
                logger.audit(action, req.user.uid, req.originalUrl, {
                    method: req.method,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...metadata,
                });
            }
            next();
        };
    };
}

export const authMiddleware = new AuthMiddleware();