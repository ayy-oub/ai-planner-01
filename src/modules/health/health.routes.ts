import { Router } from 'express';
import { container } from 'tsyringe';
import { HealthController } from './health.controller';
import { asyncHandler } from '../../shared/utils/async-handler';

const router = Router();
const healthController = container.resolve(HealthController);

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check and system status
 */

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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     version:
 *                       type: string
 */
router.get('/health', asyncHandler(healthController.getHealth));

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *       503:
 *         description: Some services are unhealthy
 */
router.get('/health/detailed', asyncHandler(healthController.getDetailedHealth));

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
router.get('/health/ready', asyncHandler(healthController.getReadiness));

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
router.get('/health/live', asyncHandler(healthController.getLiveness));

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get system metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/health/metrics', asyncHandler(healthController.getMetrics));

export default router;