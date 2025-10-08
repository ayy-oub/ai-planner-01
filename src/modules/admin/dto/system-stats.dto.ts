// src/modules/admin/dto/system-stats.dto.ts

import { IsOptional, IsDateString, IsEnum, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SystemStatsFilterDto {
    @IsOptional()
    @IsDateString()
    dateFrom?: Date;

    @IsOptional()
    @IsDateString()
    dateTo?: Date;

    @IsOptional()
    @IsEnum(['hourly', 'daily', 'weekly', 'monthly'])
    granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily';
}

export class SystemHealthDto {
    @IsOptional()
    @IsBoolean()
    includeDependencies?: boolean = true;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(300)
    timeout?: number = 30;
}

export class PerformanceMetricsDto {
    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsEnum(['api', 'database', 'cache', 'external'])
    component?: 'api' | 'database' | 'cache' | 'external';

    @IsOptional()
    @IsEnum(['response_time', 'error_rate', 'throughput', 'availability'])
    metric?: 'response_time' | 'error_rate' | 'throughput' | 'availability';
}

export class AuditLogFilterDto {
    @IsOptional()
    @IsString()
    adminId?: string;

    @IsOptional()
    @IsEnum(['USER_BANNED', 'USER_UNBANNED', 'USER_ROLE_CHANGED', 'USER_DELETED', 'USER_RESTORED', 'SYSTEM_CONFIG_UPDATED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'BACKUP_CREATED', 'BACKUP_RESTORED'])
    action?: string;

    @IsOptional()
    @IsEnum(['user', 'system', 'data'])
    targetType?: 'user' | 'system' | 'data';

    @IsOptional()
    @IsString()
    targetId?: string;

    @IsOptional()
    @IsDateString()
    dateFrom?: Date;

    @IsOptional()
    @IsDateString()
    dateTo?: Date;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(1000)
    limit?: number = 100;
}

export class ConfigUpdateDto {
    @IsOptional()
    @IsBoolean()
    maintenanceMode?: boolean;

    @IsOptional()
    @IsBoolean()
    allowRegistration?: boolean;

    @IsOptional()
    @IsBoolean()
    requireEmailVerification?: boolean;

    @IsOptional()
    @IsEnum(['user', 'admin', 'super_admin'])
    defaultUserRole?: 'user' | 'admin' | 'super_admin';

    @IsOptional()
    rateLimits?: {
        windowMs: number;
        maxRequests: number;
    };

    @IsOptional()
    fileUpload?: {
        maxSize: number;
        allowedTypes: string[];
    };

    @IsOptional()
    email?: {
        smtpEnabled: boolean;
        fromAddress: string;
    };

    @IsOptional()
    ai?: {
        enabled: boolean;
        dailyLimit: number;
    };
}