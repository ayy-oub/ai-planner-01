export interface User {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    emailVerified: boolean;
    password?: string;
    passwordChangedAt?: Date;
    preferences: UserPreferences;
    subscription: UserSubscription;
    statistics: UserStatistics;
    security: UserSecurity;
    lockedUntil?: Date;
    failedLoginAttempts: number;
    lastLogin?: Date;
    emailVerifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    defaultView: 'daily' | 'weekly' | 'monthly';
    notifications: boolean;
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
}

export interface UserSubscription {
    plan: 'free' | 'premium' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled' | 'expired';
    expiresAt?: Date;
    startedAt?: Date;
    cancelledAt?: Date;
    features: string[];
    limits: {
        maxPlanners: number;
        maxCollaborators: number;
        maxStorage: number;
        maxAIRequests: number;
    };
}

export interface UserStatistics {
    totalPlanners: number;
    totalTasks: number;
    completedTasks: number;
    streakDays: number;
    longestStreak: number;
    lastActiveDate?: Date;
    totalLoginTime: number;
    aiSuggestionsUsed: number;
}

export interface UserSecurity {
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    backupCodes: string[];
    sessions: UserSession[];
    loginHistory: LoginAttempt[];
}

export interface UserSession {
    id: string;
    userAgent: string;
    ip: string;
    location?: string;
    deviceInfo?: string;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt: Date;
    isActive: boolean;
}

export interface LoginAttempt {
    id: string;
    timestamp: Date;
    success: boolean;
    ip: string;
    userAgent: string;
    location?: string;
    failureReason?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}

export interface LoginDto {
    email: string;
    password: string;
    rememberMe?: boolean;
    deviceInfo?: {
        userAgent: string;
        deviceId?: string;
    };
}

export interface RegisterDto {
    email: string;
    password: string;
    displayName?: string;
    acceptTerms: boolean;
    marketingEmails?: boolean;
    deviceInfo?: {
        userAgent: string;
        deviceId?: string;
    };
}

export interface TokenDto {
    refreshToken: string;
}

export interface ForgotPasswordDto {
    email: string;
    recaptchaToken?: string;
}

export interface ResetPasswordDto {
    token: string;
    newPassword: string;
    confirmPassword: string;
}

export interface UpdateProfileDto {
    displayName?: string;
    photoURL?: string;
    preferences?: Partial<UserPreferences>;
}

export interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface VerifyEmailDto {
    token: string;
}

export interface AuthResponse {
    user: User;
    tokens: AuthTokens;
}

export interface RefreshTokenResponse {
    tokens: AuthTokens;
}

export interface UserProfileResponse {
    user: User;
}

export interface PasswordResetResponse {
    message: string;
}

export interface EmailVerificationResponse {
    message: string;
}

// JWT Payload types
export interface JWTPayload {
    uid: string;
    email: string;
    type: 'access' | 'refresh' | 'reset' | 'verify';
    iat?: number;
    exp?: number;
}

export interface AuthRequest extends Request {
    user?: User;
}

// Validation result types
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}

// Rate limiting types
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

// Session management types
export interface SessionConfig {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    cookie: {
        secure: boolean;
        httpOnly: boolean;
        maxAge: number;
        sameSite: 'strict' | 'lax' | 'none';
    };
}

// Import Request from express
import { Request } from 'express';