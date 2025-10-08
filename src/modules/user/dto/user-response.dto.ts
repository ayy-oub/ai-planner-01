import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsString, IsOptional } from 'class-validator';

// Base Response DTO
class BaseUserResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiPropertyOptional({
        description: 'Success message',
        example: 'Operation completed successfully',
    })
    message?: string;
}

// User Preferences Response
class UserPreferencesDto {
    @ApiProperty({
        description: 'Application theme',
        enum: ['light', 'dark', 'auto'],
        example: 'dark',
    })
    theme: 'light' | 'dark' | 'auto';

    @ApiProperty({
        description: 'Accent color',
        example: '#3498db',
    })
    accentColor: string;

    @ApiProperty({
        description: 'Default view',
        enum: ['planner', 'calendar', 'tasks', 'dashboard'],
        example: 'planner',
    })
    defaultView: 'planner' | 'calendar' | 'tasks' | 'dashboard';

    @ApiProperty({
        description: 'Notification settings',
        type: Object,
    })
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

    @ApiProperty({
        description: 'User language',
        example: 'en',
    })
    language: string;

    @ApiProperty({
        description: 'User timezone',
        example: 'America/New_York',
    })
    timezone: string;

    @ApiProperty({
        description: 'Date format',
        example: 'MM/dd/yyyy',
    })
    dateFormat: string;

    @ApiProperty({
        description: 'Time format',
        enum: ['12h', '24h'],
        example: '24h',
    })
    timeFormat: '12h' | '24h';

    @ApiProperty({
        description: 'Week starts on',
        enum: ['sunday', 'monday'],
        example: 'monday',
    })
    weekStartsOn: 'sunday' | 'monday';

    @ApiProperty({
        description: 'Default planner privacy',
        enum: ['private', 'public', 'shared'],
        example: 'private',
    })
    defaultPlannerPrivacy: 'private' | 'public' | 'shared';

    @ApiProperty({
        description: 'Auto save interval in seconds',
        example: 30,
    })
    autoSaveInterval: number;

    @ApiProperty({
        description: 'Enable sound effects',
        example: true,
    })
    enableSoundEffects: boolean;

    @ApiProperty({
        description: 'Enable animations',
        example: true,
    })
    enableAnimations: boolean;

    @ApiProperty({
        description: 'Reduce motion',
        example: false,
    })
    reduceMotion: boolean;

    @ApiProperty({
        description: 'High contrast mode',
        example: false,
    })
    highContrast: boolean;

    @ApiProperty({
        description: 'Font size',
        enum: ['small', 'medium', 'large'],
        example: 'medium',
    })
    fontSize: 'small' | 'medium' | 'large';
}

export class UserPreferencesResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User preferences data',
        type: UserPreferencesDto,
    })
    data: UserPreferencesDto;
}

// User Settings Response
class UserSettingsDto {
    @ApiProperty({
        description: 'Privacy settings',
        type: Object,
    })
    privacy: {
        profileVisibility: 'public' | 'private' | 'connections';
        showEmail: boolean;
        showActivity: boolean;
        allowIndexing: boolean;
        dataSharing: boolean;
        analytics: boolean;
    };

    @ApiProperty({
        description: 'Data settings',
        type: Object,
    })
    data: {
        autoBackup: boolean;
        backupFrequency: 'daily' | 'weekly' | 'monthly';
        exportFormat: 'json' | 'csv' | 'pdf';
        retentionDays: number;
        deleteAfter: number;
    };

    @ApiProperty({
        description: 'Collaboration settings',
        type: Object,
    })
    collaboration: {
        allowInvites: boolean;
        requireApproval: boolean;
        maxCollaborators: number;
        defaultRole: 'viewer' | 'editor' | 'admin';
    };

    @ApiProperty({
        description: 'Integration settings',
        type: Object,
    })
    integrations: {
        calendarSync: boolean;
        emailSync: boolean;
        webhookUrl?: string;
        apiAccess: boolean;
        apiKey?: string;
        rateLimit: number;
    };
}

export class UserSettingsResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User settings data',
        type: UserSettingsDto,
    })
    data: UserSettingsDto;
}

