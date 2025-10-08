import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { AppError, ValidationError, ErrorCodes } from '@shared/utils/errors';
import { Logger } from '@shared/utils/logger';

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await Promise.all(validations.map(validation => validation.run(req)));

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorDetails = errors.array().map(error => ({
                    field: error.type === 'field' ? error.path : error.type,
                    message: error.msg,
                    value: error.type === 'field' ? error.value : undefined,
                }));

                return next(new ValidationError('Validation failed', errorDetails));
            }

            next();
        } catch (error) {
            Logger.error('Validation middleware error', error);
            next(new AppError('Validation check failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
        }
    };
};

export const validateBody = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const missingFields = requiredFields.filter(field => !req.body[field]);

            if (missingFields.length > 0) {
                return next(new AppError(
                    `Missing required fields: ${missingFields.join(', ')}`,
                    400,
                    missingFields.map(field => ({ field, message: 'This field is required' }))
                ));
            }

            next();
        } catch (error) {
            Logger.error('Body validation middleware error', error);
            next(new AppError('Body validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
        }
    };
};

export const validateQuery = (allowedFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const invalidFields = Object.keys(req.query).filter(field => !allowedFields.includes(field));

            if (invalidFields.length > 0) {
                return next(new AppError(
                    `Invalid query parameters: ${invalidFields.join(', ')}`,
                    400,
                    invalidFields.map(field => ({ field, message: 'This field is not allowed' }))
                ));
            }

            next();
        } catch (error) {
            Logger.error('Query validation middleware error', error);
            next(new AppError('Query validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
        }
    };
};

export const validateParams = (requiredParams: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const missingParams = requiredParams.filter(param => !req.params[param]);

            if (missingParams.length > 0) {
                return next(new AppError(
                    `Missing required parameters: ${missingParams.join(', ')}`,
                    400,
                    missingParams.map(param => ({ param, message: 'This parameter is required' }))
                ));
            }

            next();
        } catch (error) {
            Logger.error('Params validation middleware error', error);
            next(new AppError('Params validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
        }
    };
};

// Custom validators
export const isStrongPassword = (value: string) => {
    try {
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return strongPasswordRegex.test(value);
    } catch (error) {
        Logger.error('Strong password validation error', error);
        return false;
    }
};

export const isValidEmail = (value: string) => {
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    } catch (error) {
        Logger.error('Email validation error', error);
        return false;
    }
};

export const sanitizeInput = (input: string): string => {
    try {
        // Remove any potentially harmful characters
        return input
            .replace(/[<>]/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    } catch (error) {
        Logger.error('Input sanitization error', error);
        return '';
    }
};

// Rate limiting validation
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cacheService = (await import('@shared/services/cache.service')).cacheService;
            const key = `rate_limit:${req.ip}:${req.route?.path || req.path}`;

            const current = await cacheService.increment(key);

            if (current === 1) {
                await cacheService.expire(key, Math.ceil(windowMs / 1000));
            }

            if (current > maxRequests) {
                return next(new AppError('Too many requests', 429, undefined, 'TOO_MANY_REQUESTS'));
            }

            next();
        } catch (error) {
            Logger.error('Rate limit validation error', error);
            // Fail open - allow request if rate limiting fails
            next();
        }
    };
};

// File upload validation
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                return next(new AppError('No file uploaded', 400, undefined, ErrorCodes.INVALID_INPUT));
            }

            const { mimetype, size } = req.file;

            if (!allowedTypes.includes(mimetype)) {
                return next(new AppError(
                    `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
                    400,
                    undefined,
                    ErrorCodes.INVALID_FILE_TYPE
                ));
            }

            if (size > maxSize) {
                return next(new AppError(
                    `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
                    400,
                    undefined,
                    ErrorCodes.FILE_TOO_LARGE
                ));
            }

            next();
        } catch (error) {
            Logger.error('File upload validation error', error);
            next(new AppError('File validation failed', 500, undefined, ErrorCodes.FILE_UPLOAD_ERROR));
        }
    };
};

// Pagination validation
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        if (page < 1) {
            return next(new AppError('Page must be greater than 0', 400, undefined, ErrorCodes.INVALID_INPUT));
        }

        if (limit < 1 || limit > 100) {
            return next(new AppError('Limit must be between 1 and 100', 400, undefined, ErrorCodes.INVALID_INPUT));
        }

        // Set validated values on request
        (req as any).validatedPagination = { page, limit };

        next();
    } catch (error) {
        Logger.error('Pagination validation error', error);
        next(new AppError('Pagination validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
    }
};

// Sort validation
export const validateSort = (allowedFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const sortBy = req.query.sortBy as string;
            const sortOrder = req.query.sortOrder as string;

            if (sortBy && !allowedFields.includes(sortBy)) {
                return next(new AppError(
                    `Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`,
                    400,
                    undefined,
                    ErrorCodes.INVALID_INPUT
                ));
            }

            if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
                return next(new AppError(
                    'Invalid sort order. Must be asc or desc',
                    400,
                    undefined,
                    ErrorCodes.INVALID_INPUT
                ));
            }

            // Set validated values on request
            (req as any).validatedSort = {
                sortBy: sortBy || allowedFields[0],
                sortOrder: sortOrder?.toLowerCase() || 'asc'
            };

            next();
        } catch (error) {
            Logger.error('Sort validation error', error);
            next(new AppError('Sort validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
        }
    };
};

// Search validation
export const validateSearch = (req: Request, res: Response, next: NextFunction) => {
    try {
        const search = req.query.search as string;

        if (search && search.length < 2) {
            return next(new AppError(
                'Search term must be at least 2 characters long',
                400,
                undefined,
                ErrorCodes.INVALID_INPUT
            ));
        }

        if (search && search.length > 100) {
            return next(new AppError(
                'Search term must be less than 100 characters long',
                400,
                undefined,
                ErrorCodes.INVALID_INPUT
            ));
        }

        // Sanitize search term
        if (search) {
            (req as any).validatedSearch = sanitizeInput(search);
        }

        next();
    } catch (error) {
        Logger.error('Search validation error', error);
        next(new AppError('Search validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
    }
};

// Date validation
export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
    try {
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;

        if (startDate && isNaN(Date.parse(startDate))) {
            return next(new AppError('Invalid start date format', 400, undefined, ErrorCodes.INVALID_INPUT));
        }

        if (endDate && isNaN(Date.parse(endDate))) {
            return next(new AppError('Invalid end date format', 400, undefined, ErrorCodes.INVALID_INPUT));
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            return next(new AppError('Start date must be before end date', 400, undefined, ErrorCodes.INVALID_INPUT));
        }

        // Set validated values on request
        (req as any).validatedDateRange = {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        };

        next();
    } catch (error) {
        Logger.error('Date range validation error', error);
        next(new AppError('Date range validation failed', 500, undefined, ErrorCodes.VALIDATION_ERROR));
    }
};

// Export all validation utilities
export const validators = {
    isStrongPassword,
    isValidEmail,
    sanitizeInput,
    validateDateRange,
    validateSearch,
    validateSort,
    validatePagination,
    validateFileUpload,
    validateRateLimit,
};