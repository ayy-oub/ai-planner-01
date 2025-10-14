import { body, param, query } from 'express-validator';

const uuid = () => param('id').isUUID().withMessage('Invalid UUID');
const optStr = (max: number) => body().optional().trim().isLength({ max });
const optBool = () => body().optional().isBoolean();
const optEnum = <T extends readonly string[]>(arr: T) => body().optional().isIn(arr);
const ROLES: readonly string[] = ['viewer', 'editor', 'admin'];

export const plannerValidations = {
  /* -------- CRUD -------- */
  createPlanner: [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title 1-100 chars'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Hex color required'),
    body('icon').optional().trim().isLength({ max: 50 }),
    body('settings').optional().isObject(),
    body('settings.isPublic').optional().isBoolean(),
    body('settings.allowCollaboration').optional().isBoolean(),
    body('settings.autoArchive').optional().isBoolean(),
    body('settings.reminderEnabled').optional().isBoolean(),
    body('settings.defaultView').optional().isIn(['grid', 'list', 'calendar']),
    body('settings.theme').optional().isIn(['light', 'dark', 'auto']),
    body('tags').optional().isArray(),
    body('tags.*').trim().isLength({ max: 30 }),
  ],

  updatePlanner: [
    uuid(),
    body('title').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i),
    body('icon').optional().trim().isLength({ max: 50 }),
    body('settings').optional().isObject(),
    body('tags').optional().isArray(),
    body('tags.*').trim().isLength({ max: 30 }),
  ],

  getPlanner: [uuid()],
  deletePlanner: [uuid()],
  listPlanners: [
    query('search').optional().trim().isLength({ max: 100 }),
    query('tags').optional().isArray(),
    query('tags.*').trim().isLength({ max: 30 }),
    query('isArchived').optional().isBoolean(),
    query('isPublic').optional().isBoolean(),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'title', 'lastActivityAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],

  /* -------- COLLAB -------- */
  sharePlanner: [
    uuid(),
    body('email').isEmail().normalizeEmail(),
    body('role').isIn(ROLES),
    body('message').optional().trim().isLength({ max: 500 }),
  ],
  removeCollaborator: [uuid(), param('userId').isUUID().withMessage('Invalid user UUID')],

  /* -------- ACTIONS -------- */
  duplicatePlanner: [
    uuid(),
    body('title').optional().trim().isLength({ min: 1, max: 100 }),
    body('includeActivities').optional().isBoolean(),
    body('includeSections').optional().isBoolean(),
  ],

  exportPlanner: [
    uuid(),
    body('format').isIn(['pdf', 'json', 'csv', 'ics']),
    body('includeSections').optional().isArray(),
    body('includeSections.*').isUUID(),
    body('includeActivities').optional().isBoolean(),
    body('dateRange').optional().isObject(),
    body('dateRange.start').optional().isISO8601(),
    body('dateRange.end').optional().isISO8601(),
    body('template').optional().trim().isLength({ max: 100 }),
  ],

  importPlanner: [
    body('format').isIn(['json', 'csv']),
    body('data').isObject(),
    body('options').optional().isObject(),
    body('options.overwrite').optional().isBoolean(),
    body('options.skipDuplicates').optional().isBoolean(),
    body('options.mapFields').optional().isObject(),
  ],

  archivePlanner: [uuid()],
  unarchivePlanner: [uuid()],

  /* -------- ANALYTICS -------- */
  getPlannerStatistics: [uuid()],
  getAISuggestions: [uuid()],
};