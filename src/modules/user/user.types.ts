import { Timestamp } from 'firebase-admin/firestore';

export interface User {
    uid: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    disabled: boolean;
    metadata: {
        createdAt: Timestamp;
        lastLoginAt: Timestamp;
        lastRefreshAt?: Timestamp;
    };
    preferences: UserPreferences;
    subscription: UserSubscription;
    statistics: UserStatistics;
    security: UserSecurity;
    social?: UserSocial;
    settings: UserSettings;
    roles: UserRole[];
    permissions: string[];
    lastActivity: Timestamp;
    updatedAt: Timestamp;
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    defaultView: 'planner' | 'calendar' | 'tasks' | 'dashboard';
    notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
        frequency: 'immediate' | 'daily' | 'weekly';
        categories: {
            taskReminders: boolean;
            deadlineAlerts: boolean;
            productivityInsights: boolean;
            marketing: boolean;
            updates: boolean;
        };
    };
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    weekStartsOn: 'sunday' | 'monday';
    defaultPlannerPrivacy: 'private' | 'public' | 'shared';
    autoSaveInterval: number;
    enableSoundEffects: boolean;
    enableAnimations: boolean;
    reduceMotion: boolean;
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
}

export interface UserSubscription {
    plan: 'free' | 'premium' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
    currentPeriodStart: Timestamp;
    currentPeriodEnd: Timestamp;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Timestamp;
    trialStart?: Timestamp;
    trialEnd?: Timestamp;
    paymentMethod?: string;
    subscriptionId?: string;
    customerId?: string;
    priceId?: string;
    features: string[];
    limits: {
        planners: number;
        collaborators: number;
        storage: number; // MB
        exports: number; // per month
        aiRequests: number; // per month
    };
    usage: {
        planners: number;
        storage: number; // MB
        exports: number;
        aiRequests: number;
    };
}

export interface UserStatistics {
    totalPlanners: number;
    totalSections: number;
    totalActivities: number;
    completedActivities: number;
    deletedActivities: number;
    averageTasksPerDay: number;
    streakDays: number;
    longestStreak: number;
    productivityScore: number;
    efficiencyScore: number;
    lastActivityDate: Timestamp;
    accountAge: number; // days
    loginCount: number;
    sessionDuration: number; // total minutes
    exportCount: number;
    collaborationCount: number;
    aiUsageCount: number;
}

export interface UserSecurity {
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    backupCodes: string[];
    passwordChangedAt: Timestamp;
    lastPasswordChange?: Timestamp;
    failedLoginAttempts: number;
    lockedUntil?: Timestamp;
    lockReason?: string;
    recoveryEmail?: string;
    securityQuestions?: SecurityQuestion[];
    trustedDevices: TrustedDevice[];
    loginHistory: LoginHistory[];
    suspiciousActivity: SuspiciousActivity[];
    dataEncryptionEnabled: boolean;
}

export interface SecurityQuestion {
    id: string;
    question: string;
    answerHash: string;
    createdAt: Timestamp;
}

export interface TrustedDevice {
    id: string;
    name: string;
    type: string;
    os: string;
    browser: string;
    ipAddress: string;
    userAgent: string;
    lastUsed: Timestamp;
    trustedAt: Timestamp;
}

export interface LoginHistory {
    id: string;
    timestamp: Timestamp;
    ipAddress: string;
    userAgent: string;
    location?: {
        country: string;
        city: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    };
    device: string;
    success: boolean;
    reason?: string;
}

export interface SuspiciousActivity {
    id: string;
    timestamp: Timestamp;
    type: 'multiple_failed_logins' | 'unusual_location' | 'unusual_device' | 'unusual_time' | 'brute_force_attempt';
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
    acknowledged: boolean;
    acknowledgedAt?: Timestamp;
    acknowledgedBy?: string;
}

export interface UserSocial {
    connections: {
        google?: SocialConnection;
        github?: SocialConnection;
        microsoft?: SocialConnection;
        apple?: SocialConnection;
    };
    sharing: {
        enabled: boolean;
        platforms: string[];
        autoShare: boolean;
        shareStatistics: boolean;
    };
}

export interface SocialConnection {
    connected: boolean;
    id: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Timestamp;
    scopes: string[];
    connectedAt: Timestamp;
    lastUsed: Timestamp;
}

