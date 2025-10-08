// src/modules/admin/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { AdminService } from './admin.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validateRequest } from '../../shared/middleware/validation.middleware';
import { requireAuth } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/rbac.middleware';
import { GetUsersDto, UpdateUserDto, BanUserDto, BulkActionDto, ExportUsersDto, UserResponseDto } from './dto/user-management.dto';
import { SystemStatsFilterDto, SystemHealthDto, PerformanceMetricsDto, AuditLogFilterDto, ConfigUpdateDto } from './dto/system-stats.dto';
import logger from '../../shared/utils/logger';

@injectable()
export class AdminController {
    constructor(
        @inject(AdminService) private adminService: AdminService
    ) { }

    /**
     * @desc   Get all users with filtering and pagination
     * @route  GET /api/v1/admin/users
     * @access Private (Admin only)
     */
    getUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const filter = await validateRequest(GetUsersDto, req.query);
        const result = await this.adminService.getAllUsers(filter, req.user!.uid);

        res.status(200).json({
            success: true,
            data: result.users,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                pages: Math.ceil(result.total / result.limit)
            }
        });
    });

    /**
     * @desc   Get user by ID
     * @route  GET /api/v1/admin/users/:id
     * @access Private (Admin only)
     */
    getUserById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const user = await this.adminService.getUserById(id, req.user!.uid);

        res.status(200).json({
            success: true,
            data: user
        });
    });

    /**
     * @desc   Update user
     * @route  PATCH /api/v1/admin/users/:id
     * @access Private (Admin only)
     */
    updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const updates = await validateRequest(UpdateUserDto, req.body);
        const updatedUser = await this.adminService.updateUser(id, updates, req.user!.uid);

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });
    });

    /**
     * @desc   Ban user
     * @route  POST /api/v1/admin/users/:id/ban
     * @access Private (Admin only)
     */
    banUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const banData = await validateRequest(BanUserDto, req.body);
        await this.adminService.banUser(id, banData, req.user!.uid);

        res.status(200).json({
            success: true,
            message: 'User banned successfully'
        });
    });

    /**
     * @desc   Unban user
     * @route  POST /api/v1/admin/users/:id/unban
     * @access Private (Admin only)
     */
    unbanUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        await this.adminService.unbanUser(id, req.user!.uid);

        res.status(200).json({
            success: true,
            message: 'User unbanned successfully'
        });
    });

    /**
     * @desc   Delete user
     * @route  DELETE /api/v1/admin/users/:id
     * @access Private (Admin only)
     */
    deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { softDelete = true } = req.query;
        await this.adminService.deleteUser(id, req.user!.uid, softDelete === 'true');

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    });

    /**
     * @desc   Restore user
     * @route  POST /api/v1/admin/users/:id/restore
     * @access Private (Admin only)
     */
    restoreUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        await this.adminService.restoreUser(id, req.user!.uid);

        res.status(200).json({
            success: true,
            message: 'User restored successfully'
        });
    });

    /**
     * @desc   Bulk actions on users
     * @route  POST /api/v1/admin/users/bulk-action
     * @access Private (Admin only)
     */
    bulkAction = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const actionData = await validateRequest(BulkActionDto, req.body);
        const result = await this.adminService.bulkAction(actionData, req.user!.uid);

        res.status(200).json({
            success: true,
            message: `Bulk action completed. ${result.success} successful, ${result.failed} failed`,
            data: result
        });
    });

    /**
     * @desc   Export users
     * @route  POST /api/v1/admin/users/export
     * @access Private (Admin only)
     */
    exportUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const exportData = await validateRequest(ExportUsersDto, req.body);

        // This would typically generate a file and return a download URL
        // For now, we'll return a placeholder response
        res.status(200).json({
            success: true,
            message: 'User export initiated',
            data: {
                exportId: `export_${Date.now()}`,
                format: exportData.format,
                status: 'processing'
            }
        });
    });

    /**
     * @desc   Get user statistics
     * @route  GET /api/v1/admin/stats/users
     * @access Private (Admin only)
     */
    getUserStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const stats = await this.adminService.getUserStats(req.user!.uid);

        res.status(200).json({
            success: true,
            data: stats
        });
    });

    /**
     * @desc   Get system statistics
     * @route  GET /api/v1/admin/stats/system
     * @access Private (Admin only)
     */
    getSystemStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const filter = await validateRequest(SystemStatsFilterDto, req.query);
        const stats = await this.adminService.getSystemStats(req.user!.uid);

        res.status(200).json({
            success: true,
            data: stats
        });
    });

    /**
     * @desc   Get system health
     * @route  GET /api/v1/admin/health
     * @access Private (Admin only)
     */
    getSystemHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const options = await validateRequest(SystemHealthDto, req.query);

        // This would check various system components
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {
                database: { status: 'healthy', responseTime: 45 },
                redis: { status: 'healthy', responseTime: 12 },
                externalServices: {
                    firebase: { status: 'healthy', responseTime: 89 },
                    emailService: { status: 'healthy', responseTime: 234 }
                }
            }
        };

        res.status(200).json({
            success: true,
            data: health
        });
    });

    /**
     * @desc   Get performance metrics
     * @route  GET /api/v1/admin/metrics/performance
     * @access Private (Admin only)
     */
    getPerformanceMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const filter = await validateRequest(PerformanceMetricsDto, req.query);

        // This would fetch metrics from monitoring service
        const metrics = {
            component: filter.component || 'api',
            metric: filter.metric || 'response_time',
            data: [
                { timestamp: new Date().toISOString(), value: 145 },
                { timestamp: new Date(Date.now() - 3600000).toISOString(), value: 132 },
                { timestamp: new Date(Date.now() - 7200000).toISOString(), value: 158 }
            ],
            average: 145,
            trend: 'stable'
        };

        res.status(200).json({
            success: true,
            data: metrics
        });
    });

    /**
     * @desc   Get admin audit logs
     * @route  GET /api/v1/admin/logs
     * @access Private (Admin only)
     */
    getAdminLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const filter = await validateRequest(AuditLogFilterDto, req.query);
        const logs = await this.adminService.getAdminLogs(req.user!.uid, filter.limit);

        res.status(200).json({
            success: true,
            data: logs
        });
    });

    /**
     * @desc   Get system configuration
     * @route  GET /api/v1/admin/config
     * @access Private (Admin only)
     */
    getSystemConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const config = await this.adminService.getSystemConfig(req.user!.uid);

        res.status(200).json({
            success: true,
            data: config
        });
    });

    /**
     * @desc   Update system configuration
     * @route  PATCH /api/v1/admin/config
     * @access Private (Admin only)
     */
    updateSystemConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const updates = await validateRequest(ConfigUpdateDto, req.body);
        const updatedConfig = await this.adminService.updateSystemConfig(req.user!.uid, updates);

        res.status(200).json({
            success: true,
            message: 'System configuration updated successfully',
            data: updatedConfig
        });
    });

    /**
     * @desc   Create system backup
     * @route  POST /api/v1/admin/backup
     * @access Private (Admin only)
     */
    createBackup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { type = 'full' } = req.body;

        // This would trigger a backup process
        res.status(202).json({
            success: true,
            message: 'Backup creation initiated',
            data: {
                backupId: `backup_${Date.now()}`,
                type,
                status: 'processing',
                estimatedTime: '10 minutes'
            }
        });
    });

    /**
     * @desc   Get backup list
     * @route  GET /api/v1/admin/backups
     * @access Private (Admin only)
     */
    getBackups = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        // This would return list of available backups
        const backups = [
            {
                id: 'backup_1234567890',
                type: 'full',
                size: '2.3 GB',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                status: 'completed'
            },
            {
                id: 'backup_1234567891',
                type: 'incremental',
                size: '156 MB',
                createdAt: new Date(Date.now() - 43200000).toISOString(),
                status: 'completed'
            }
        ];

        res.status(200).json({
            success: true,
            data: backups
        });
    });

    /**
     * @desc   Restore from backup
     * @route  POST /api/v1/admin/restore/:backupId
     * @access Private (Admin only)
     */
    restoreBackup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { backupId } = req.params;

        // This would trigger a restore process
        res.status(202).json({
            success: true,
            message: 'Restore process initiated',
            data: {
                restoreId: `restore_${Date.now()}`,
                backupId,
                status: 'processing',
                estimatedTime: '30 minutes'
            }
        });
    });
}