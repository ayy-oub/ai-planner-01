import { body, param, query, validationResult } from 'express-validator';
import { BadRequestException } from '../../shared/utils/errors';

export const exportValidations = {
    // Create export validation
    createExport: [
        body('type')
            .isIn(['planner', 'section', 'activity', 'report', 'summary'])
            .withMessage('Type must be one of: planner, section, activity, report, summary'),

        body('format')
            .isIn(['pdf', 'csv', 'excel', 'json', 'ical', 'markdown', 'html', 'txt'])
            .withMessage('Format must be one of: pdf, csv, excel, json, ical, markdown, html, txt'),

        body('plannerId')
            .optional()
            .isString()
            .withMessage('Planner ID must be a string'),

        body('sectionIds')
            .optional()
            .isArray()
            .withMessage('Section IDs must be an array'),

        body('sectionIds.*')
            .isString()
            .withMessage('Each section ID must be a string'),

        body('activityIds')
            .optional()
            .isArray()
            .withMessage('Activity IDs must be an array'),

        body('activityIds.*')
            .isString()
            .withMessage('Each activity ID must be a string'),

        body('dateRange')
            .optional()
            .isObject()
            .withMessage('Date range must be an object'),

        body('dateRange.start')
            .optional({ checkFalsy: true })
            .isISO8601()
            .withMessage('Start date must be a valid ISO date'),

        body('dateRange.end')
            .optional({ checkFalsy: true })
            .isISO8601()
            .withMessage('End date must be a valid ISO date'),

        body('filters')
            .optional()
            .isObject()
            .withMessage('Filters must be an object'),

        body('filters.status')
            .optional()
            .isArray()
            .withMessage('Status filter must be an array'),

        body('filters.status.*')
            .isIn(['pending', 'in-progress', 'completed', 'cancelled'])
            .withMessage('Invalid status value'),

        body('filters.priority')
            .optional()
            .isArray()
            .withMessage('Priority filter must be an array'),

        body('filters.priority.*')
            .isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Invalid priority value'),

        body('filters.tags')
            .optional()
            .isArray()
            .withMessage('Tags filter must be an array'),

        body('filters.tags.*')
            .isString()
            .withMessage('Each tag must be a string'),

        body('options')
            .optional()
            .isObject()
            .withMessage('Options must be an object'),

        body('options.timezone')
            .optional()
            .isString()
            .withMessage('Timezone must be a string'),

        body('options.dateFormat')
            .optional()
            .isString()
            .withMessage('Date format must be a string'),
    ],

    // Get export validation
    getExport: [
        param('exportId')
            .isString()
            .withMessage('Export ID must be a string')
            .notEmpty()
            .withMessage('Export ID is required'),
    ],

    // Delete export validation
    deleteExport: [
        param('exportId')
            .isString()
            .withMessage('Export ID must be a string')
            .notEmpty()
            .withMessage('Export ID is required'),
    ],

    // Get user exports validation
    getUserExports: [
        query('status')
            .optional()
            .isIn(['pending', 'processing', 'completed', 'failed', 'expired'])
            .withMessage('Invalid status value'),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),

        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be a non-negative integer'),
    ],

    // Download export validation
    downloadExport: [
        param('exportId')
            .isString()
            .withMessage('Export ID must be a string')
            .notEmpty()
            .withMessage('Export ID is required'),
    ],
};

// Validation middleware
export const validateRequest = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequestException('Validation failed', errors.array()));
    }
    next();
};

// Custom validation helpers
export const validateExportRequest = (data: any): void => {
    // Validate that at least one of plannerId, sectionIds, activityIds is provided
    if (!data.plannerId && !data.sectionIds && !data.activityIds) {
        throw new BadRequestException(
            'At least one of plannerId, sectionIds, or activityIds must be provided'
        );
    }

    // Validate date range
    if (data.dateRange) {
        const { start, end } = data.dateRange;
        if (new Date(start) > new Date(end)) {
            throw new BadRequestException('Start date must be before end date');
        }
    }

    // Validate format-specific options
    if (data.format === 'pdf' && data.options?.pdfOptions) {
        const { orientation, pageSize } = data.options.pdfOptions;
        if (orientation && !['portrait', 'landscape'].includes(orientation)) {
            throw new BadRequestException('PDF orientation must be portrait or landscape');
        }
        if (pageSize && !['A4', 'Letter', 'Legal'].includes(pageSize)) {
            throw new BadRequestException('PDF page size must be A4, Letter, or Legal');
        }
    }

    // Validate CSV options
    if (data.format === 'csv' && data.options?.csvOptions) {
        const { delimiter, quote } = data.options.csvOptions;
        if (delimiter && delimiter.length !== 1) {
            throw new BadRequestException('CSV delimiter must be a single character');
        }
        if (quote && quote.length !== 1) {
            throw new BadRequestException('CSV quote character must be a single character');
        }
    }
};

export const sanitizeExportData = (data: any): any => {
    // Remove potentially harmful characters from strings
    if (data.options?.pdfOptions?.header?.text) {
        data.options.pdfOptions.header.text = data.options.pdfOptions.header.text
            .replace(/[<>]/g, '')
            .trim();
    }

    if (data.options?.pdfOptions?.footer?.text) {
        data.options.pdfOptions.footer.text = data.options.pdfOptions.footer.text
            .replace(/[<>]/g, '')
            .trim();
    }

    // Sanitize custom fields
    if (data.options?.customFields) {
        data.options.customFields = data.options.customFields.map((field: string) =>
            field.replace(/[^a-zA-Z0-9_]/g, '')
        );
    }

    return data;
};