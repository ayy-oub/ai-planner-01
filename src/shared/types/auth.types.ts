/**
 * User roles
 */
export enum UserRole {
    USER = 'user',
    PREMIUM = 'premium',
    ENTERPRISE = 'enterprise',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin',
}

/**
 * User subscription status
 */
export enum SubscriptionStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    CANCELLED = 'cancelled',
    PAST_DUE = 'past_due',
    TRIALING = 'trialing',
}

/**
 * User preferences
 */
export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    defaultView: 'grid' | 'list' | 'calendar';
    notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
        marketing: boolean;
    };
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
    compactMode: boolean;
    showCompleted: boolean;
    autoSave: boolean;
    soundEnabled: boolean;
}

/**
 * User subscription
 */
export interface UserSubscription {
    plan: 'free' | 'premium' | 'enterprise';
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart?: Date;
    trialEnd?: Date;
    cancelAtPeriodEnd: boolean;
    paymentMethod?: string;
    subscriptionId?: string;
    priceId?: string;
    features: string[];
    limits: {
        planners: number;
        collaborators: number;
        storage: number; // in MB
        aiRequests: number;
    };
}

/**
 * User statistics
 */
export interface UserStatistics {
    totalPlanners: number;
    totalTasks: number;
    completedTasks: number;
    streakDays: number;
    longestStreak: number;
    lastActivity: Date;
    accountAge: number; // in days
    loginCount: number;
    totalTimeSpent: number; // in minutes
    productivityScore: number; // 0-100
}

/**
 * User security
 */
export interface UserSecurity {
    failedLoginAttempts: number;
    lockedUntil?: Date;
    passwordChangedAt: Date;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    backupCodes: string[];
    trustedDevices: Array<{
        id: string;
        name: string;
        lastUsed: Date;
        createdAt: Date;
    }>;
    recentActivity: Array<{
        action: string;
        timestamp: Date;
        ip?: string;
        userAgent?: string;
        location?: string;
    }>;
}

/**
 * User profile
 */
export interface UserProfile {
    displayName: string;
    bio?: string;
    avatar?: string;
    coverImage?: string;
    location?: string;
    website?: string;
    socialLinks: {
        twitter?: string;
        linkedin?: string;
        github?: string;
        instagram?: string;
    };
    pronouns?: string;
    birthday?: Date;
    timezone: string;
    language: string;
}

/**
 * Base user interface
 */
export interface User {
    uid: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    profile: UserProfile;
    preferences: UserPreferences;
    subscription: UserSubscription;
    statistics: UserStatistics;
    security: UserSecurity;
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date;
    deletedAt?: Date;
    isActive: boolean;
    isDeleted: boolean;
}

/**
 * User creation data
 */
export interface UserCreateData {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    preferences?: Partial<UserPreferences>;
}

/**
 * User update data
 */
export interface UserUpdateData {
    email?: string;
    displayName?: string;
    bio?: string;
    avatar?: string;
    coverImage?: string;
    location?: string;
    website?: string;
    pronouns?: string;
    birthday?: Date;
    timezone?: string;
    language?: string;
    preferences?: Partial<UserPreferences>;
    socialLinks?: Partial<UserProfile['socialLinks']>;
}

/**
 * User authentication data
 */
export interface UserAuthData {
    uid: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    subscriptionStatus: SubscriptionStatus;
    twoFactorEnabled: boolean;
}

/**
 * User session
 */
export interface UserSession {
    sessionId: string;
    userId: string;
    token: string;
    refreshToken: string;
    deviceInfo: {
        userAgent: string;
        ip?: string;
        location?: string;
    };
    expiresAt: Date;
    createdAt: Date;
    lastAccessed: Date;
    isActive: boolean;
}

/**
 * User activity
 */
export interface UserActivity {
    id: string;
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    location?: string;
}

/**
 * User notification preferences
 */
export interface UserNotificationPreferences {
    email: {
        plannerUpdates: boolean;
        taskReminders: boolean;
        marketing: boolean;
        weeklyDigest: boolean;
        aiInsights: boolean;
    };
    push: {
        plannerUpdates: boolean;
        taskReminders: boolean;
        dailySummary: boolean;
    };
    sms: {
        taskReminders: boolean;
        urgentAlerts: boolean;
    };
    quietHours: {
        enabled: boolean;
        start: string; // HH:MM format
        end: string; // HH:MM format
        timezone: string;
    };
}

/**
 * User export data
 */
export interface UserExportData {
    user: User;
    planners: any[];
    activities: any[];
    sessions: UserSession[];
    activityLog: UserActivity[];
}

/**
 * JWT payload
 */
export interface JwtPayload {
    uid: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    subscriptionStatus: SubscriptionStatus;
    iat: number;
    exp: number;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
    uid: string;
    sessionId: string;
    iat: number;
    exp: number;
}

/**
 * Email verification token payload
 */
export interface EmailVerificationPayload {
    uid: string;
    email: string;
    iat: number;
    exp: number;
}

/**
 * Password reset token payload
 */
export interface PasswordResetPayload {
    uid: string;
    email: string;
    iat: number;
    exp: number;
}

/**
 * Two-factor authentication payload
 */
export interface TwoFactorPayload {
    uid: string;
    method: 'authenticator' | 'sms' | 'email';
    iat: number;
    exp: number;
}

/**
 * Login attempt
 */
export interface LoginAttempt {
    id: string;
    email: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    location?: string;
    timestamp: Date;
    failureReason?: string;
}

/**
 * Password history
 */
export interface PasswordHistory {
    userId: string;
    passwordHash: string;
    createdAt: Date;
}

/**
 * API key
 */
export interface ApiKey {
    id: string;
    userId: string;
    name: string;
    key: string; // Hashed
    permissions: string[];
    lastUsed?: Date;
    createdAt: Date;
    expiresAt?: Date;
    isActive: boolean;
}

/**
 * Audit log
 */
export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    changes: any;
    metadata?: Record<string, any>;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

/**
 * User search filters
 */
export interface UserSearchFilters {
    role?: UserRole[];
    subscriptionStatus?: SubscriptionStatus[];
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
    isActive?: boolean;
    createdAfter?: Date;
    createdBefore?: Date;
    lastLoginAfter?: Date;
    lastLoginBefore?: Date;
    searchQuery?: string; // Search in email, displayName, bio
}

/**
 * User sort options
 */
export type UserSortField =
    | 'email'
    | 'displayName'
    | 'role'
    | 'subscriptionStatus'
    | 'createdAt'
    | 'updatedAt'
    | 'lastLogin'
    | 'statistics.totalPlanners'
    | 'statistics.productivityScore';

export interface UserSortOptions {
    field: UserSortField;
    order: 'asc' | 'desc';
}