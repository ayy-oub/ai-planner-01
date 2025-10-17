// src/modules/export/export.controller.ts
import { Response, NextFunction } from 'express';
import { ExportService } from './export.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { ApiResponse } from '../../shared/utils/api-response';
import { AuthRequest } from '../auth/auth.types';
import { logger } from '../../shared/utils/logger';
import { ErrorCode } from '../../shared/utils/errors';
import { ExportStatus } from './export.types';

export class ExportController {
    constructor(private readonly exportService: ExportService) {}

    /* =========================================================
        CRUD
    ========================================================= */
    createExport = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.createExport({ ...req.body, userId: req.user!.uid });
            res.status(201).json(new ApiResponse(req).success(result, 'Export created successfully'));
        } catch (err) {
            logger.error('Create export controller error:', err);
            next(err);
        }
    });

    getUserExports = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const filters = {
                status: req.query.status as ExportStatus,
                limit: Number(req.query.limit) || 20,
                offset: Number(req.query.offset) || 0,
            };
            const exports = await this.exportService.getUserExports(req.user!.uid, filters.limit, filters.offset, filters.status);
            res.json(new ApiResponse(req).success(exports, 'Exports retrieved successfully'));
        } catch (err) {
            logger.error('List exports controller error:', err);
            next(err);
        }
    });

    getExport = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.getExport(req.user!.uid, req.params.exportId);
            res.json(new ApiResponse(req).success(result, 'Export retrieved successfully'));
        } catch (err) {
            logger.error('Get export controller error:', err);
            next(err);
        }
    });

    deleteExport = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            await this.exportService.deleteExport(req.user!.uid, req.params.exportId);
            res.json(new ApiResponse(req).success(null, 'Export deleted successfully'));
        } catch (err) {
            logger.error('Delete export controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       DOWNLOAD
    ========================================================= */
    downloadExport = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const exportResult = await this.exportService.getExport(req.user!.uid, req.params.exportId);
            if (!exportResult.fileUrl) throw ErrorCode.EXPORT_FILE_NOT_FOUND;

            const fileBuffer = await this.exportService.getExportFile(exportResult.fileUrl);
            const mimeType = this.getMimeType(exportResult.format);
            const fileName = `export_${req.params.exportId}.${exportResult.format}`;

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', fileBuffer.length);
            res.send(fileBuffer);
        } catch (err) {
            logger.error('Download export controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       FORMAT-SPECIFIC EXPORT HANDLERS
    ========================================================= */
    exportPdf = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.exportPdf({ ...req.body, userId: req.user!.uid });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.pdf"`);
            res.send(result);
        } catch (err) {
            logger.error('Export PDF controller error:', err);
            next(err);
        }
    });

    exportCalendar = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.exportCalendar({ ...req.body, userId: req.user!.uid });
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.ics"`);
            res.send(result);
        } catch (err) {
            logger.error('Export calendar controller error:', err);
            next(err);
        }
    });

    exportHandwriting = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.exportHandwriting({ ...req.body, userId: req.user!.uid });
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.svg"`);
            res.send(result);
        } catch (err) {
            logger.error('Export handwriting controller error:', err);
            next(err);
        }
    });

    exportJson = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.exportJson({ ...req.body, userId: req.user!.uid });
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.json"`);
            res.send(result);
        } catch (err) {
            logger.error('Export JSON controller error:', err);
            next(err);
        }
    });

    exportCsv = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await this.exportService.exportCsv({ ...req.body, userId: req.user!.uid });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.csv"`);
            res.send(result);
        } catch (err) {
            logger.error('Export CSV controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       QUOTA
    ========================================================= */
    getExportQuota = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const quota = await this.exportService.getExportQuota(req.user!.uid);
            res.json(new ApiResponse(req).success(quota, 'Quota retrieved successfully'));
        } catch (err) {
            logger.error('Get export quota controller error:', err);
            next(err);
        }
    });

    /* =========================================================
       HELPERS
    ========================================================= */
    private getMimeType(format: string): string {
        const mimeTypes: Record<string, string> = {
            pdf: 'application/pdf',
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json',
            ical: 'text/calendar',
            markdown: 'text/markdown',
            html: 'text/html',
            txt: 'text/plain',
        };
        return mimeTypes[format] || 'application/octet-stream';
    }
}