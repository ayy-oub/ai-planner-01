/* ------------------------------------------------------------------ */
/*  export.validation.ts  –  express-validator rules only             */
/* ------------------------------------------------------------------ */
import { body, param, query } from 'express-validator';

const uuid = () => param('id').isUUID().withMessage('Invalid UUID');
const optStr = (max: number) => body().optional().trim().isLength({ max });
const optBool = () => body().optional().isBoolean();
const optEnum = <T extends readonly string[]>(arr: T) => body().optional().isIn(arr);

const FORMATS: readonly string[] = ['pdf', 'csv', 'excel', 'json', 'ical', 'markdown', 'html', 'txt'];
const TYPES: readonly string[] = ['planner', 'section', 'activity', 'report', 'summary'];
const STATUSES: readonly string[] = ['pending', 'processing', 'completed', 'failed', 'expired'];
const PRIORITIES: readonly string[] = ['low', 'medium', 'high', 'urgent'];

export const exportValidations = {
    /* -------- CREATE EXPORT -------- */
    createExport: [
        body('type').isIn(TYPES).withMessage('Type must be one of: planner, section, activity, report, summary'),
        body('format').isIn(FORMATS).withMessage('Format must be one of: pdf, csv, excel, json, ical, markdown, html, txt'),

        body('plannerId').optional().isString().withMessage('Planner ID must be a string'),
        body('sectionIds').optional().isArray().withMessage('Section IDs must be an array'),
        body('sectionIds.*').isString().withMessage('Each section ID must be a string'),

        body('activityIds').optional().isArray().withMessage('Activity IDs must be an array'),
        body('activityIds.*').isString().withMessage('Each activity ID must be a string'),

        body('dateRange').optional().isObject().withMessage('Date range must be an object'),
        body('dateRange.start').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
        body('dateRange.end').optional().isISO8601().withMessage('End date must be a valid ISO date'),

        body('filters').optional().isObject().withMessage('Filters must be an object'),
        body('filters.status').optional().isArray().withMessage('Status filter must be an array'),
        body('filters.status.*').isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status value'),

        body('filters.priority').optional().isArray().withMessage('Priority filter must be an array'),
        body('filters.priority.*').isIn(PRIORITIES).withMessage('Invalid priority value'),

        body('filters.tags').optional().isArray().withMessage('Tags filter must be an array'),
        body('filters.tags.*').isString().withMessage('Each tag must be a string'),

        body('options').optional().isObject().withMessage('Options must be an object'),
        body('options.timezone').optional().isString().withMessage('Timezone must be a string'),
        body('options.dateFormat').optional().isString().withMessage('Date format must be a string'),
    ],

    /* -------- GET EXPORT -------- */
    getExport: [uuid()],

    /* -------- DELETE EXPORT -------- */
    deleteExport: [uuid()],

    /* -------- LIST USER EXPORTS -------- */
    getUserExports: [
        query('status').optional().isIn(STATUSES).withMessage('Invalid status value'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    ],

    /* -------- DOWNLOAD EXPORT -------- */
    downloadExport: [uuid()],
};