export interface UserSettings {
    privacy: {
        profileVisibility: 'public' | 'private' | 'connections';
        showEmail: boolean;
        showActivity: boolean;
        allowIndexing: boolean;
        dataSharing: boolean;
        analytics: boolean;
    };
    data: {
        autoBackup: boolean;
        backupFrequency: 'daily' | 'weekly' | 'monthly';
        exportFormat: 'json' | 'csv' | 'pdf';
        retentionDays: number;
        deleteAfter: number; // days of inactivity
    };
    collaboration: {
        allowInvites: boolean;
        requireApproval: boolean;
        maxCollaborators: number;
        defaultRole: 'viewer' | 'editor' | 'admin';
    };
    integrations: {
        calendarSync: boolean;
        emailSync: boolean;
        webhookUrl?: string;
        apiAccess: boolean;
        apiKey?: string;
        rateLimit: number;
    };
}

export interface UserRole {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isDefault: boolean;
    isSystem: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    preferences: UserPreferences;
    subscription: UserSubscription;
    statistics: UserStatistics;
    roles: UserRole[];
    createdAt: Timestamp;
    lastActivity: Timestamp;
    isOnline: boolean;
}

export interface UserActivity {
    id: string;
    userId: string;
    type: 'login' | 'logout' | 'planner_created' | 'planner_updated' | 'planner_deleted' |
    'section_created' | 'section_updated' | 'section_deleted' | 'activity_created' |
    'activity_updated' | 'activity_deleted' | 'export_created' | 'import_completed' |
    'settings_updated' | 'profile_updated' | 'subscription_updated' | 'collaboration_invited' |
    'collaboration_accepted' | 'ai_request' | 'search_performed';
    timestamp: Timestamp;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}

export interface UserSession {
    id: string;
    userId: string;
    token: string;
    refreshToken?: string;
    deviceInfo: {
        type: string;
        os: string;
        browser: string;
        version: string;
    };
    location?: {
        country: string;
        city: string;
        coordinates?: { lat: number; lng: number };
    };
    ipAddress: string;
    userAgent: string;
    startedAt: Timestamp;
    lastActivity: Timestamp;
    expiresAt: Timestamp;
    isActive: boolean;
    isValid: boolean;
}

export interface UserNotification {
    id: string;
    userId: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'reminder' | 'alert';
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
    icon?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    read: boolean;
    readAt?: Timestamp;
    dismissed: boolean;
    dismissedAt?: Timestamp;
    createdAt: Timestamp;
    expiresAt?: Timestamp;
    metadata?: any;
}

export interface UserSearchFilters {
    query?: string;
    status?: ('active' | 'inactive' | 'suspended')[];
    subscriptionPlan?: ('free' | 'premium' | 'enterprise')[];
    role?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    lastActiveAfter?: Date;
    lastActiveBefore?: Date;
    hasVerifiedEmail?: boolean;
    twoFactorEnabled?: boolean;
    minLoginCount?: number;
    maxLoginCount?: number;
    sortBy?: 'createdAt' | 'lastActivity' | 'loginCount' | 'subscriptionPlan';
    sortOrder?: 'asc' | 'desc';
}

export interface UserBulkOperation {
    operation: 'activate' | 'deactivate' | 'suspend' | 'unsuspend' | 'update_role' |
    'update_subscription' | 'send_notification' | 'delete' | 'export';
    userIds: string[];
    data?: any;
    reason?: string;
    performedBy: string;
    performedAt: Timestamp;
}

export interface UserExportData {
    profile: UserProfile;
    planners: any[];
    activities: any[];
    settings: UserSettings;
    history: UserActivity[];
    statistics: UserStatistics;
}

export interface UserImportData {
    profile: Partial<User>;
    preferences?: Partial<UserPreferences>;
    settings?: Partial<UserSettings>;
    planners?: any[];
    activities?: any[];
}

export interface UserValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

export interface UserSearchResult {
    users: UserProfile[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface UserAnalytics {
    totalUsers: number;
    activeUsers: number;
    newUsers: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    subscriptionDistribution: {
        free: number;
        premium: number;
        enterprise: number;
    };
    activityMetrics: {
        dailyActiveUsers: number;
        weeklyActiveUsers: number;
        monthlyActiveUsers: number;
        averageSessionDuration: number;
    };
    retentionRates: {
        day1: number;
        day7: number;
        day30: number;
    };
    geographicDistribution: {
        [country: string]: number;
    };
    deviceDistribution: {
        [device: string]: number;
    };
    topFeatures: {
        [feature: string]: number;
    };
}