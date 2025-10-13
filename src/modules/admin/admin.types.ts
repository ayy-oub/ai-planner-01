// src/modules/admin/admin.types.ts

import { Timestamp } from 'firebase-admin/firestore';
import { UserRole, UserSubscriptionPlan } from '../user/user.types';

export interface AdminUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    emailVerified: boolean;
    role: UserRole;
    subscription: {
        plan: UserSubscriptionPlan;
        status: 'active' | 'inactive';
        expiresAt?: Timestamp;
    };
    statistics: {
        totalPlanners: number;
        totalTasks: number;
        completedTasks: number;
        streakDays: number;
    };
    security: {
        failedLoginAttempts: number;
        lockedUntil?: Timestamp;
        passwordChangedAt: Timestamp;
        twoFactorEnabled: boolean;
    };
    preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
        language: string;
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastLogin?: Timestamp;
    isDeleted: boolean;
    deletedAt?: Timestamp;
}

export interface SystemStats {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    totalPlanners: number;
    activePlanners: number;
    totalActivities: number;
    completedActivities: number;
    storageUsage: {
        totalSize: number;
        userFiles: number;
        backupSize: number;
    };
    apiUsage: {
        totalRequests: number;
        requestsToday: number;
        requestsThisWeek: number;
        requestsThisMonth: number;
        averageResponseTime: number;
    };
    subscriptionStats: {
        free: number;
        premium: number;
        enterprise: number;
        trial: number;
    };
    systemHealth: {
        database: 'healthy' | 'degraded' | 'down';
        redis: 'healthy' | 'degraded' | 'down';
        externalServices?: Record<string, 'healthy' | 'degraded' | 'down'>;
    };
    generatedAt: Timestamp;
}

export interface UserActivityLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
    initiatorRole?: UserRole;

}

export interface AdminAuditLog {
    id: string;
    adminId: string;
    action: AdminAction;
    targetType: 'user' | 'system' | 'data';
    targetId?: string;
    details: Record<string, any>;
    timestamp: Timestamp;
}

export type AdminAction =
    | 'USER_BANNED'
    | 'USER_UNBANNED'
    | 'USER_ROLE_CHANGED'
    | 'USER_DELETED'
    | 'USER_RESTORED'
    | 'SYSTEM_CONFIG_UPDATED'
    | 'DATA_EXPORTED'
    | 'DATA_IMPORTED'
    | 'BACKUP_CREATED'
    | 'BACKUP_RESTORED';

export interface UserFilter {
    search?: string;
    role?: UserRole;
    subscriptionPlan?: UserSubscriptionPlan;
    status?: 'active' | 'inactive' | 'banned' | 'deleted';
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: 'createdAt' | 'lastLogin' | 'totalPlanners' | 'subscriptionPlan';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}

export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    banned: number;
    deleted: number;
    byPlan: Record<UserSubscriptionPlan, number>;
    byRole: Record<UserRole, number>;
    trend?: {
        dailyActiveUsers: number[];
        labels: string[];
      };
}

export interface SystemConfig {
    maintenanceMode: boolean;
    allowRegistration: boolean;
    requireEmailVerification: boolean;
    defaultUserRole: UserRole;
    rateLimits: {
        windowMs: number;
        maxRequests: number;
    };
    fileUpload: {
        maxSize: number;
        allowedTypes: string[];
    };
    email: {
        smtpEnabled: boolean;
        fromAddress: string;
    };
    ai: {
        enabled: boolean;
        dailyLimit: number;
    };
}

export interface BackupRecord {
    id: string;
    type: 'full' | 'incremental' | 'users' | 'planners';
    size: number; // bytes
    status: 'processing' | 'completed' | 'failed';
    createdAt: Timestamp;
    createdBy: string; // admin uid
    downloadURL?: string;
    checksum?: string;
    metadata?: Record<string, any>;
  }