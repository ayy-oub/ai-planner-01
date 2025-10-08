import { Router } from 'express';
import { container } from 'tsyringe';
import { AdminController } from './admin.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { requirePermission } from '../auth/auth.middleware';
import { validationMiddleware } from '../../shared/middleware/validation.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware';

const router = Router();
const adminController = container.resolve(AdminController);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations
 */

// All routes require authentication and admin permissions
router.use(authMiddleware());
router.use(requirePermission('admin.access'));

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Admin permission required
 */
router.get('/admin/users',
    validationMiddleware(adminController.adminValidation.listUsers),
    adminController.listUsers
);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       403:
 *         description: Admin permission required
 *       404:
 *         description: User not found
 */
router.get('/admin/users/:id',
    validationMiddleware(adminController.adminValidation.getUser),
    adminController.getUser
);

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               role:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: User updated successfully
 *       403:
 *         description: Admin permission required
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:id',
    validationMiddleware(adminController.adminValidation.updateUser),
    adminController.updateUser
);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   post:
 *     summary: Suspend user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               duration:
 *                 type: string
 *     responses:
 *       200:
 *         description: User suspended successfully
 *       403:
 *         description: Admin permission required
 *       404:
 *         description: User not found
 */
router.post('/admin/users/:id/suspend',
    validationMiddleware(adminController.adminValidation.suspendUser),
    adminController.suspendUser
);

/**
 * @swagger
 * /admin/users/{id}/reactivate:
 *   post:
 *     summary: Reactivate user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       403:
 *         description: Admin permission required
 *       404:
 *         description: User not found
 */
router.post('/admin/users/:id/reactivate',
    validationMiddleware(adminController.adminValidation.reactivateUser),
    adminController.reactivateUser
);

/**
 * @swagger
 * /admin/users/{id}/delete:
 *   delete:
 *     summary: Delete user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               backupData:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Admin permission required
 *       404:
 *         description: User not found
 */
router.delete('/admin/users/:id',
    validationMiddleware(adminController.adminValidation.deleteUser),
    adminController.deleteUser
);

/**
 * @swagger
 * /admin/system/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       403:
 *         description: Admin permission required
 */
router.get('/admin/system/stats', adminController.getSystemStats);

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *       403:
 *         description: Admin permission required
 */
router.get('/admin/system/health', adminController.getSystemHealth);

/**
 * @swagger
 * /admin/system/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *       403:
 *         description: Admin permission required
 */
router.get('/admin/system/logs',
    validationMiddleware(adminController.adminValidation.getLogs),
    adminController.getLogs
);

/**
 * @swagger
 * /admin/system/backup:
 *   post:
 *     summary: Create system backup
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [full, users, data]
 *               exclude:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       403:
 *         description: Admin permission required
 */
router.post('/admin/system/backup',
    validationMiddleware(adminController.adminValidation.createBackup),
    adminController.createBackup
);

/**
 * @swagger
 * /admin/system/maintenance:
 *   post:
 *     summary: Toggle maintenance mode
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *               message:
 *                 type: string
 *               allowedRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Maintenance mode toggled successfully
 *       403:
 *         description: Admin permission required
 */
router.post('/admin/system/maintenance',
    validationMiddleware(adminController.adminValidation.toggleMaintenance),
    adminController.toggleMaintenance
);

export default router;