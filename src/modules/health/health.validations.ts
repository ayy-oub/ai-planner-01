// src/modules/health/health.validation.ts
import { query, param, body } from 'express-validator';

export const healthValidations = {
    // 🏥 Basic health endpoints

    getHealth: [], // No parameters for basic health

    getDetailedHealth: [
        query('includeDependencies').optional().isBoolean().toBoolean(),
        query('timeout').optional().isInt({ min: 1, max: 300 })
    ],

    getReadiness: [], // Typically no params
    getLiveness: [],  // Typically no params

    getMetrics: [
        query('component').optional().isIn(['api', 'database', 'cache', 'external', 'queue']),
        query('metric').optional().isIn(['response_time', 'error_rate', 'throughput', 'availability'])
    ],

    // 📝 Health Reports
    exportHealthReport: [
        query('format').optional().isIn(['json', 'csv']),
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601()
    ],

    // 🔔 Health Alerts
    getAlerts: [
        query('status').optional().isIn(['acknowledged', 'unacknowledged', 'resolved']),
        query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
        query('service').optional().isString(),
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],

    acknowledgeAlert: [
        param('alertId').isString().notEmpty(),
        body('acknowledgedBy').isString().notEmpty()
    ],

    resolveAlert: [
        param('alertId').isString().notEmpty(),
        body('resolvedBy').isString().notEmpty()
    ],

    // 📜 Health History
    getHistory: [
        query('dateFrom').optional().isISO8601(),
        query('dateTo').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],

    // ⚙️ Configuration / thresholds (if you have endpoints to update)
    updateHealthConfig: [
        body('checks').optional().isObject(),
        body('thresholds').optional().isObject(),
        body('alerting').optional().isObject(),
        body('history').optional().isObject()
    ]
};

export default healthValidations;
