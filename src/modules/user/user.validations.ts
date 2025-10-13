import { body, query } from 'express-validator';

/** ===== Update Subscription ===== */
export const updateSubscriptionValidation = [
    body('plan')
        .isIn(['free', 'premium', 'enterprise'])
        .withMessage('Plan must be one of: free, premium, enterprise'),
    body('status')
        .isIn(['active', 'inactive', 'cancelled', 'past_due', 'trialing'])
        .withMessage('Status must be one of: active, inactive, cancelled, past_due, trialing'),
    body('cancelAtPeriodEnd').optional().isBoolean(),
    body('paymentMethod').optional().isString(),
    body('subscriptionId').optional().isString(),
    body('customerId').optional().isString(),
    body('priceId').optional().isString(),
    body('trialEnd').optional().isISO8601(),
    body('currentPeriodStart').optional().isISO8601(),
    body('currentPeriodEnd').optional().isISO8601(),
    body('features').optional().isArray(),
    body('limits').optional().isObject(),
    body('reason').optional().isString().isLength({ max: 500 }),
];

/** ===== User Bulk Operation ===== */
export const userBulkOperationValidation = [
    body('operation')
        .isIn([
            'activate', 'deactivate', 'suspend', 'unsuspend',
            'update_role', 'update_subscription', 'send_notification',
            'delete', 'export',
        ]),
    body('userIds').isArray({ min: 1 }),
    body('userIds.*').isString(),
    body('data').optional().isObject(),
    body('reason').optional().isString().isLength({ max: 500 }),
    body('sendNotification').optional().isBoolean(),
];

/** ===== User Export Request ===== */
export const userExportRequestValidation = [
    body('includeProfile').isBoolean(),
    body('includePreferences').isBoolean(),
    body('includeSettings').isBoolean(),
    body('includeActivity').isBoolean(),
    body('includePlanners').isBoolean(),
    body('includeActivities').isBoolean(),
    body('includeStatistics').isBoolean(),
    body('includeNotifications').isBoolean(),
    body('includeSessions').isBoolean(),
    body('dateRange').optional().isObject(),
    body('dateRange.start').optional().isISO8601(),
    body('dateRange.end').optional().isISO8601(),
    body('format').isIn(['json', 'csv', 'pdf']),
];

/** ===== User Import Request ===== */
export const userImportRequestValidation = [
    body('profile').optional().isObject(),
    body('preferences').optional().isObject(),
    body('settings').optional().isObject(),
    body('planners').optional().isArray(),
    body('activities').optional().isArray(),
    body('mode').isIn(['merge', 'replace']),
    body('validate').isBoolean(),
    body('skipDuplicates').isBoolean(),
];

/** ===== Notification DTOs ===== */
export const createNotificationValidation = [
    body('type').isIn(['info', 'warning', 'error', 'success', 'reminder', 'alert']),
    body('title').isString().isLength({ max: 100 }),
    body('message').isString().isLength({ max: 500 }),
    body('actionUrl').optional().isString(),
    body('actionText').optional().isString(),
    body('icon').optional().isString(),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']),
    body('expiresAt').optional().isISO8601(),
    body('metadata').optional().isObject(),
];

export const updateNotificationValidation = [
    body('read').optional().isBoolean(),
    body('dismissed').optional().isBoolean(),
];

export const bulkNotificationValidation = [
    body('userIds').isArray({ min: 1 }),
    body('userIds.*').isString(),
    body('notification').isObject(),
    body('notification.type').isIn(['info', 'warning', 'error', 'success', 'reminder', 'alert']),
    body('notification.title').isString().isLength({ max: 100 }),
    body('notification.message').isString().isLength({ max: 500 }),
    body('notification.priority').isIn(['low', 'medium', 'high', 'urgent']),
    body('immediate').optional().isBoolean(),
    body('scheduleFor').optional().isISO8601(),
];

/** ===== User Pagination ===== */
export const userPaginationValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc']),
];

