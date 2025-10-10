import { body, query, param, validationResult } from 'express-validator';
import { AppError, ValidationError } from './errors';
import { Request } from 'express';

/**
 * Common validation chains
 */
export const commonValidations = {
    /**
     * Email validation
     */
    email: (field: string = 'email', required: boolean = true) => {
        const validation = body(field)
            .trim()
            .isEmail()
            .withMessage(`${field} must be a valid email address`)
            .normalizeEmail();

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * Password validation
     */
    password: (field: string = 'password', required: boolean = true) => {
        const validation = body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage(`${field} must be between 8 and 128 characters`)
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage(`${field} must contain at least one lowercase letter, one uppercase letter, one number, and one special character`);

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * MongoDB ObjectId validation
     */
    objectId: (field: string, required: boolean = true) => {
        const validation = param(field)
            .isMongoId()
            .withMessage(`${field} must be a valid MongoDB ObjectId`);

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * UUID validation
     */
    uuid: (field: string, required: boolean = true) => {
        const validation = param(field)
            .isUUID()
            .withMessage(`${field} must be a valid UUID`);

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * String validation
     */
    string: (field: string, options: {
        min?: number;
        max?: number;
        required?: boolean;
        trim?: boolean;
        alpha?: boolean;
        alphanumeric?: boolean;
    } = {}) => {
        let validation = body(field);

        if (options.trim !== false) {
            validation = validation.trim();
        }

        if (options.required) {
            validation = validation.notEmpty().withMessage(`${field} is required`);
        } else {
            validation = validation.optional();
        }

        if (options.min) {
            validation = validation
                .isLength({ min: options.min })
                .withMessage(`${field} must be at least ${options.min} characters`);
        }

        if (options.max) {
            validation = validation
                .isLength({ max: options.max })
                .withMessage(`${field} must be at most ${options.max} characters`);
        }

        if (options.alpha) {
            validation = validation
                .isAlpha()
                .withMessage(`${field} must contain only letters`);
        }

        if (options.alphanumeric) {
            validation = validation
                .isAlphanumeric()
                .withMessage(`${field} must contain only letters and numbers`);
        }

        return validation;
    },

    /**
     * Number validation
     */
    number: (field: string, options: {
        min?: number;
        max?: number;
        required?: boolean;
        integer?: boolean;
        positive?: boolean;
    } = {}) => {
        let validation = body(field);

        if (options.required) {
            validation = validation.notEmpty().withMessage(`${field} is required`);
        } else {
            validation = validation.optional();
        }

        validation = validation
            .isNumeric()
            .withMessage(`${field} must be a number`);

        if (options.integer) {
            validation = validation
                .isInt()
                .withMessage(`${field} must be an integer`);
        } else {
            validation = validation
                .isFloat()
                .withMessage(`${field} must be a valid number`);
        }

        if (options.positive) {
            validation = validation
                .isFloat({ min: 0 })
                .withMessage(`${field} must be a positive number`);
        }

        if (options.min !== undefined) {
            validation = validation
                .isFloat({ min: options.min })
                .withMessage(`${field} must be at least ${options.min}`);
        }

        if (options.max !== undefined) {
            validation = validation
                .isFloat({ max: options.max })
                .withMessage(`${field} must be at most ${options.max}`);
        }

        return validation;
    },

    /**
     * Date validation
     */
    date: (field: string, options: {
        required?: boolean;
        future?: boolean;
        past?: boolean;
    } = {}) => {
        let validation = body(field)
            .isISO8601()
            .withMessage(`${field} must be a valid date`)
            .toDate();

        if (options.required) {
            validation = validation.notEmpty().withMessage(`${field} is required`);
        } else {
            validation = validation.optional();
        }

        if (options.future) {
            validation = validation
                .custom((value) => value > new Date())
                .withMessage(`${field} must be a future date`);
        }

        if (options.past) {
            validation = validation
                .custom((value) => value < new Date())
                .withMessage(`${field} must be a past date`);
        }

        return validation;
    },

    /**
     * Enum validation
     */
    enum: (field: string, values: string[], required: boolean = true) => {
        const validation = body(field)
            .isIn(values)
            .withMessage(`${field} must be one of: ${values.join(', ')}`);

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * Boolean validation
     */
    boolean: (field: string, required: boolean = true) => {
        const validation = body(field)
            .isBoolean()
            .withMessage(`${field} must be a boolean value`)
            .toBoolean();

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * Array validation
     */
    array: (field: string, options: {
        min?: number;
        max?: number;
        required?: boolean;
    } = {}) => {
        let validation = body(field)
            .isArray()
            .withMessage(`${field} must be an array`);

        if (options.required) {
            validation = validation.notEmpty().withMessage(`${field} is required`);
        } else {
            validation = validation.optional();
        }

        if (options.min) {
            validation = validation
                .isLength({ min: options.min })
                .withMessage(`${field} must contain at least ${options.min} items`);
        }

        if (options.max) {
            validation = validation
                .isLength({ max: options.max })
                .withMessage(`${field} must contain at most ${options.max} items`);
        }

        return validation;
    },

    /**
     * URL validation
     */
    url: (field: string, required: boolean = true) => {
        const validation = body(field)
            .isURL()
            .withMessage(`${field} must be a valid URL`);

        return required ? validation.notEmpty().withMessage(`${field} is required`) : validation.optional();
    },

    /**
     * Phone number validation
     */
    phone: (field: string, options: {
        required?: boolean;
        region?: string;
    } = {}) => {
        let validation = body(field);

        if (options.required) {
            validation = validation.notEmpty().withMessage(`${field} is required`);
        } else {
            validation = validation.optional();
        }

        validation = validation
            .isMobilePhone(options.region as any || 'any')
            .withMessage(`${field} must be a valid phone number`);

        return validation;
    },
};

/**
 * Custom validation functions
 */
export const customValidations = {
    /**
     * Validate that a date is after another date
     */
    isAfter: (field: string, comparisonField: string) => {
        return body(field)
            .custom((value, { req }) => {
                const comparisonValue = req.body[comparisonField];
                if (!comparisonValue) return true;
                return new Date(value) > new Date(comparisonValue);
            })
            .withMessage(`${field} must be after ${comparisonField}`);
    },

    /**
     * Validate that a date is before another date
     */
    isBefore: (field: string, comparisonField: string) => {
        return body(field)
            .custom((value, { req }) => {
                const comparisonValue = req.body[comparisonField];
                if (!comparisonValue) return true;
                return new Date(value) < new Date(comparisonValue);
            })
            .withMessage(`${field} must be before ${comparisonField}`);
    },

    /**
     * Validate password confirmation
     */
    passwordConfirmation: (passwordField: string = 'password', confirmField: string = 'passwordConfirmation') => {
        return body(confirmField)
            .custom((value, { req }) => value === req.body[passwordField])
            .withMessage('Password confirmation does not match');
    },

    /**
     * Validate that at least one field is present
     */
    atLeastOne: (fields: string[], message?: string) => {
        return body()
            .custom((value, { req }) => {
                return fields.some(field => req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '');
            })
            .withMessage(message || `At least one of these fields must be provided: ${fields.join(', ')}`);
    },

    /**
     * Validate that exactly one field is present
     */
    exactlyOne: (fields: string[], message?: string) => {
        return body()
            .custom((value, { req }) => {
                const provided = fields.filter(field =>
                    req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== ''
                );
                return provided.length === 1;
            })
            .withMessage(message || `Exactly one of these fields must be provided: ${fields.join(', ')}`);
    },

    /**
     * Validate no additional fields are present
     */
    noAdditionalFields: (allowedFields: string[], message?: string) => {
        return body()
            .custom((value, { req }) => {
                const providedFields = Object.keys(req.body);
                const additionalFields = providedFields.filter(field => !allowedFields.includes(field));
                return additionalFields.length === 0;
            })
            .withMessage(message || `Only these fields are allowed: ${allowedFields.join(', ')}`);
    },
};

/**
 * Validation result handler
 */
export const handleValidationResult = (req: Request) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorDetails = errors.array().map(error => ({
            field: error.type === 'field' ? error.path : error.type,
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
        }));

        throw new ValidationError('Validation failed', errorDetails);
    }
};

/**
 * Query validation helpers
 */
export const queryValidations = {
    /**
     * Pagination query validation
     */
    pagination: () => [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer')
            .toInt(),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
            .toInt(),

        query('sort')
            .optional()
            .isString()
            .withMessage('Sort must be a string'),

        query('order')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Order must be either "asc" or "desc"'),
    ],

    /**
     * Search query validation
     */
    search: () => [
        query('q')
            .optional()
            .isString()
            .isLength({ min: 1, max: 100 })
            .withMessage('Search query must be between 1 and 100 characters'),

        query('fields')
            .optional()
            .isString()
            .withMessage('Fields must be a comma-separated string'),
    ],

    /**
     * Filter query validation
     */
    filter: (allowedFields: string[]) => [
        query('filter')
            .optional()
            .isString()
            .withMessage('Filter must be a string')
            .custom((value: string | undefined) => {
                if (!value) return true;
    
                // Basic filter validation - can be extended
                const filterFields = value.split(',').map((f: string) => f.split(':')[0]);
                return filterFields.every((field: string) => allowedFields.includes(field));
            })
            .withMessage(`Filter fields must be one of: ${allowedFields.join(', ')}`),
    ],
};

/**
 * File validation helpers
 */
export const fileValidations = {
    /**
     * File size validation
     */
    size: (maxSize: number) => (file: Express.Multer.File) => {
        if (file.size > maxSize) {
            throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
        }
        return true;
    },

    /**
     * File type validation
     */
    type: (allowedTypes: string[]) => (file: Express.Multer.File) => {
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        const mimeType = file.mimetype;

        const isValid = allowedTypes.some(type =>
            fileExtension === type.toLowerCase() || mimeType.includes(type)
        );

        if (!isValid) {
            throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        }

        return true;
    },

    /**
     * Image file validation
     */
    image: () => (file: Express.Multer.File) => {
        const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        fileValidations.type(allowedTypes)(file);
        fileValidations.size(maxSize)(file);

        return true;
    },

    /**
     * Document file validation
     */
    document: () => (file: Express.Multer.File) => {
        const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        fileValidations.type(allowedTypes)(file);
        fileValidations.size(maxSize)(file);

        return true;
    },
};

/**
 * Validation groups
 */
export const validationGroups = {
    create: 'create',
    update: 'update',
    patch: 'patch',
    delete: 'delete',
};

/**
 * Conditional validation based on group
 */
export const conditionalValidation = (group: string, validations: any[]) => {
    return validations.map(validation => {
        return validation.custom ? validation : validation.if((value: any, { req }: any) => req.validationGroup === group);
    });
};

export default {
    commonValidations,
    customValidations,
    handleValidationResult,
    queryValidations,
    fileValidations,
    validationGroups,
    conditionalValidation,
};