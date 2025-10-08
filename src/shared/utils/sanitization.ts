import DOMPurify from 'isomorphic-dompurify';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Sanitization options
 */
export interface SanitizationOptions {
    allowedTags?: string[];
    allowedAttributes?: string[];
    stripHtml?: boolean;
    trimWhitespace?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    customSanitizer?: (input: string) => string;
}

/**
 * Input validation rules
 */
export interface ValidationRule {
    type: 'string' | 'number' | 'email' | 'url' | 'phone' | 'date' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: string[];
    sanitize?: boolean;
    sanitizerOptions?: SanitizationOptions;
}

/**
 * Sanitization result
 */
export interface SanitizationResult {
    sanitized: any;
    errors: string[];
    warnings: string[];
}

/**
 * Data sanitizer class
 */
export class DataSanitizer {
    private static instance: DataSanitizer;

    private constructor() { }

    static getInstance(): DataSanitizer {
        if (!DataSanitizer.instance) {
            DataSanitizer.instance = new DataSanitizer();
        }
        return DataSanitizer.instance;
    }

    /**
     * Sanitize string input
     */
    sanitizeString(input: string, options: SanitizationOptions = {}): string {
        let sanitized = String(input);

        try {
            // Strip HTML if requested
            if (options.stripHtml !== false) {
                sanitized = DOMPurify.sanitize(sanitized, {
                    ALLOWED_TAGS: options.allowedTags || [],
                    ALLOWED_ATTR: options.allowedAttributes || [],
                });
            }

            // Trim whitespace
            if (options.trimWhitespace !== false) {
                sanitized = sanitized.trim();
            }

            // Apply length constraints
            if (options.minLength && sanitized.length < options.minLength) {
                throw new Error(`String must be at least ${options.minLength} characters`);
            }

            if (options.maxLength && sanitized.length > options.maxLength) {
                sanitized = sanitized.substring(0, options.maxLength);
            }

            // Apply pattern validation
            if (options.pattern && !options.pattern.test(sanitized)) {
                throw new Error('String does not match required pattern');
            }

            // Apply custom sanitizer
            if (options.customSanitizer) {
                sanitized = options.customSanitizer(sanitized);
            }

            return sanitized;
        } catch (error) {
            logger.error('String sanitization error', { error, input });
            throw new AppError(`Sanitization failed: ${error.message}`, 400, 'SANITIZATION_ERROR');
        }
    }

    /**
     * Sanitize HTML content
     */
    sanitizeHtml(html: string, options: SanitizationOptions = {}): string {
        try {
            const cleanHtml = DOMPurify.sanitize(html, {
                ALLOWED_TAGS: options.allowedTags || [
                    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
                ],
                ALLOWED_ATTR: options.allowedAttributes || [
                    'href', 'src', 'alt', 'title', 'class', 'id', 'style'
                ],
            });

            return options.trimWhitespace !== false ? cleanHtml.trim() : cleanHtml;
        } catch (error) {
            logger.error('HTML sanitization error', { error, html });
            throw new AppError('HTML sanitization failed', 400, 'HTML_SANITIZATION_ERROR');
        }
    }

    /**
     * Sanitize URL
     */
    sanitizeUrl(url: string): string {
        try {
            const sanitizedUrl = DOMPurify.sanitize(url);

            // Validate URL format
            const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
            if (!urlPattern.test(sanitizedUrl)) {
                throw new Error('Invalid URL format');
            }

            return sanitizedUrl.trim();
        } catch (error) {
            logger.error('URL sanitization error', { error, url });
            throw new AppError('Invalid URL', 400, 'INVALID_URL');
        }
    }

