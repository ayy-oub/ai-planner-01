import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@shared/config';
import { AppError } from '@shared/utils/errors';
import { CacheService } from '@shared/services/cache.service';
import { FirebaseService } from '@shared/services/firebase.service';
import { AuthRequest, JWTPayload } from '@shared/types/auth.types';
import { Logger } from '@shared/utils/logger';

const cacheService = new CacheService();
const firebaseService = new FirebaseService();

export class AuthMiddleware {
    /**
     * Authenticate user and attach to request
     */
    static authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next(new AppError('No token provided', 401));
            }

            const token = authHeader.substring(7);

            // Check if token is blacklisted
            const isBlacklisted = await cacheService.get(`blacklist:${token}`);
            if (isBlacklisted) {
                return next(new AppError('Token has been revoked', 401));
            }

            // Verify token
            let decoded: JWTPayload;
            try {
                decoded = jwt.verify(token, config.security.jwtSecret) as JWTPayload;
            } catch (error) {
                if (error instanceof jwt.TokenExpiredError) {
                    return next(new AppError('Token has expired', 401));
                }
                if (error instanceof jwt.JsonWebTokenError) {
                    return next(new AppError('Invalid token', 401));
                }
                throw error;
            }

            // Check token type
            if (decoded.type !== 'access') {
                return next(new AppError('Invalid token type', 401));
            }

            // Check if user logged out
            const logoutTime = await cacheService.get(`logout:${decoded.uid}`);
            if (logoutTime && decoded.iat && decoded.iat < parseInt(logoutTime)) {
                return next(new AppError('Token has been revoked', 401));
            }

            // Get user from Firebase
            let firebaseUser;
            try {
                firebaseUser = await firebaseService.getUser(decoded.uid);
            } catch (error) {
                return next(new AppError('User not found', 404));
            }

            // Check if user is disabled
            if (firebaseUser.disabled) {
                return next(new AppError('Account has been disabled', 403));
            }

            // Attach user to request
            req.user = {
                uid: decoded.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                emailVerified: firebaseUser.emailVerified || false,
            };

            // Log authentication success
            Logger.debug('User authenticated', { userId: decoded.uid, path: req.path });

            next();
        } catch (error) {
            Logger.error('Authentication error', error);
            next(new AppError('Authentication failed', 401));
        }
    };

    /**
     * Optional authentication - continues without user if token is invalid
     */
    static optional = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next();
            }

            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, config.security.jwtSecret) as JWTPayload;

                if (decoded.type === 'access') {
                    const firebaseUser = await firebaseService.getUser(decoded.uid);

                    if (!firebaseUser.disabled) {
                        req.user = {
                            uid: decoded.uid,
                            email: firebaseUser.email || '',
                            displayName: firebaseUser.displayName || '',
                            emailVerified: firebaseUser.emailVerified || false,
                        };
                    }
                }
            } catch (error) {
                // Ignore authentication errors for optional auth
                Logger.debug('Optional authentication failed', { error: error.message });
            }

            next();
        } catch (error) {
            Logger.error('Optional authentication error', error);
            next();
        }
    };

    /**
     * Require email verification
     */
    static requireEmailVerification = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user?.emailVerified) {
            return next(new AppError('Please verify your email address', 403));
        }
        next();
    };

    /**
     * Check specific permissions
     */
    static requirePermission = (permission: string) => {
        return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
            try {
                if (!req.user) {
                    return next(new AppError('Authentication required', 401));
                }

                const hasPermission = await firebaseService.checkUserPermission(
                    req.user.uid,
                    permission
                );

                if (!hasPermission) {
                    return next(new AppError('Insufficient permissions', 403));
                }

                next();
            } catch (error) {
                Logger.error('Permission check error', error);
                next(new AppError('Permission check failed', 500));
            }
        };
    };

    /**
     * Rate limiting by user ID
     */
    static rateLimitByUser = (windowMs: number, max: number) => {
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
}

export const authenticate = AuthMiddleware.authenticate;
export const optionalAuth = AuthMiddleware.optional;
export const requireEmailVerification = AuthMiddleware.requireEmailVerification;
export const requirePermission = AuthMiddleware.requirePermission;
export const rateLimitByUser = AuthMiddleware.rateLimitByUser;