/** ===== Sessions ===== */
export const createSessionValidation = [
    body('token').isString(),
    body('refreshToken').optional().isString(),
    body('deviceInfo').isObject(),
    body('deviceInfo.type').isString(),
    body('deviceInfo.os').isString(),
    body('deviceInfo.browser').isString(),
    body('deviceInfo.version').isString(),
    body('location').optional().isObject(),
    body('location.country').optional().isString(),
    body('location.city').optional().isString(),
    body('location.coordinates').optional().isObject(),
    body('location.coordinates.lat').optional().isFloat(),
    body('location.coordinates.lng').optional().isFloat(),
    body('ipAddress').isString(),
    body('userAgent').isString(),
];

export const sessionFiltersValidation = [
    query('activeOnly').optional().isBoolean(),
    query('deviceType').optional().isIn(['desktop', 'mobile', 'tablet']),
    query('location').optional().isString(),
    query('ipAddress').optional().isString(),
];

export const invalidateSessionValidation = [
    body('reason').optional().isString(),
    body('invalidateAllOthers').optional().isBoolean(),
];

/** ===== User Validation ===== */
export const validateUserValidation = [
    body('email').optional().isEmail(),
    body('displayName').optional().isString(),
    body('phoneNumber').optional().isString(),
    body('password').optional().isString(),
    body('preferences').optional().isObject(),
    body('settings').optional().isObject(),
    body('socialLinks').optional().isObject(),
];

export const updateProfileValidation = [
    body('displayName').optional().isString(),
    body('bio').optional().isString(),
    body('location').optional().isString(),
    body('website').optional().isString(),
    body('socialLinks').optional().isObject(),
    body('preferences').optional().isObject(),
  ];
  
  export const updateSettingsValidation = [
    body('theme').optional().isIn(['light', 'dark', 'auto']),
    body('language').optional().isString(),
    body('timezone').optional().isString(),
    body('notifications').optional().isObject(),
    body('privacy').optional().isObject(),
    body('accessibility').optional().isObject(),
  ];
  
  export const updatePreferencesValidation = [
    body('plannerView').optional().isIn(['grid', 'list', 'kanban', 'calendar']),
    body('defaultPlanner').optional().isString(),
    body('emailNotifications').optional().isBoolean(),
    body('pushNotifications').optional().isBoolean(),
    body('activityReminders').optional().isBoolean(),
    body('weeklyDigest').optional().isBoolean(),
  ];
  
  export const uploadAvatarValidation = [
    body('avatar').exists().withMessage('Avatar file is required')
  ];
  
  export const getNotificationsValidation = [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('unreadOnly').optional().isBoolean(),
    query('type').optional().isString(),
  ];
  
  export const markNotificationReadValidation = [
    body('id').exists().isString(),
  ];
  
  export const revokeSessionValidation = [
    body('id').exists().isString(),
  ];
  
  export const exportDataValidation = [
    body('format').isIn(['json', 'csv']),
    body('includeData').optional().isArray(),
  ];
  
  export const deleteAccountValidation = [
    body('password').exists().isString(),
    body('confirmation').exists().isString(),
    body('reason').optional().isString(),
    body('feedback').optional().isString(),
  ];
  
  export const toggleTwoFactorValidation = [
    body('enable').exists().isBoolean(),
  ];
  
export const userValidations = {
    updateProfile: updateProfileValidation,
    updateSettings: updateSettingsValidation,
    updatePreferences: updatePreferencesValidation,
    uploadAvatar: uploadAvatarValidation,
    getNotifications: getNotificationsValidation,
    markNotificationRead: markNotificationReadValidation,
    revokeSession: revokeSessionValidation,
    exportData: exportDataValidation,
    deleteAccount: deleteAccountValidation,
    updateSubscription: updateSubscriptionValidation,
    userBulkOperation: userBulkOperationValidation,
    toggleTwoFactor: toggleTwoFactorValidation,
  };