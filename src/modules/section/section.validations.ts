// src/modules/section/section.validation.ts
import { body, param, query } from 'express-validator';

/* ---------- shared helpers ---------- */
const uuid = () => param('id').isUUID().withMessage('Invalid UUID');
const plannerUuid = () => param('plannerId').isUUID().withMessage('Invalid planner UUID');
const optStr = (max: number) => body().optional().trim().isLength({ max });
const optBool = () => body().optional().isBoolean();
const optEnum = <T extends readonly string[]>(arr: T) => body().optional().isIn(arr);

/* ---------- domain literals ---------- */
const SECTION_TYPES: readonly string[] = ['tasks', 'notes', 'goals', 'habits', 'milestones'];
const VISIBILITY: readonly string[] = ['visible', 'hidden', 'collapsed'];
const SORT_FIELDS: readonly string[] = ['order', 'title', 'createdAt', 'updatedAt', 'lastActivityAt'];
const SORT_ORDER: readonly string[] = ['asc', 'desc'];
const ACTIVITY_TYPES: readonly string[] = ['task', 'event', 'note', 'goal', 'habit', 'milestone']; // from activity.types

export const sectionValidations = {
    /* -------- CRUD -------- */
    createSection: [
        plannerUuid(),
        body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title 1-100 chars'),
        body('description').optional().trim().isLength({ max: 500 }),
        body('type').isIn(SECTION_TYPES),
        body('order').optional().isInt({ min: 0 }),
        body('settings').optional().isObject(),
        body('settings.collapsed').optional().isBoolean(),
        body('settings.color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Hex color required'),
        body('settings.icon').optional().trim().isLength({ max: 50 }),
        body('settings.visibility').optional().isIn(VISIBILITY),
        body('settings.maxActivities').optional().isInt({ min: 1 }),
        body('settings.autoArchiveCompleted').optional().isBoolean(),
        body('settings.defaultActivityType').optional().isIn(ACTIVITY_TYPES),
    ],

    updateSection: [
        uuid(),
        body('title').optional().trim().isLength({ min: 1, max: 100 }),
        body('description').optional().trim().isLength({ max: 500 }),
        body('order').optional().isInt({ min: 0 }),
        body('settings').optional().isObject(),
        body('settings.collapsed').optional().isBoolean(),
        body('settings.color').optional().matches(/^#[0-9A-F]{6}$/i),
        body('settings.icon').optional().trim().isLength({ max: 50 }),
        body('settings.visibility').optional().isIn(VISIBILITY),
        body('settings.maxActivities').optional().isInt({ min: 1 }),
        body('settings.autoArchiveCompleted').optional().isBoolean(),
        body('settings.defaultActivityType').optional().isIn(ACTIVITY_TYPES),
    ],

    getSection: [uuid()],
    deleteSection: [uuid()],

    listSections: [
        plannerUuid(),
        query('type').optional().isArray(),
        query('type.*').optional().isIn(SECTION_TYPES),
        query('search').optional().trim().isLength({ max: 100 }),
        query('sortBy').optional().isIn(SORT_FIELDS),
        query('sortOrder').optional().isIn(SORT_ORDER),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],

    /* -------- ACTIONS -------- */
    reorderSections: [
        plannerUuid(),
        body('sections').isArray({ min: 1 }).withMessage('Sections array required'),
        body('sections.*.id').isUUID().withMessage('Each section id must be UUID'),
        body('sections.*.order').isInt({ min: 0 }).withMessage('Order must be non-negative integer'),
    ],

    getSectionStatistics: [uuid()],
};