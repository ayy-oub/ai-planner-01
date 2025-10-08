import { body, param, query } from 'express-validator';
import { config } from '@shared/config';

export const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 100 })
        .withMessage('Email must be less than 100 characters'),

    body('password')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        })
        .withMessage('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one symbol')
        .isLength({ max: 128 })
        .withMessage('Password must be less than 128 characters'),

    body('displayName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Display name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9\s\-_.]+$/)
        .withMessage('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),

    body('acceptTerms')
        .isBoolean()
        .equals('true')
        .withMessage('You must accept the terms and conditions'),

    body('marketingEmails')
        .optional()
        .isBoolean()
        .withMessage('Marketing emails preference must be a boolean'),

    body('deviceInfo.userAgent')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('User agent must be less than 500 characters'),

    body('deviceInfo.deviceId')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Device ID must be less than 100 characters'),
];

export const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Password is required'),

    body('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean'),

    body('deviceInfo.userAgent')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('User agent must be less than 500 characters'),

    body('deviceInfo.deviceId')
        .optional()
        .isString()
        .isLength({ max: 100 })
        .withMessage('Device ID must be less than 100 characters'),
];

export const refreshTokenValidation = [
    body('refreshToken')
        .isString()
        .isLength({ min: 10 })
        .withMessage('Refresh token is required and must be valid'),
];

export const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('recaptchaToken')
        .optional()
        .isString()
        .isLength({ min: 10 })
        .withMessage('reCAPTCHA token must be valid'),
];

export const resetPasswordValidation = [
    body('token')
        .isString()
        .isLength({ min: 10 })
        .withMessage('Reset token is required and must be valid'),

    body('newPassword')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        })
        .withMessage('New password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one symbol')
        .isLength({ max: 128 })
        .withMessage('New password must be less than 128 characters'),

    body('confirmPassword')
        .isString()
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match new password');
            }
            return true;
        }),
];

export const updateProfileValidation = [
    body('displayName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Display name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9\s\-_.]+$/)
        .withMessage('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),

    body('photoURL')
        .optional()
        .isURL()
        .withMessage('Photo URL must be a valid URL')
        .isLength({ max: 500 })
        .withMessage('Photo URL must be less than 500 characters'),

    body('preferences.theme')
        .optional()
        .isIn(['light', 'dark', 'auto'])
        .withMessage('Theme must be one of: light, dark, auto'),

    body('preferences.accentColor')
        .optional()
        .isHexColor()
        .withMessage('Accent color must be a valid hex color'),

    body('preferences.defaultView')
        .optional()
        .isIn(['daily', 'weekly', 'monthly'])
        .withMessage('Default view must be one of: daily, weekly, monthly'),

    body('preferences.notifications')
        .optional()
        .isBoolean()
        .withMessage('Notifications preference must be a boolean'),

    body('preferences.language')
        .optional()
        .isISO6391()
        .withMessage('Language must be a valid ISO 639-1 code'),

    body('preferences.timezone')
        .optional()
        .isString()
        .isLength({ max: 50 })
        .withMessage('Timezone must be less than 50 characters'),

    body('preferences.dateFormat')
        .optional()
        .isString()
        .isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
        .withMessage('Date format must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD'),

    body('preferences.timeFormat')
        .optional()
        .isIn(['12h', '24h'])
        .withMessage('Time format must be one of: 12h, 24h'),
];

export const changePasswordValidation = [
    body('currentPassword')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Current password is required'),

    body('newPassword')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        })
        .withMessage('New password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one symbol')
        .isLength({ max: 128 })
        .withMessage('New password must be less than 128 characters')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password must be different from current password');
            }
            return true;
        }),

    body('confirmPassword')
        .isString()
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match new password');
            }
            return true;
        }),
];

export const verifyEmailValidation = [
    body('token')
        .isString()
        .isLength({ min: 10 })
        .withMessage('Verification token is required and must be valid'),
];

export const emailValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
];

export const passwordValidation = [
    body('password')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        })
        .withMessage('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one symbol')
        .isLength({ max: 128 })
        .withMessage('Password must be less than 128 characters'),
];

export const tokenValidation = [
    param('token')
        .isString()
        .isLength({ min: 10 })
        .withMessage('Token is required and must be valid'),
];

export const queryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('sort')
        .optional()
        .isIn(['createdAt', 'updatedAt', 'email', 'displayName'])
        .withMessage('Sort must be one of: createdAt, updatedAt, email, displayName'),

    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Order must be either asc or desc'),
];

// Validation middleware wrapper
export const validate = (validations: any[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        next();
    };
};

// Import Request, Response, NextFunction from express
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';