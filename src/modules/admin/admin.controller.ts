import { Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../../modules/auth/auth.types';
import { logger } from '../../shared/utils/logger';

export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /* =========================================================
        User management
    ========================================================= */

    getUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.adminService.getAllUsers(req.query, req.user!.uid);
            const response = new ApiResponse(req).success(
                {
                    users: result.users,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit,
                        pages: Math.ceil(result.total / result.limit),
                    },
                },
                'Users retrieved successfully'
            );
            res.json(response);
        } catch (err) {
            logger.error('Get users controller error:', err);
            next(err);
        }
    });

    getUserById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = await this.adminService.getUserById(req.params.id, req.user!.uid);
            const response = new ApiResponse(req).success(user, 'User retrieved successfully');
            res.json(response);
        } catch (err) {
            logger.error('Get user by ID controller error:', err);
            next(err);
        }
    });

    updateUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const updated = await this.adminService.updateUser(req.params.id, req.body, req.user!.uid);
            const response = new ApiResponse(req).success(updated, 'User updated successfully');
            res.json(response);
        } catch (err) {
            logger.error('Update user controller error:', err);
            next(err);
        }
    });

    banUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.adminService.banUser(req.params.id, req.body, req.user!.uid);
            const response = new ApiResponse(req).success(null, 'User banned successfully');
            res.json(response);
        } catch (err) {
            logger.error('Ban user controller error:', err);
            next(err);
        }
    });

    unbanUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.adminService.unbanUser(req.params.id, req.user!.uid);
            const response = new ApiResponse(req).success(null, 'User unbanned successfully');
            res.json(response);
        } catch (err) {
            logger.error('Unban user controller error:', err);
            next(err);
        }
    });

    deleteUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const softDelete = req.query.softDelete !== 'false';
            await this.adminService.deleteUser(req.params.id, req.user!.uid, softDelete);
            const response = new ApiResponse(req).success(null, 'User deleted successfully');
            res.json(response);
        } catch (err) {
            logger.error('Delete user controller error:', err);
            next(err);
        }
    });

    restoreUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.adminService.restoreUser(req.params.id, req.user!.uid);
            const response = new ApiResponse(req).success(null, 'User restored successfully');
            res.json(response);
        } catch (err) {
            logger.error('Restore user controller error:', err);
            next(err);
        }
    });

    bulkAction = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.adminService.bulkAction(req.body, req.user!.uid);
            const response = new ApiResponse(req).success(
                result,
                `Bulk action completed. ${result.success} successful, ${result.failed} failed`
            );
            res.json(response);
        } catch (err) {
            logger.error('Bulk action controller error:', err);
            next(err);
        }
    });

    exportUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            // real implementation would stream a file or return a download URL
            const data = {
                exportId: `export_${Date.now()}`,
                format: req.body.format ?? 'csv',
                status: 'processing',
            };
            const response = new ApiResponse(req).success(data, 'User export initiated');
            res.json(response);
        } catch (err) {
            logger.error('Export users controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Statistics
    ========================================================= */

    getUserStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const stats = await this.adminService.getUserStats(req.user!.uid);
            const response = new ApiResponse(req).success(stats, 'User statistics retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get user stats controller error:', err);
            next(err);
        }
    });

    getSystemStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const stats = await this.adminService.getSystemStats(req.user!.uid);
            const response = new ApiResponse(req).success(stats, 'System statistics retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get system stats controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Health / Metrics
    ========================================================= */

    getSystemHealth = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const health = await this.adminService.getSystemHealth();
            const response = new ApiResponse(req).success(health, 'System health retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get system health controller error:', err);
            next(err);
        }
    });

    getPerformanceMetrics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const metrics = await this.adminService.getPerformanceMetrics(req.query);
            const response = new ApiResponse(req).success(metrics, 'Performance metrics retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get performance metrics controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Audit & Config
    ========================================================= */

    getAdminLogs = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const logs = await this.adminService.getAdminLogs(req.user!.uid, Number(req.query.limit) || 100);
            const response = new ApiResponse(req).success(logs, 'Admin audit logs retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get admin logs controller error:', err);
            next(err);
        }
    });

    getSystemConfig = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const config = await this.adminService.getSystemConfig(req.user!.uid);
            const response = new ApiResponse(req).success(config, 'System configuration retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get system config controller error:', err);
            next(err);
        }
    });

    updateSystemConfig = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const updated = await this.adminService.updateSystemConfig(req.user!.uid, req.body);
            const response = new ApiResponse(req).success(updated, 'System configuration updated');
            res.json(response);
        } catch (err) {
            logger.error('Update system config controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Backups
    ========================================================= */

    createBackup = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const job = await this.adminService.initiateBackup(req.body.type ?? 'full', req.user!.uid);
            const response = new ApiResponse(req).success(job, 'Backup initiated');
            res.status(202).json(response);
        } catch (err) {
            logger.error('Create backup controller error:', err);
            next(err);
        }
    });

    getBackups = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const list = await this.adminService.listBackups();
            const response = new ApiResponse(req).success(list, 'Backup list retrieved');
            res.json(response);
        } catch (err) {
            logger.error('Get backups controller error:', err);
            next(err);
        }
    });

    restoreBackup = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const job = await this.adminService.initiateRestore(req.params.backupId, req.user!.uid);
            const response = new ApiResponse(req).success(job, 'Restore initiated');
            res.status(202).json(response);
        } catch (err) {
            logger.error('Restore backup controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       Maintenance
    ========================================================= */

    toggleMaintenance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const updated = await this.adminService.setMaintenanceMode(!!req.body.enable, req.user!.uid);
            const response = new ApiResponse(req).success(
                updated,
                `Maintenance mode ${updated.maintenanceMode ? 'enabled' : 'disabled'}`
            );
            res.json(response);
        } catch (err) {
            logger.error('Toggle maintenance controller error:', err);
            next(err);
        }
    });
}