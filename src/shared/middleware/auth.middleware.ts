import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config'; // Adjust path accordingly
import { AppError, ErrorCode } from '../utils/errors';
import { CacheService } from '../services/cache.service';
import { FirebaseService } from '../services/firebase.service';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthRequest, JwtPayload } from '../../modules/auth/auth.types'; // Adjust paths
import { logger } from '../utils/logger';

const cacheService = new CacheService();
const firebaseService = FirebaseService.getInstance();

if (!config.security.jwtSecret) {
    throw new Error('JWT secret is not configured!');
}

export class AuthMiddleware {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Authenticate user and attach user profile to request
     */
    authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next(new AppError('No token provided', 401, undefined, ErrorCode.TOKEN_INVALID));
            }

            const token = authHeader.substring(7);

            // Check blacklist (token revocation)
            const blacklisted = await cacheService.get(`blacklist:${token}`);
            if (blacklisted) {
                return next(new AppError('Token has been revoked', 401, undefined, ErrorCode.TOKEN_INVALID));
            }

            // Verify token
            let decoded: JwtPayload;
            try {
                decoded = jwt.verify(token, config.security.jwtSecret) as JwtPayload;
            } catch (error) {
                if (error instanceof jwt.TokenExpiredError) {
                    return next(new AppError('Token expired', 401, undefined, ErrorCode.TOKEN_EXPIRED));
                }
                if (error instanceof jwt.JsonWebTokenError) {
                    return next(new AppError('Invalid token', 401, undefined, ErrorCode.TOKEN_INVALID));
                }
                throw error;
            }

            // Check token type
            if (decoded.type !== 'access') {
                return next(new AppError('Invalid token type', 401, undefined, ErrorCode.TOKEN_INVALID));
            }

            // Check logout time if available
            const logoutTimeStr = await cacheService.get(`logout:${decoded.uid}`);
            const logoutTimeNum = logoutTimeStr ? parseInt(logoutTimeStr, 10) : NaN;
            if (!isNaN(logoutTimeNum) && decoded.iat && decoded.iat < logoutTimeNum) {
                return next(new AppError('Token has been revoked', 401, undefined, ErrorCode.TOKEN_INVALID));
            }

            // Fetch user from AuthService (your DB) and Firebase (auth state)
            const [user, firebaseUser] = await Promise.all([
                this.authService.getProfile(decoded.uid),
                firebaseService.getUser(decoded.uid)
            ]);

            if (!user) {
                return next(new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND));
            }

            if (!firebaseUser) {
                return next(new AppError('User not found in Firebase', 404, undefined, ErrorCode.USER_NOT_FOUND));
            }

            // Check account locked
            if (user.lockedUntil && user.lockedUntil > new Date()) {
                return next(new AppError('Account is locked', 423, undefined, ErrorCode.ACCOUNT_LOCKED));
            }

            // Check if Firebase account disabled
            if (firebaseUser.disabled) {
                return next(new AppError('Account has been disabled', 403, undefined, ErrorCode.ACCOUNT_LOCKED));
            }

            // Check email verification if required
            if (!user.emailVerified && config.features.enableEmailVerification) {
                return next(new AppError('Email not verified', 403, undefined, ErrorCode.EMAIL_NOT_VERIFIED));
            }

            // Attach combined user info to request
            req.user = {
                ...user,
                email: firebaseUser.email || user.email,
                displayName: firebaseUser.displayName || user.displayName,
                emailVerified: firebaseUser.emailVerified ?? user.emailVerified,
            };

            logger.debug('User authenticated', { userId: user.uid, email: user.email, path: req.path });
            next();
        } catch (error) {
            logger.error('Authentication error', error);
            next(error instanceof AppError ? error : new AppError('Authentication failed', 401));
        }
    };

    /**
     * Optional authentication — attach user if valid token, else continue silently
     */
    optional = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next();
            }
            const token = authHeader.substring(7);

            let decoded: JwtPayload;
            try {
                decoded = jwt.verify(token, config.security.jwtSecret) as JwtPayload;
            } catch {
                return next(); // invalid token ignored
            }

            if (decoded.type !== 'access') {
                return next();
            }

            const user = await this.authService.getProfile(decoded.uid);
            if (user && (!user.lockedUntil || user.lockedUntil <= new Date())) {
                req.user = user;
            }
            next();
        } catch (error) {
            logger.debug('Optional authentication failed', error);
            next();
        }
    };

    /**
     * Require email verification
     */
    requireEmailVerification = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user?.emailVerified) {
            return next(new AppError('Please verify your email address', 403, undefined, ErrorCode.EMAIL_NOT_VERIFIED));
        }
        next();
    };

    /**
     * Require specific roles (by subscription plan or roles)
     */
    requireRoles = (...roles: string[]) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                return next(new AppError('User not authenticated', 401, undefined, ErrorCode.UNAUTHORIZED));
            }

            // Could check req.user.role or req.user.subscription.plan depending on your system
            const userRoleOrPlan = req.user.role || req.user.subscription?.plan;
            const hasRole = roles.some(role => role === userRoleOrPlan);

            if (!hasRole) {
                return next(new AppError('Insufficient permissions', 403, undefined, ErrorCode.INSUFFICIENT_PERMISSIONS));
            }
            next();
        };
    };

    /**
     * Require premium or enterprise subscription
     */
    requirePremium = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401, undefined, ErrorCode.UNAUTHORIZED));
        }

        const plan = req.user.subscription?.plan;
        const isPremium = plan === 'premium' || plan === 'enterprise';

        if (!isPremium) {
            return next(new AppError('Premium subscription required', 403, undefined, ErrorCode.INSUFFICIENT_PERMISSIONS));
        }
        next();
    };

    /**
     * Check if user can access resource
     */
    checkResourceAccess = (resourceUserId: string) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                return next(new AppError('User not authenticated', 401, undefined, ErrorCode.UNAUTHORIZED));
            }

            // Owner can access
            if (req.user.uid === resourceUserId) {
                return next();
            }

            // Enterprise (admin) users can access anything
            if (req.user.subscription?.plan === 'enterprise') {
                return next();
            }

            // TODO: Add collaborator logic here if applicable

            return next(new AppError('Access denied to this resource', 403, undefined, ErrorCode.RESOURCE_ACCESS_DENIED));
        };
    };

    /**
     * Verify API key (service-to-service)
     */
    verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
        try {
            const apiKey = req.headers['x-api-key'] as string;
            if (!apiKey) {
                return next(new AppError('API key required', 401, undefined, ErrorCode.UNAUTHORIZED));
            }

            if (apiKey !== config.security.apiKeySecret) {
                return next(new AppError('Invalid API key', 401, undefined, ErrorCode.UNAUTHORIZED));
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    /**
     * Rate limit by user ID (windowMs in ms, max number of requests)
     */
    rateLimitByUser = (windowMs: number, max: number) => {
        return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
            if (!req.user) {
                return next();
            }

            const key = `rate_limit:user:${req.user.uid}:${Math.floor(Date.now() / windowMs)}`;
            const current = await cacheService.increment(key);

            if (current === 1) {
                await cacheService.expire(key, Math.ceil(windowMs / 1000));
            }

            if (current > max) {
                return next(new AppError('Too many requests', 429));
            }
            next();
        };
    };

    /**
     * Log user activity for auditing
     */
    logActivity = (action: string, metadata?: any) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            if (req.user) {
                logger.info(action, req.user.uid, req.originalUrl, {
                    method: req.method,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...metadata,
                    domain: 'audit',
                });
            }
            next();
        };
    };
}

export const authMiddleware = new AuthMiddleware();
