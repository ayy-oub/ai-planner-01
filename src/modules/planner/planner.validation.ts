// src/modules/planner/planner.validation.ts
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../shared/utils/validators';

export class PlannerValidation {
    /**
     * Create planner validation
     */
    createPlanner = [
        body('title')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Title must be between 1 and 100 characters'),

        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description must not exceed 500 characters'),

        body('color')
            .optional()
            .matches(/^#[0-9A-F]{6}$/i)
            .withMessage('Color must be a valid hex color code'),

        body('icon')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Icon must not exceed 50 characters'),

        body('settings')
            .optional()
            .isObject()
            .withMessage('Settings must be an object'),

        body('settings.isPublic')
            .optional()
            .isBoolean()
            .withMessage('isPublic must be a boolean'),

        body('settings.allowCollaboration')
            .optional()
            .isBoolean()
            .withMessage('allowCollaboration must be a boolean'),

        body('settings.autoArchive')
            .optional()
            .isBoolean()
            .withMessage('autoArchive must be a boolean'),

        body('settings.reminderEnabled')
            .optional()
            .isBoolean()
            .withMessage('reminderEnabled must be a boolean'),

        body('settings.defaultView')
            .optional()
            .isIn(['grid', 'list', 'calendar'])
            .withMessage('defaultView must be one of: grid, list, calendar'),

        body('settings.theme')
            .optional()
            .isIn(['light', 'dark', 'auto'])
            .withMessage('theme must be one of: light, dark, auto'),

        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array'),

        body('tags.*')
            .trim()
            .isLength({ max: 30 })
            .withMessage('Each tag must not exceed 30 characters'),

        validateRequest
    ];

    /**
     * Update planner validation
     */
    updatePlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        body('title')
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Title must be between 1 and 100 characters'),

        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description must not exceed 500 characters'),

        body('color')
            .optional()
            .matches(/^#[0-9A-F]{6}$/i)
            .withMessage('Color must be a valid hex color code'),

        body('icon')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Icon must not exceed 50 characters'),

        body('settings')
            .optional()
            .isObject()
            .withMessage('Settings must be an object'),

        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array'),

        body('tags.*')
            .trim()
            .isLength({ max: 30 })
            .withMessage('Each tag must not exceed 30 characters'),

        validateRequest
    ];

    /**
     * Get planner by ID validation
     */
    getPlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        validateRequest
    ];

    /**
     * Delete planner validation
     */
    deletePlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        validateRequest
    ];

    /**
     * List planners validation
     */
    listPlanners = [
        query('search')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Search must not exceed 100 characters'),

        query('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array'),

        query('tags.*')
            .trim()
            .isLength({ max: 30 })
            .withMessage('Each tag must not exceed 30 characters'),

        query('isArchived')
            .optional()
            .isBoolean()
            .withMessage('isArchived must be a boolean'),

        query('isPublic')
            .optional()
            .isBoolean()
            .withMessage('isPublic must be a boolean'),

        query('sortBy')
            .optional()
            .isIn(['createdAt', 'updatedAt', 'title', 'lastActivityAt'])
            .withMessage('sortBy must be one of: createdAt, updatedAt, title, lastActivityAt'),

        query('sortOrder')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('sortOrder must be one of: asc, desc'),

        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),

        validateRequest
    ];

    /**
     * Share planner validation
     */
    sharePlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),

        body('role')
            .isIn(['viewer', 'editor', 'admin'])
            .withMessage('Role must be one of: viewer, editor, admin'),

        body('message')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Message must not exceed 500 characters'),

        validateRequest
    ];

    /**
     * Duplicate planner validation
     */
    duplicatePlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        body('title')
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Title must be between 1 and 100 characters'),

        body('includeActivities')
            .optional()
            .isBoolean()
            .withMessage('includeActivities must be a boolean'),

        body('includeSections')
            .optional()
            .isBoolean()
            .withMessage('includeSections must be a boolean'),

        validateRequest
    ];

    /**
     * Export planner validation
     */
    exportPlanner = [
        param('id')
            .isUUID()
            .withMessage('Invalid planner ID'),

        body('format')
            .isIn(['pdf', 'json', 'csv', 'ics'])
            .withMessage('Format must be one of: pdf, json, csv, ics'),

        body('includeSections')
            .optional()
            .isArray()
            .withMessage('includeSections must be an array'),

        body('includeSections.*')
            .isUUID()
            .withMessage('Each section ID must be a valid UUID'),

        body('includeActivities')
            .optional()
            .isBoolean()
            .withMessage('includeActivities must be a boolean'),

        body('dateRange')
            .optional()
            .isObject()
            .withMessage('dateRange must be an object'),

        body('dateRange.start')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid date'),

        body('dateRange.end')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid date'),

        body('template')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Template must not exceed 100 characters'),

        validateRequest
    ];

    /**
     * Import planner validation
     */
    importPlanner = [
        body('format')
            .isIn(['json', 'csv'])
            .withMessage('Format must be one of: json, csv'),

        body('data')
            .isObject()
            .withMessage('Data is required'),

        body('options')
            .optional()
            .isObject()
            .withMessage('Options must be an object'),

        body('options.overwrite')
            .optional()
            .isBoolean()
            .withMessage('overwrite must be a boolean'),

        body('options.skipDuplicates')
            .optional()
            .isBoolean()
            .withMessage('skipDuplicates must be a boolean'),

        body('options.mapFields')
            .optional()
            .isObject()
            .withMessage('mapFields must be an object'),

        validateRequest
    ];
}