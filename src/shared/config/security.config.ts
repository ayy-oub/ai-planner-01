import crypto from 'crypto';
import { config } from './index';

export interface SecurityConfig {
    jwt: {
        secret: string;
        accessExpire: string;
        refreshExpire: string;
        resetPasswordExpire: string;
        emailVerifyExpire: string;
        issuer: string;
        audience: string;
    };
    bcrypt: {
        rounds: number;
    };
    cors: {
        origin: string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
        exposedHeaders: string[];
        maxAge: number;
    };
    helmet: {
        contentSecurityPolicy: boolean;
        crossOriginEmbedderPolicy: boolean;
        dnsPrefetchControl: boolean;
        frameguard: {
            action: string;
        };
        hidePoweredBy: boolean;
        hsts: {
            maxAge: number;
            includeSubDomains: boolean;
            preload: boolean;
        };
        ieNoOpen: boolean;
        noSniff: boolean;
        originAgentCluster: boolean;
        permittedCrossDomainPolicies: boolean;
        referrerPolicy: boolean;
        xssFilter: boolean;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        authWindowMs: number;
        authMaxRequests: number;
        skipSuccessfulRequests: boolean;
        skipFailedRequests: boolean;
    };
    session: {
        secret: string;
        resave: boolean;
        saveUninitialized: boolean;
        cookie: {
            secure: boolean;
            httpOnly: boolean;
            sameSite: string;
            maxAge: number;
        };
    };
    validation: {
        password: {
            minLength: number;
            maxLength: number;
            requireUppercase: boolean;
            requireLowercase: boolean;
            requireNumbers: boolean;
            requireSpecialChars: boolean;
        };
        email: {
            allowedDomains: string[];
            blockedDomains: string[];
        };
    };
    upload: {
        maxFileSize: number;
        allowedFileTypes: string[];
        virusScan: boolean;
    };
}

export const securityConfig: SecurityConfig = {
    jwt: {
        secret: config.security.jwtSecret,
        accessExpire: config.security.jwtAccessExpire,
        refreshExpire: config.security.jwtRefreshExpire,
        resetPasswordExpire: config.security.jwtResetPasswordExpire,
        emailVerifyExpire: config.security.jwtEmailVerifyExpire,
        issuer: 'ai-planner-api',
        audience: 'ai-planner-users',
    },
    bcrypt: {
        rounds: config.security.bcryptRounds,
    },
    cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-API-Key',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ],
        exposedHeaders: [
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ],
        maxAge: 86400, // 24 hours
    },
    helmet: {
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        dnsPrefetchControl: true,
        frameguard: {
            action: 'deny',
        },
        hidePoweredBy: true,
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        },
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: true,
        referrerPolicy: true,
        xssFilter: true,
    },
    rateLimit: {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests,
        authWindowMs: config.rateLimit.authWindowMs,
        authMaxRequests: config.rateLimit.authMaxRequests,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    },
    session: {
        secret: config.security.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: config.app.env === 'production',
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    },
    validation: {
        password: {
            minLength: 8,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
        },
        email: {
            allowedDomains: [],
            blockedDomains: ['tempmail.com', '10minutemail.com', 'guerrillamail.com'],
        },
    },
    upload: {
        maxFileSize: config.upload.maxFileSize,
        allowedFileTypes: config.upload.allowedFileTypes,
        virusScan: true,
    },
};

// Utility functions
export const generateSecureToken = (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
};

export const generateApiKey = (): string => {
    const prefix = 'ak_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomBytes}`;
};

export const hashApiKey = (apiKey: string): string => {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

export const sanitizeInput = (input: string): string => {
    return input
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
};

export default securityConfig;