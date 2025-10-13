import { Router } from 'express';
import { AdminController } from './admin.controller';
import { validate } from '../../shared/middleware/validation.middleware';
import { authenticate, requireRoles } from '../../shared/middleware/auth.middleware';
import adminValidations from './admin.validation';
import { container } from 'tsyringe';

const router = Router();
const adminController = container.resolve(AdminController);
/* =================================================================
   USER MANAGEMENT
================================================================= */

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users (paginated & filtered)
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, banned, deleted] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/users',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getUsers),
    adminController.getUsers
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get single user by id
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/users/:id',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getUserById),
    adminController.getUserById
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [user, admin] }
 *               subscriptionPlan: { type: string }
 *               emailVerified: { type: boolean }
 *               isBanned: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch(
    '/users/:id',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.updateUser),
    adminController.updateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   post:
 *     summary: Ban a user
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *               durationDays: { type: integer, minimum: 1, maximum: 365 }
 *     responses:
 *       200:
 *         description: Banned
 */
router.post(
    '/users/:id/ban',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.banUser),
    adminController.banUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/unban:
 *   post:
 *     summary: Unban a user
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Unbanned
 */
router.post(
    '/users/:id/unban',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.unbanUser),
    adminController.unbanUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete (or soft-delete) a user
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: softDelete
 *         schema: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
    '/users/:id',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.deleteUser),
    adminController.deleteUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted user
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Restored
 */
router.post(
    '/users/:id/restore',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.restoreUser),
    adminController.restoreUser
);

/**
 * @swagger
 * /api/v1/admin/users/bulk-action:
 *   post:
 *     summary: Bulk action on many users
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds: { type: array, items: { type: string } }
 *               action:
 *                 type: string
 *                 enum: [ban, unban, delete, restore, change-role, change-subscription]
 *               newRole: { type: string, enum: [user, admin] }
 *               newSubscriptionPlan: { type: string }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Action completed
 */
router.post(
    '/users/bulk-action',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.bulkAction),
    adminController.bulkAction
);

/**
 * @swagger
 * /api/v1/admin/users/export:
 *   post:
 *     summary: Export users list
 *     tags: [Admin – Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, json, xlsx] }
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [all, active, inactive, banned, deleted] }
 *     responses:
 *       200:
 *         description: Export initiated
 */
router.post(
    '/users/export',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.exportUsers),
    adminController.exportUsers
);

/* =================================================================
   STATISTICS
================================================================= */

/**
 * @swagger
 * /api/v1/admin/stats/users:
 *   get:
 *     summary: User statistics
 *     tags: [Admin – Stats]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/stats/users',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getUserStats),
    adminController.getUserStats
);

/**
 * @swagger
 * /api/v1/admin/stats/system:
 *   get:
 *     summary: System statistics
 *     tags: [Admin – Stats]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [hourly, daily, weekly, monthly] }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/stats/system',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getSystemStats),
    adminController.getSystemStats
);

/* =================================================================
   HEALTH & METRICS
================================================================= */

/**
 * @swagger
 * /api/v1/admin/health:
 *   get:
 *     summary: System health check
 *     tags: [Admin – System]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: includeDependencies
 *         schema: { type: boolean }
 *       - in: query
 *         name: timeout
 *         schema: { type: integer, minimum: 1, maximum: 300 }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/health',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getSystemHealth),
    adminController.getSystemHealth
);

/**
 * @swagger
 * /api/v1/admin/metrics/performance:
 *   get:
 *     summary: Performance metrics
 *     tags: [Admin – System]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: component
 *         schema: { type: string, enum: [api, database, cache, external] }
 *       - in: query
 *         name: metric
 *         schema: { type: string, enum: [response_time, error_rate, throughput, availability] }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/metrics/performance',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getPerformanceMetrics),
    adminController.getPerformanceMetrics
);

/* =================================================================
   AUDIT LOGS
================================================================= */

/**
 * @swagger
 * /api/v1/admin/logs:
 *   get:
 *     summary: Admin audit logs
 *     tags: [Admin – Audit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: adminId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: targetType
 *         schema: { type: string, enum: [user, system, data] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 1000 }
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/logs',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getAdminLogs),
    adminController.getAdminLogs
);

/* =================================================================
   SYSTEM CONFIG
================================================================= */

/**
 * @swagger
 * /api/v1/admin/config:
 *   get:
 *     summary: Get system configuration
 *     tags: [Admin – Config]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/config',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getSystemConfig),
    adminController.getSystemConfig
);

/**
 * @swagger
 * /api/v1/admin/config:
 *   patch:
 *     summary: Update system configuration
 *     tags: [Admin – Config]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode: { type: boolean }
 *               allowRegistration: { type: boolean }
 *               requireEmailVerification: { type: boolean }
 *               defaultUserRole: { type: string, enum: [user, admin] }
 *               rateLimits: { type: object }
 *               fileUpload: { type: object }
 *               email: { type: object }
 *               ai: { type: object }
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch(
    '/config',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.updateSystemConfig),
    adminController.updateSystemConfig
);

/* =================================================================
   MAINTENANCE TOGGLE (single-purpose route)
================================================================= */

/**
 * @swagger
 * /api/v1/admin/system/maintenance:
 *   post:
 *     summary: Toggle maintenance mode on/off
 *     tags: [Admin – System]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enable:
 *                 type: boolean
 *                 description: true = turn on, false = turn off
 *     responses:
 *       200:
 *         description: Mode toggled
 */
router.post(
    '/system/maintenance',
    authenticate,
    requireRoles('admin'),
    adminController.toggleMaintenance
);

/* =================================================================
   BACKUPS
================================================================= */

/**
 * @swagger
 * /api/v1/admin/backup:
 *   post:
 *     summary: Create a system backup
 *     tags: [Admin – Backups]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [full, incremental, users, planners] }
 *     responses:
 *       202:
 *         description: Backup initiated
 */
router.post(
    '/backup',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.createBackup),
    adminController.createBackup
);

/**
 * @swagger
 * /api/v1/admin/backups:
 *   get:
 *     summary: List available backups
 *     tags: [Admin – Backups]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OK
 */
router.get(
    '/backups',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.getBackups),
    adminController.getBackups
);

/**
 * @swagger
 * /api/v1/admin/restore/{backupId}:
 *   post:
 *     summary: Restore from backup
 *     tags: [Admin – Backups]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202:
 *         description: Restore initiated
 */
router.post(
    '/restore/:backupId',
    authenticate,
    requireRoles('admin'),
    validate(adminValidations.restoreBackup),
    adminController.restoreBackup
);

export default router;