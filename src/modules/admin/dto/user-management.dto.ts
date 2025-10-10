// src/modules/admin/dto/user-management.dto.ts

import { IsOptional, IsString, IsEnum, IsDateString, IsNumber, Min, Max, IsBoolean, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserSubscriptionPlan } from '../../auth/auth.types';

export class GetUsersDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsEnum(UserSubscriptionPlan)
    subscriptionPlan?: UserSubscriptionPlan;

    @IsOptional()
    @IsEnum(['active', 'inactive', 'banned', 'deleted'])
    status?: 'active' | 'inactive' | 'banned' | 'deleted';

    @IsOptional()
    @IsDateString()
    dateFrom?: Date;

    @IsOptional()
    @IsDateString()
    dateTo?: Date;

    @IsOptional()
    @IsEnum(['createdAt', 'lastLogin', 'totalPlanners', 'subscriptionPlan'])
    sortBy?: string;

    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    displayName?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsEnum(UserSubscriptionPlan)
    subscriptionPlan?: UserSubscriptionPlan;

    @IsOptional()
    @IsBoolean()
    emailVerified?: boolean;

    @IsOptional()
    @IsBoolean()
    isBanned?: boolean;
}

export class BanUserDto {
    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    durationDays?: number; // If not provided, ban is permanent
}

export class BulkActionDto {
    @IsString({ each: true })
    userIds: string[];

    @IsEnum(['ban', 'unban', 'delete', 'restore', 'change-role', 'change-subscription'])
    action: string;

    @IsOptional()
    @IsEnum(UserRole)
    newRole?: UserRole;

    @IsOptional()
    @IsEnum(UserSubscriptionPlan)
    newSubscriptionPlan?: UserSubscriptionPlan;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class UserStatsDto {
    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsEnum(['daily', 'weekly', 'monthly'])
    groupBy?: 'daily' | 'weekly' | 'monthly';
}

export class ExportUsersDto {
    @IsOptional()
    @IsEnum(['csv', 'json', 'xlsx'])
    format?: 'csv' | 'json' | 'xlsx' = 'csv';

    @IsOptional()
    @IsEnum(['all', 'active', 'inactive', 'banned', 'deleted'])
    filter?: 'all' | 'active' | 'inactive' | 'banned' | 'deleted';

    @IsOptional()
    @IsDateString()
    dateFrom?: Date;

    @IsOptional()
    @IsDateString()
    dateTo?: Date;
}

export class UserResponseDto {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    emailVerified: boolean;
    role: UserRole;
    subscription: {
        plan: UserSubscriptionPlan;
        status: 'active' | 'inactive';
        expiresAt?: Date;
    };
    statistics: {
        totalPlanners: number;
        totalTasks: number;
        completedTasks: number;
        streakDays: number;
    };
    security: {
        failedLoginAttempts: number;
        lockedUntil?: Date;
        passwordChangedAt: Date;
        twoFactorEnabled: boolean;
    };
    preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
        language: string;
    };
    createdAt: Date;
    updatedAt: Date;
    lastLogin?: Date;
    isDeleted: boolean;
    deletedAt?: Date;
    status: 'active' | 'inactive' | 'banned' | 'deleted';

    constructor(user: any) {
        this.uid = user.uid;
        this.email = user.email;
        this.displayName = user.displayName;
        this.photoURL = user.photoURL;
        this.emailVerified = user.emailVerified;
        this.role = user.role;
        this.subscription = {
            plan: user.subscription?.plan || 'free',
            status: user.subscription?.status || 'inactive',
            expiresAt: user.subscription?.expiresAt?.toDate()
        };
        this.statistics = user.statistics || {
            totalPlanners: 0,
            totalTasks: 0,
            completedTasks: 0,
            streakDays: 0
        };
        this.security = {
            failedLoginAttempts: user.security?.failedLoginAttempts || 0,
            lockedUntil: user.security?.lockedUntil?.toDate(),
            passwordChangedAt: user.security?.passwordChangedAt?.toDate() || user.createdAt?.toDate(),
            twoFactorEnabled: user.security?.twoFactorEnabled || false
        };
        this.preferences = user.preferences || {
            theme: 'light',
            notifications: true,
            language: 'en'
        };
        this.createdAt = user.createdAt?.toDate();
        this.updatedAt = user.updatedAt?.toDate();
        this.lastLogin = user.lastLogin?.toDate();
        this.isDeleted = user.isDeleted || false;
        this.deletedAt = user.deletedAt?.toDate();

        // Calculate status
        if (this.isDeleted) {
            this.status = 'deleted';
        } else if (this.security.lockedUntil && this.security.lockedUntil > new Date()) {
            this.status = 'banned';
        } else if (this.lastLogin && this.lastLogin > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
            this.status = 'active';
        } else {
            this.status = 'inactive';
        }
    }
}