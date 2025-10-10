// src/modules/admin/admin.validation.ts

import { body, param, query } from 'express-validator';
import { UserRole, UserSubscriptionPlan } from '../auth/auth.types';

export const adminValidations = {
    // User management validations
    getUsers: [
        query('search').optional().isString().trim(),
        query('role').optional().isIn(Object.values(UserRole)),
        query('subscriptionPlan').optional().isIn(Object.values(UserSubscriptionPlan)),
        query('status').optional().isIn(['active', 'inactive', 'banned', 'deleted']),
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601(),
        query('sortBy').optional().isIn(['createdAt', 'lastLogin', 'totalPlanners', 'subscriptionPlan']),
        query('sortOrder').optional().isIn(['asc', 'desc']),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],

    getUserById: [
        param('id').isString().notEmpty()
    ],

    updateUser: [
        param('id').isString().notEmpty(),
        body('displayName').optional().isString().trim().isLength({ min: 1, max: 100 }),
        body('email').optional().isEmail().normalizeEmail(),
        body('role').optional().isIn(Object.values(UserRole)),
        body('subscriptionPlan').optional().isIn(Object.values(UserSubscriptionPlan)),
        body('emailVerified').optional().isBoolean(),
        body('isBanned').optional().isBoolean()
    ],

    banUser: [
        param('id').isString().notEmpty(),
        body('reason').optional().isString().trim().isLength({ max: 500 }),
        body('durationDays').optional().isInt({ min: 1, max: 365 })
    ],

    unbanUser: [
        param('id').isString().notEmpty()
    ],

    deleteUser: [
        param('id').isString().notEmpty(),
        query('softDelete').optional().isBoolean()
    ],

    restoreUser: [
        param('id').isString().notEmpty()
    ],

    bulkAction: [
        body('userIds').isArray({ min: 1 }),
        body('userIds.*').isString().notEmpty(),
        body('action').isIn(['ban', 'unban', 'delete', 'restore', 'change-role', 'change-subscription']),
        body('newRole').optional().isIn(Object.values(UserRole)),
        body('newSubscriptionPlan').optional().isIn(Object.values(UserSubscriptionPlan)),
        body('reason').optional().isString().trim().isLength({ max: 500 })
    ],

    exportUsers: [
        body('format').optional().isIn(['csv', 'json', 'xlsx']),
        body('filter').optional().isIn(['all', 'active', 'inactive', 'banned', 'deleted']),
        body('dateFrom').optional().isISO8601(),
        body('dateTo').optional().isISO8601()
    ],

    // System stats validations
    getSystemStats: [
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601(),
        query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly'])
    ],

    getSystemHealth: [
        query('includeDependencies').optional().isBoolean(),
        query('timeout').optional().isInt({ min: 1, max: 300 })
    ],

    getPerformanceMetrics: [
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('component').optional().isIn(['api', 'database', 'cache', 'external']),
        query('metric').optional().isIn(['response_time', 'error_rate', 'throughput', 'availability'])
    ],

    // Audit log validations
    getAdminLogs: [
        query('adminId').optional().isString().notEmpty(),
        query('action').optional().isIn([
            'USER_BANNED', 'USER_UNBANNED', 'USER_ROLE_CHANGED', 'USER_DELETED',
            'USER_RESTORED', 'SYSTEM_CONFIG_UPDATED', 'DATA_EXPORTED', 'DATA_IMPORTED',
            'BACKUP_CREATED', 'BACKUP_RESTORED'
        ]),
        query('targetType').optional().isIn(['user', 'system', 'data']),
        query('targetId').optional().isString().notEmpty(),
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 1000 })
    ],

    // System config validations
    getSystemConfig: [],

    updateSystemConfig: [
        body('maintenanceMode').optional().isBoolean(),
        body('allowRegistration').optional().isBoolean(),
        body('requireEmailVerification').optional().isBoolean(),
        body('defaultUserRole').optional().isIn(Object.values(UserRole)),
        body('rateLimits.windowMs').optional().isInt({ min: 1000, max: 3600000 }),
        body('rateLimits.maxRequests').optional().isInt({ min: 1, max: 10000 }),
        body('fileUpload.maxSize').optional().isInt({ min: 1024, max: 100 * 1024 * 1024 }),
        body('fileUpload.allowedTypes').optional().isArray(),
        body('fileUpload.allowedTypes.*').isString(),
        body('email.smtpEnabled').optional().isBoolean(),
        body('email.fromAddress').optional().isEmail().normalizeEmail(),
        body('ai.enabled').optional().isBoolean(),
        body('ai.dailyLimit').optional().isInt({ min: 1, max: 10000 })
    ],

    // Backup validations
    createBackup: [
        body('type').optional().isIn(['full', 'incremental', 'users', 'planners'])
    ],

    getBackups: [],

    restoreBackup: [
        param('backupId').isString().notEmpty()
    ]
};

export default adminValidations;