    /**
     * Sanitize email
     */
    sanitizeEmail(email: string): string {
        try {
            const sanitized = email.toLowerCase().trim();

            // Basic email validation
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(sanitized)) {
                throw new Error('Invalid email format');
            }

            return sanitized;
        } catch (error) {
            logger.error('Email sanitization error', { error, email });
            throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
        }
    }

    /**
     * Sanitize phone number
     */
    sanitizePhoneNumber(phone: string): string {
        try {
            // Remove all non-digit characters
            const digitsOnly = phone.replace(/\D/g, '');

            // Validate length (assuming US phone numbers)
            if (digitsOnly.length !== 10) {
                throw new Error('Phone number must be 10 digits');
            }

            return digitsOnly;
        } catch (error) {
            logger.error('Phone sanitization error', { error, phone });
            throw new AppError('Invalid phone number', 400, 'INVALID_PHONE');
        }
    }

    /**
     * Sanitize object recursively
     */
    sanitizeObject(obj: any, schema: Record<string, ValidationRule>): SanitizationResult {
        const result: SanitizationResult = {
            sanitized: {},
            errors: [],
            warnings: [],
        };

        try {
            for (const [key, rule] of Object.entries(schema)) {
                try {
                    const value = obj[key];

                    // Handle required fields
                    if (rule.required && (value === undefined || value === null)) {
                        result.errors.push(`Field '${key}' is required`);
                        continue;
                    }

                    // Skip optional empty fields
                    if (!rule.required && (value === undefined || value === null || value === '')) {
                        continue;
                    }

                    // Sanitize based on type
                    let sanitizedValue: any;

                    switch (rule.type) {
                        case 'string':
                            sanitizedValue = this.sanitizeString(value, rule.sanitizerOptions);
                            break;

                        case 'number':
                            sanitizedValue = this.sanitizeNumber(value, rule);
                            break;

                        case 'email':
                            sanitizedValue = this.sanitizeEmail(value);
                            break;

                        case 'url':
                            sanitizedValue = this.sanitizeUrl(value);
                            break;

                        case 'phone':
                            sanitizedValue = this.sanitizePhoneNumber(value);
                            break;

                        case 'date':
                            sanitizedValue = this.sanitizeDate(value);
                            break;

                        case 'boolean':
                            sanitizedValue = this.sanitizeBoolean(value);
                            break;

                        case 'array':
                            sanitizedValue = this.sanitizeArray(value, rule);
                            break;

                        case 'object':
                            sanitizedValue = this.sanitizeObject(value, rule.sanitizerOptions || {}).sanitized;
                            break;

                        default:
                            result.warnings.push(`Unknown type '${rule.type}' for field '${key}'`);
                            sanitizedValue = value;
                    }

                    // Validate enum values
                    if (rule.enum && !rule.enum.includes(sanitizedValue)) {
                        result.errors.push(`Field '${key}' must be one of: ${rule.enum.join(', ')}`);
                        continue;
                    }

                    result.sanitized[key] = sanitizedValue;

                } catch (error) {
                    result.errors.push(`Field '${key}': ${error.message}`);
                }
            }

            return result;

        } catch (error) {
            logger.error('Object sanitization error', { error, obj });
            throw new AppError('Sanitization failed', 400, 'SANITIZATION_ERROR');
        }
    }

    /**
     * Sanitize number input
     */
    private sanitizeNumber(input: any, rule: ValidationRule): number {
        const num = Number(input);

        if (isNaN(num)) {
            throw new Error('Value must be a number');
        }

        if (rule.min !== undefined && num < rule.min) {
            throw new Error(`Number must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && num > rule.max) {
            throw new Error(`Number must be at most ${rule.max}`);
        }

        return num;
    }

    /**
     * Sanitize date input
     */
    private sanitizeDate(input: any): Date {
        const date = new Date(input);

        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }

        return date;
    }

    /**
     * Sanitize boolean input
     */
    private sanitizeBoolean(input: any): boolean {
        if (typeof input === 'boolean') {
            return input;
        }

        if (typeof input === 'string') {
            return input.toLowerCase() === 'true';
        }

        if (typeof input === 'number') {
            return input !== 0;
        }

        throw new Error('Value must be a boolean');
    }

    /**
     * Sanitize array input
     */
    private sanitizeArray(input: any, rule: ValidationRule): any[] {
        if (!Array.isArray(input)) {
            throw new Error('Value must be an array');
        }

        if (rule.minLength && input.length < rule.minLength) {
            throw new Error(`Array must have at least ${rule.minLength} items`);
        }

        if (rule.maxLength && input.length > rule.maxLength) {
            throw new Error(`Array must have at most ${rule.maxLength} items`);
        }

        return input;
    }

    /**
     * Sanitize request query parameters
     */
    sanitizeQuery(query: Record<string, any>, allowedParams: string[]): Record<string, any> {
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(query)) {
            if (!allowedParams.includes(key)) {
                continue; // Skip unknown parameters
            }

            try {
                if (typeof value === 'string') {
                    sanitized[key] = this.sanitizeString(value);
                } else {
                    sanitized[key] = value;
                }
            } catch (error) {
                logger.warn('Query parameter sanitization failed', { key, value, error });
                // Skip invalid parameters instead of throwing
            }
        }

        return sanitized;
    }

    /**
     * Sanitize request body
     */
    sanitizeBody(body: any, allowedFields: string[]): any {
        const sanitized: any = {};

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                try {
                    if (typeof body[field] === 'string') {
                        sanitized[field] = this.sanitizeString(body[field]);
                    } else {
                        sanitized[field] = body[field];
                    }
                } catch (error) {
                    logger.warn('Body field sanitization failed', { field, value: body[field], error });
                    throw new AppError(`Invalid value for field '${field}'`, 400, 'INVALID_FIELD_VALUE');
                }
            }
        }

        return sanitized;
    }

    /**
     * Remove potentially dangerous characters
     */
    removeDangerousChars(input: string): string {
        // Remove potential script tags and dangerous characters
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/data:text\/html/gi, '') // Remove data URLs
            .replace(/eval\(/gi, '') // Remove eval(
            .replace(/expression\(/gi, '') // Remove expression(
            .trim();
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(input: string): string {
        const htmlEscapes: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
        };

        return input.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
    }

    /**
     * Normalize whitespace
     */
    normalizeWhitespace(input: string): string {
        return input
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
            .replace(/\r\n|\r/g, '\n'); // Normalize line endings
    }

    /**
     * Validate and sanitize file name
     */
    sanitizeFilename(filename: string): string {
        // Remove path information
        const basename = filename.split(/[\\/]/).pop() || filename;

        // Remove dangerous characters
        const sanitized = basename
            .replace(/[<>:",|?*]/g, '') // Remove dangerous characters
            .replace(/^\./, '') // Remove leading dots
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .toLowerCase();

        if (!sanitized) {
            throw new AppError('Invalid filename', 400, 'INVALID_FILENAME');
        }

        return sanitized;
    }

    /**
     * Common sanitization schemas
     */
    static schemas = {
        userProfile: {
            displayName: {
                type: 'string' as const,
                required: false,
                maxLength: 100,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                },
            },
            bio: {
                type: 'string' as const,
                required: false,
                maxLength: 500,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                    allowedTags: ['p', 'br', 'strong', 'em'],
                },
            },
            website: {
                type: 'url' as const,
                required: false,
            },
            phone: {
                type: 'phone' as const,
                required: false,
            },
        },

        planner: {
            title: {
                type: 'string' as const,
                required: true,
                maxLength: 200,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                },
            },
            description: {
                type: 'string' as const,
                required: false,
                maxLength: 1000,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
                },
            },
        },

        activity: {
            title: {
                type: 'string' as const,
                required: true,
                maxLength: 300,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                },
            },
            description: {
                type: 'string' as const,
                required: false,
                maxLength: 2000,
                sanitizerOptions: {
                    stripHtml: true,
                    trimWhitespace: true,
                    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
                },
            },
        },
    };

    /**
     * Batch sanitization
     */
    async sanitizeBatch(items: any[], schema: Record<string, ValidationRule>): Promise<any[]> {
        const results = await Promise.all(
            items.map(item => this.sanitizeObject(item, schema))
        );

        // Check for errors
        const errors = results.flatMap(result => result.errors);
        if (errors.length > 0) {
            throw new AppError('Batch sanitization failed', 400, 'BATCH_SANITIZATION_ERROR', { errors });
        }

        return results.map(result => result.sanitized);
    }

    /**
     * Validate input without sanitization
     */
    validateOnly(input: any, rules: Record<string, ValidationRule>): string[] {
        const errors: string[] = [];

        for (const [field, rule] of Object.entries(rules)) {
            const value = input[field];

            if (rule.required && (value === undefined || value === null)) {
                errors.push(`Field '${field}' is required`);
                continue;
            }

            if (!rule.required && (value === undefined || value === null || value === '')) {
                continue;
            }

            // Type validation
            switch (rule.type) {
                case 'string':
                    if (typeof value !== 'string') {
                        errors.push(`Field '${field}' must be a string`);
                    } else if (rule.minLength && value.length < rule.minLength) {
                        errors.push(`Field '${field}' must be at least ${rule.minLength} characters`);
                    } else if (rule.maxLength && value.length > rule.maxLength) {
                        errors.push(`Field '${field}' must be at most ${rule.maxLength} characters`);
                    }
                    break;

                case 'number':
                    if (typeof value !== 'number' || isNaN(value)) {
                        errors.push(`Field '${field}' must be a number`);
                    } else if (rule.min !== undefined && value < rule.min) {
                        errors.push(`Field '${field}' must be at least ${rule.min}`);
                    } else if (rule.max !== undefined && value > rule.max) {
                        errors.push(`Field '${field}' must be at most ${rule.max}`);
                    }
                    break;

                case 'email':
                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (typeof value !== 'string' || !emailPattern.test(value)) {
                        errors.push(`Field '${field}' must be a valid email address`);
                    }
                    break;

                case 'url':
                    try {
                        new URL(value);
                    } catch {
                        errors.push(`Field '${field}' must be a valid URL`);
                    }
                    break;

                case 'array':
                    if (!Array.isArray(value)) {
                        errors.push(`Field '${field}' must be an array`);
                    } else if (rule.minLength && value.length < rule.minLength) {
                        errors.push(`Field '${field}' must have at least ${rule.minLength} items`);
                    } else if (rule.maxLength && value.length > rule.maxLength) {
                        errors.push(`Field '${field}' must have at most ${rule.maxLength} items`);
                    }
                    break;
            }
        }

        return errors;
    }
}

export const dataSanitizer = DataSanitizer.getInstance();

/**
 * Quick sanitization functions
 */
export const quickSanitize = {
    string: (input: string, maxLength?: number): string => {
        return dataSanitizer.sanitizeString(input, { maxLength, stripHtml: true });
    },

    email: (input: string): string => {
        return dataSanitizer.sanitizeEmail(input);
    },

    url: (input: string): string => {
        return dataSanitizer.sanitizeUrl(input);
    },

    html: (input: string, allowedTags?: string[]): string => {
        return dataSanitizer.sanitizeHtml(input, { allowedTags });
    },

    filename: (input: string): string => {
        return dataSanitizer.sanitizeFilename(input);
    },
};

export default dataSanitizer;