import { Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { HealthService } from './health.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse, PaginationInfo } from '../../shared/utils/api-response';
import { AuthRequest } from '../../modules/auth/auth.types';
import { logger } from '../../shared/utils/logger';

@injectable()
export class HealthController {
    constructor(@inject('HealthService') private readonly healthService: HealthService) { }

    /* =========================================================
       Basic Health
    ========================================================= */
    getHealth = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const detailed = req.query.detailed === 'true';
            const status = await this.healthService.getHealthStatus(detailed);
            res.json(new ApiResponse(req).success(status, 'Health status retrieved successfully'));
        } catch (err) {
            logger.error('Get health controller error:', err);
            next(err);
        }
    });

    getDetailedHealth = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const report = await this.healthService.getHealthReport();
            res.json(new ApiResponse(req).success(report, 'Detailed health report retrieved successfully'));
        } catch (err) {
            logger.error('Get detailed health controller error:', err);
            next(err);
        }
    });

    getReadiness = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const readiness = await this.healthService.getReadiness();
            res.json(new ApiResponse(req).success(readiness, 'Readiness status retrieved successfully'));
        } catch (err) {
            logger.error('Get readiness controller error:', err);
            next(err);
        }
    });

    getLiveness = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const liveness = await this.healthService.getLiveness();
            res.json(new ApiResponse(req).success(liveness, 'Liveness status retrieved successfully'));
        } catch (err) {
            logger.error('Get liveness controller error:', err);
            next(err);
        }
    });

    getMetrics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const metrics = await this.healthService.getSystemMetrics();
            res.json(new ApiResponse(req).success(metrics, 'System metrics retrieved successfully'));
        } catch (err) {
            logger.error('Get metrics controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Health History & Reports
    ========================================================= */
    getHistory = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate, service, limit = 50, offset = 0 } = req.query as any;
            const history = await this.healthService.getHealthHistory(
                new Date(startDate),
                new Date(endDate),
                service
            );
            const paginated = history.slice(offset, offset + limit);
            const page = Math.floor(offset / limit) + 1;
            const totalPages = Math.ceil(history.length / limit);
            const hasNext = page < totalPages;
            const hasPrev = page > 1;

            const pagination: PaginationInfo = {
                page,
                limit,
                total: history.length,
                pages: totalPages,
                hasNext,
                hasPrev,
            };

            res.json(new ApiResponse(req).paginated(paginated, pagination));


        } catch (err) {
            logger.error('Get health history controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Health Alerts
    ========================================================= */
    getAlerts = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { acknowledged, resolved, severity, limit = 20, offset = 0 } = req.query as any;
            const alerts = await this.healthService.getHealthAlerts(
                acknowledged,
                resolved,
                severity
            );
            const paginated = alerts.slice(offset, offset + limit);
            const page = Math.floor(offset / limit) + 1;
            const totalPages = Math.ceil(alerts.length / limit);
            const hasNext = page < totalPages;
            const hasPrev = page > 1;

            const pagination: PaginationInfo = {
                page,
                limit,
                total: alerts.length,
                pages: totalPages,
                hasNext,
                hasPrev,
            };

            res.json(new ApiResponse(req).paginated(paginated, pagination));

        } catch (err) {
            logger.error('Get health alerts controller error:', err);
            next(err);
        }
    });

    acknowledgeAlert = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { alertId } = req.params;
            await this.healthService.acknowledgeAlert(alertId, req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Alert acknowledged successfully'));
        } catch (err) {
            logger.error('Acknowledge alert controller error:', err);
            next(err);
        }
    });

    resolveAlert = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { alertId } = req.params;
            await this.healthService.resolveAlert(alertId, req.user!.uid);
            res.json(new ApiResponse(req).success(null, 'Alert resolved successfully'));
        } catch (err) {
            logger.error('Resolve alert controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Run Health Check
    ========================================================= */
    runCheck = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { checkName } = req.params;
            const result = await this.healthService.runHealthCheck(checkName);
            res.json(new ApiResponse(req).success(result, 'Health check executed successfully'));
        } catch (err) {
            logger.error('Run health check controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Health Stats (admin)
    ========================================================= */
    getStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate } = req.query as any;
            const stats = await this.healthService.getHealthStats(new Date(startDate), new Date(endDate));
            res.json(new ApiResponse(req).success(stats, 'Health stats retrieved successfully'));
        } catch (err) {
            logger.error('Get health stats controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Register Custom Health Check (admin)
    ========================================================= */
    registerCheck = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const checkData = req.body;
            // optionally store in service for custom checks
            await this.healthService.registerCustomCheck(checkData);
            res.json(new ApiResponse(req).success(null, `Health check '${checkData.name}' registered successfully`));
        } catch (err) {
            logger.error('Register custom check controller error:', err);
            next(err);
        }
    });
}
