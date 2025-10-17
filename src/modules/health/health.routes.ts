// src/modules/health/health.routes.ts
import { Router } from 'express';
;
import { asyncHandler } from '../../shared/utils/async-handler';
import { authenticate, requireRoles } from '@/shared/middleware/auth.middleware';
import healthValidations from './health.validations';
import { validate } from '@/shared/middleware/validation.middleware';
import { healthController as healthControll} from '@/shared/container';

const router = Router();
const healthController = healthControll;

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check and system status
 */

// 🏥 Basic Health Checks
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatusResponseDto'
 */
router.get(
    '/health',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getHealth),
    asyncHandler(healthController.getHealth)
);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with dependencies
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: includeDependencies
 *         schema:
 *           type: boolean
 *         description: Include external services and database checks
 *       - in: query
 *         name: timeout
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 300
 *         description: Timeout for health checks in seconds
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatusResponseDto'
 *       503:
 *         description: Some services are unhealthy
 */
router.get(
    '/health/detailed',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getDetailedHealth),
    asyncHandler(healthController.getDetailedHealth)
);

// 🔹 Readiness Probe
/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get(
    '/health/ready',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getReadiness),
    asyncHandler(healthController.getReadiness)
);

// 🔹 Liveness Probe
/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get(
    '/health/live',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getLiveness),
    asyncHandler(healthController.getLiveness)
);

// 📊 Metrics
/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get system metrics
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: component
 *         schema:
 *           type: string
 *           enum: [api, database, cache, external, queue]
 *         description: Component to get metrics for
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [response_time, error_rate, throughput, availability]
 *         description: Specific metric to retrieve
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get(
    '/health/metrics',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getMetrics),
    asyncHandler(healthController.getMetrics)
);

// 📜 Health History
/**
 * @swagger
 * /health/history:
 *   get:
 *     summary: Get health check history
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of history records to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: Health history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthHistoryResponseDto'
 */
router.get(
    '/health/history',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getHistory),
    asyncHandler(healthController.getHistory)
  );
  
  // 📜 Health Alerts
  /**
   * @swagger
   * /health/alerts:
   *   get:
   *     summary: Get all current health alerts
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Health alerts retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthAlertsResponseDto'
   */
  router.get(
    '/health/alerts',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.getAlerts),
    asyncHandler(healthController.getAlerts)
  );
  
  /**
   * @swagger
   * /health/alerts/{alertId}/acknowledge:
   *   post:
   *     summary: Acknowledge a health alert
   *     tags: [Health]
   *     parameters:
   *       - in: path
   *         name: alertId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the alert to acknowledge
   *     responses:
   *       200:
   *         description: Alert acknowledged successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: string
   */
  router.post(
    '/health/alerts/:alertId/acknowledge',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.acknowledgeAlert),
    asyncHandler(healthController.acknowledgeAlert)
  );
  
  /**
   * @swagger
   * /health/alerts/{alertId}/resolve:
   *   post:
   *     summary: Resolve a health alert
   *     tags: [Health]
   *     parameters:
   *       - in: path
   *         name: alertId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the alert to resolve
   *     responses:
   *       200:
   *         description: Alert resolved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: string
   */
  router.post(
    '/health/alerts/:alertId/resolve',
    authenticate,
    requireRoles('admin'),
    validate(healthValidations.resolveAlert),
    asyncHandler(healthController.resolveAlert)
  );  

export default router;