// User Profile Response
class UserProfileDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user_123abc',
    })
    uid: string;

    @ApiProperty({
        description: 'User email',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User display name',
        example: 'John Doe',
    })
    displayName?: string;

    @ApiProperty({
        description: 'User avatar URL',
        example: 'https://example.com/avatar.jpg',
    })
    photoURL?: string;

    @ApiProperty({
        description: 'User preferences',
        type: UserPreferencesDto,
    })
    preferences: UserPreferencesDto;

    @ApiProperty({
        description: 'User subscription',
        type: Object,
    })
    subscription: {
        plan: 'free' | 'premium' | 'enterprise';
        status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        features: string[];
        limits: any;
    };

    @ApiProperty({
        description: 'User statistics',
        type: Object,
    })
    statistics: {
        totalPlanners: number;
        totalSections: number;
        totalActivities: number;
        completedActivities: number;
        streakDays: number;
        productivityScore: number;
        lastActivityDate: Date;
    };

    @ApiProperty({
        description: 'User roles',
        type: [Object],
    })
    roles: Array<{
        id: string;
        name: string;
        description: string;
        permissions: string[];
    }>;

    @ApiProperty({
        description: 'Account creation date',
        example: '2024-01-10T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last activity date',
        example: '2024-01-15T14:20:00Z',
    })
    lastActivity: Date;

    @ApiProperty({
        description: 'Online status',
        example: true,
    })
    isOnline: boolean;
}

export class UserProfileResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User profile data',
        type: UserProfileDto,
    })
    data: UserProfileDto;
}

// User Subscription Response
class UserSubscriptionDto {
    @ApiProperty({
        description: 'Subscription plan',
        enum: ['free', 'premium', 'enterprise'],
        example: 'premium',
    })
    plan: 'free' | 'premium' | 'enterprise';

    @ApiProperty({
        description: 'Subscription status',
        enum: ['active', 'inactive', 'cancelled', 'past_due', 'trialing'],
        example: 'active',
    })
    status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';

    @ApiProperty({
        description: 'Current period start date',
        example: '2024-01-01T00:00:00Z',
    })
    currentPeriodStart: Date;

    @ApiProperty({
        description: 'Current period end date',
        example: '2024-01-31T23:59:59Z',
    })
    currentPeriodEnd: Date;

    @ApiPropertyOptional({
        description: 'Cancel at period end',
        example: false,
    })
    cancelAtPeriodEnd?: boolean;

    @ApiPropertyOptional({
        description: 'Trial start date',
        example: '2023-12-01T00:00:00Z',
    })
    trialStart?: Date;

    @ApiPropertyOptional({
        description: 'Trial end date',
        example: '2023-12-31T23:59:59Z',
    })
    trialEnd?: Date;

    @ApiPropertyOptional({
        description: 'Payment method ID',
        example: 'pm_123abc',
    })
    paymentMethod?: string;

    @ApiPropertyOptional({
        description: 'Subscription ID',
        example: 'sub_123abc',
    })
    subscriptionId?: string;

    @ApiPropertyOptional({
        description: 'Customer ID',
        example: 'cus_123abc',
    })
    customerId?: string;

    @ApiProperty({
        description: 'Available features',
        type: [String],
        example: ['unlimited_planners', 'advanced_analytics', 'priority_support'],
    })
    features: string[];

    @ApiProperty({
        description: 'Subscription limits',
        type: Object,
        example: {
            planners: 100,
            collaborators: 50,
            storage: 10240,
            exports: 100,
            aiRequests: 1000
        }
    })
    limits: {
        planners: number;
        collaborators: number;
        storage: number;
        exports: number;
        aiRequests: number;
    };

    @ApiProperty({
        description: 'Current usage',
        type: Object,
        example: {
            planners: 25,
            storage: 2048,
            exports: 15,
            aiRequests: 250
        }
    })
    usage: {
        planners: number;
        storage: number;
        exports: number;
        aiRequests: number;
    };
}

export class UserSubscriptionResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User subscription data',
        type: UserSubscriptionDto,
    })
    data: UserSubscriptionDto;
}

// User Activity Response
export class UserActivityResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User activity data',
        type: [Object],
    })
    data: any[];

    @ApiProperty({
        description: 'Response metadata',
        type: Object,
    })
    metadata: {
        total: number;
        limit: number;
        offset: number;
    };
}

// User Sessions Response
export class UserSessionsResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User sessions data',
        type: [Object],
    })
    data: any[];
}

// User Notifications Response
export class UserNotificationsResponseDto extends BaseUserResponseDto {
    @ApiProperty({
        description: 'User notifications data',
        type: [Object],
    })
    data: any[];

    @ApiProperty({
        description: 'Response metadata',
        type: Object,
    })
    metadata: {
        total: number;
        unread: number;
        limit: number;
        offset: number;
    };
}