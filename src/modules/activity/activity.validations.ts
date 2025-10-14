// src/modules/activity/activity.validation.ts
import { body, param, query } from 'express-validator';

/* ---------- shared helpers ---------- */
const uuid = (field = 'id') => param(field).isUUID().withMessage(`Invalid ${field} UUID`);
const optStr = (field: string, max: number) => body(field).optional().trim().isLength({ max });
const optDate = (field: string) => body(field).optional().isISO8601().toDate();
const optEnum = <T extends readonly string[]>(field: string, arr: T) =>
    body(field).optional().isIn(arr);
const optArr = (field: string) => body(field).optional().isArray();

/* ---------- domain literals ---------- */
const ACTIVITY_TYPES: readonly string[] = ['task', 'event', 'note', 'goal', 'habit', 'milestone'];
const ACTIVITY_STATUS: readonly string[] = [
    'pending',
    'in-progress',
    'completed',
    'cancelled',
    'archived',
];
const ACTIVITY_PRIORITY: readonly string[] = ['low', 'medium', 'high', 'urgent'];
const SORT_FIELDS: readonly string[] = [
    'dueDate',
    'priority',
    'createdAt',
    'updatedAt',
    'title',
    'order',
];
const SORT_ORDER: readonly string[] = ['asc', 'desc'];

export const activityValidation = {
    /* -------- CREATE -------- */
    createActivity: [
        param('sectionId').isUUID().withMessage('Invalid section UUID'),
        body('title').trim().isLength({ min: 1, max: 150 }).withMessage('Title 1–150 chars'),
        optStr('description', 2000),
        optEnum('type', ACTIVITY_TYPES),
        optEnum('status', ACTIVITY_STATUS),
        optEnum('priority', ACTIVITY_PRIORITY),
        optDate('dueDate'),
        optArr('tags'),
        optStr('assignee', 100),
        optArr('dependencies'),
        body('recurring').optional().isObject(),
        body('reminders').optional().isArray(),
        body('metadata').optional().isObject(),
    ],

    /* -------- UPDATE -------- */
    updateActivity: [
        uuid(),
        body('title').optional().trim().isLength({ min: 1, max: 150 }),
        optStr('description', 2000),
        optEnum('type', ACTIVITY_TYPES),
        optEnum('status', ACTIVITY_STATUS),
        optEnum('priority', ACTIVITY_PRIORITY),
        optDate('dueDate'),
        optArr('tags'),
        optStr('assignee', 100),
        optArr('dependencies'),
        body('recurring').optional().isObject(),
        body('reminders').optional().isArray(),
        body('metadata').optional().isObject(),
    ],

    /* -------- READ -------- */
    getActivity: [uuid()],
    deleteActivity: [uuid()],

    /* -------- LIST / FILTER -------- */
    listActivities: [
        query('sectionId').optional().isUUID(),
        query('plannerId').optional().isUUID(),
        query('status').optional().isArray(),
        query('status.*').optional().isIn(ACTIVITY_STATUS),
        query('priority').optional().isArray(),
        query('priority.*').optional().isIn(ACTIVITY_PRIORITY),
        query('type').optional().isArray(),
        query('type.*').optional().isIn(ACTIVITY_TYPES),
        query('tags').optional().isArray(),
        query('assignee').optional().isArray(),
        query('dueDateFrom').optional().isISO8601().toDate(),
        query('dueDateTo').optional().isISO8601().toDate(),
        query('completedFrom').optional().isISO8601().toDate(),
        query('completedTo').optional().isISO8601().toDate(),
        query('search').optional().trim().isLength({ max: 100 }),
        query('sortBy').optional().isIn(SORT_FIELDS),
        query('sortOrder').optional().isIn(SORT_ORDER),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],

    /* -------- BULK -------- */
    bulkUpdate: [
        body('activityIds').isArray({ min: 1 }).withMessage('activityIds array required'),
        body('activityIds.*').isUUID().withMessage('Each activity id must be UUID'),
        body('updates').isObject().withMessage('updates object required'),
    ],

    bulkDelete: [
        body('activityIds').isArray({ min: 1 }).withMessage('activityIds array required'),
        body('activityIds.*').isUUID().withMessage('Each activity id must be UUID'),
    ],

    reorderActivities: [
        body('activities').isArray({ min: 1 }).withMessage('activities array required'),
        body('activities.*.id').isUUID().withMessage('Each activity id must be UUID'),
        body('activities.*.order')
            .isInt({ min: 0 })
            .withMessage('Order must be a non-negative integer'),
    ],
};
