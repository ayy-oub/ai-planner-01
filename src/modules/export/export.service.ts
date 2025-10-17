// src/modules/export/export.service.ts
let uuidv4: () => string;

(async () => {
    const uuidModule = await import('uuid');
    uuidv4 = uuidModule.v4;
})();
import { ExportRepository } from './export.repository';
import { UserRepository } from '../user/user.repository';
import { PlannerRepository } from '../planner/planner.repository';
import { SectionRepository } from '../section/section.repository';
import { ActivityRepository } from '../activity/activity.repository';
import { FileUploadService } from '../../shared/services/file-upload.service';
import { QueueService } from '../../shared/services/queue.service';
import { EmailService } from '../../shared/services/email.service';
import { AuditService } from '../../shared/services/audit.service';
import {
    ExportRequest,
    ExportResult,
    ExportFormat,
    ExportStatus,
    ExportQuota,
    ExportFilters,
} from './export.types';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import { format } from 'date-fns';

export class ExportService {
    private readonly quotaCfg = {
        free: { monthly: 10, maxBytes: 5 * 1024 * 1024 },
        premium: { monthly: 100, maxBytes: 50 * 1024 * 1024 },
        enterprise: { monthly: -1, maxBytes: 200 * 1024 * 1024 },
    };

    constructor(
        private readonly repo: ExportRepository,
        private readonly userRepo: UserRepository,
        private readonly plannerRepo: PlannerRepository,
        private readonly sectionRepo: SectionRepository,
        private readonly activityRepo: ActivityRepository,
        private readonly files: FileUploadService,
        private readonly queue: QueueService,
        private readonly email: EmailService,
        private readonly audit: AuditService,
    ) { }

    /* =========================================================
       CRUD
    ========================================================= */

    async createExport(req: ExportRequest): Promise<ExportResult> {
        const user = await this.userRepo.getProfile(req.userId);
        if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

        await this.checkQuota(req.userId);

        const exportResult: ExportResult = {
            id: uuidv4(),
            userId: req.userId,
            status: 'pending',
            format: req.format,
            type: req.type,
            metadata: {
                originalRequest: req,
                processingTime: 0,
                itemsExported: 0,
                warnings: [],
                errors: [],
            },
            createdAt: new Date(),
        };

        await this.repo.create(exportResult);
        await this.queue.addJob('export', 'processExport', { exportId: exportResult.id, userId: req.userId });

        this.log(req.userId, 'EXPORT_CREATED', { exportId: exportResult.id, format: req.format });
        return exportResult;
    }

    async getExport(userId: string, exportId: string): Promise<ExportResult> {
        const ex = await this.repo.findById(exportId);
        if (!ex) throw new AppError('Export not found', 404, undefined, ErrorCode.NOT_FOUND);
        if (ex.userId !== userId) throw new AppError('Access denied', 403, undefined, ErrorCode.UNAUTHORIZED);
        return ex;
    }

    async getUserExports(userId: string, limit = 20, offset = 0, status?: ExportStatus): Promise<ExportResult[]> {
        return this.repo.findByUser(userId, limit, offset, status);
    }

    async deleteExport(userId: string, exportId: string): Promise<void> {
        const ex = await this.getExport(userId, exportId);
        if (ex.fileUrl) await this.files.deleteFile(ex.fileUrl);
        await this.repo.delete(exportId);
        this.log(userId, 'EXPORT_DELETED', { exportId });
    }

    /* =========================================================
       DOWNLOAD
    ========================================================= */

    async getExportFile(fileUrl: string): Promise<Buffer> {
        return this.files.getBuffer(fileUrl);
    }

    /* =========================================================
       FORMAT-SPECIFIC EXPORT HELPERS
    ========================================================= */

    async exportPdf(req: ExportRequest): Promise<Buffer> {
        const data = await this.gatherData(req);
        return this.generatePdf(data, req.options);
    }

    async exportCalendar(req: ExportRequest): Promise<Buffer> {
        const data = await this.gatherData(req);
        return this.generateICal(data, req.options);
    }

    async exportHandwriting(req: ExportRequest): Promise<Buffer> {
        const data = await this.gatherData(req);
        return this.generateHandwriting(data, req.options);
    }

    async exportJson(req: ExportRequest): Promise<Buffer> {
        const data = await this.gatherData(req);
        return Buffer.from(JSON.stringify(data, null, 2));
    }

    async exportCsv(req: ExportRequest): Promise<Buffer> {
        const data = await this.gatherData(req);
        return this.generateCsv(data, req.options);
    }

    /* =========================================================
       QUOTA
    ========================================================= */

    async getExportQuota(userId: string): Promise<ExportQuota> {
        const user = await this.userRepo.getProfile(userId);
        const plan = user?.subscription?.plan || 'free';
        const usage = await this.repo.countMonthlyUsage(userId, new Date());

        return {
            userId,
            plan,
            monthlyQuota: this.quotaCfg[plan].monthly,
            usedThisMonth: usage.count,
            remainingQuota: this.quotaCfg[plan].monthly === -1 ? -1 : Math.max(0, this.quotaCfg[plan].monthly - usage.count),
            resetsAt: usage.resetsAt,
            unlimited: this.quotaCfg[plan].monthly === -1,
        };
    }

    /* =========================================================
       QUEUE HANDLER
    ========================================================= */

    async processExport(exportId: string): Promise<void> {
        const start = Date.now();
        const ex = await this.repo.findById(exportId);
        if (!ex) throw new AppError('Export not found', 404);

        await this.repo.update(exportId, { status: 'processing' });

        try {
            const buffer = await this.dispatchGenerator(ex);
            const plan = await this.userRepo.getProfile(ex.userId).then(u => u?.subscription?.plan || 'free');
            if (buffer.length > this.quotaCfg[plan].maxBytes) {
                throw new AppError('File size exceeds plan limit', 413, undefined, ErrorCode.QUOTA_EXCEEDED);
            }

            const fileUrl = await this.files.uploadFromBuffer(buffer, {
                filename: `export_${exportId}.${ex.format}`,
                mimetype: this.mimeType(ex.format),
                path: `exports/${ex.userId}`,
            });

            const updates: Partial<ExportResult> = {
                status: 'completed',
                fileUrl,
                fileSize: buffer.length,
                completedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                metadata: {
                    ...ex.metadata,
                    processingTime: Date.now() - start,
                    itemsExported: this.countItems(await this.gatherData(ex.metadata.originalRequest)),
                },
            };

            await this.repo.update(exportId, updates);
            await this.sendCompleteEmail(ex.userId, ex);
            this.log(ex.userId, 'EXPORT_COMPLETED', { exportId, format: ex.format });
        } catch (err: any) {
            await this.repo.update(exportId, {
                status: 'failed',
                completedAt: new Date(),
                metadata: { ...ex.metadata, errors: err.message },
            });
            this.log(ex.userId, 'EXPORT_FAILED', { exportId, error: err.message });
            throw err;
        }
    }

    /* =========================================================
       PRIVATE
    ========================================================= */

    private async checkQuota(userId: string): Promise<void> {
        const q = await this.getExportQuota(userId);
        if (!q.unlimited && q.usedThisMonth >= q.monthlyQuota) {
            throw new AppError('Monthly quota exceeded', 429, undefined, ErrorCode.QUOTA_EXCEEDED);
        }
    }

    private async gatherData(req: ExportRequest): Promise<any> {
        const out: any = { planners: [], sections: [], activities: [] };

        if (req.plannerId) {
            const p = await this.plannerRepo.findById(req.plannerId);
            if (!p || p.userId !== req.userId) throw new AppError('Planner not found', 404);
            out.planners = [p];
            out.sections = await this.sectionRepo.findByPlannerId(req.plannerId);
            out.activities = await this.activityRepo.findByPlannerId(req.plannerId);
        } else if (req.sectionIds?.length) {
            out.sections = await this.sectionRepo.findByIds(req.sectionIds);
            out.activities = (
                await Promise.all(
                    req.sectionIds.map(id => this.activityRepo.findBySectionId(id))
                )
            ).flat();
        } else if (req.activityIds?.length) {
            out.activities = await this.activityRepo.findByIds(req.activityIds);
        } else {
            out.planners = await this.plannerRepo.findByUserId(req.userId, {});
            const pIds = out.planners.map((p: any) => p.id);
            out.sections = (
                await Promise.all(
                    pIds.map((id: any) => this.sectionRepo.findByPlannerId(id))
                )
            ).flat();
            out.activities = (
                await Promise.all(
                    pIds.map((id: any) => this.activityRepo.findBySectionId(id))
                )
            ).flat();
        }

        if (req.filters) out.activities = this.applyFilters(out.activities, req.filters);
        if (req.dateRange) out.activities = this.applyDateRange(out.activities, req.dateRange);

        return out;
    }

    private async dispatchGenerator(ex: ExportResult): Promise<Buffer> {
        const req = ex.metadata.originalRequest;
        switch (ex.format) {
            case 'pdf':
                return this.generatePdf(await this.gatherData(req), req.options);
            case 'csv':
                return this.generateCsv(await this.gatherData(req), req.options);
            case 'excel':
                return this.generateExcel(await this.gatherData(req), req.options);
            case 'json':
                return Buffer.from(JSON.stringify(await this.gatherData(req), null, 2));
            case 'ical':
                return this.generateICal(await this.gatherData(req), req.options);
            case 'markdown':
                return this.generateMarkdown(await this.gatherData(req), req.options);
            case 'html':
                return this.generateHtml(await this.gatherData(req), req.options);
            case 'txt':
                return this.generateText(await this.gatherData(req), req.options);
            default:
                throw new AppError('Unsupported format', 400);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Generators (stubbed – replace with real impl)                     */
    /* ------------------------------------------------------------------ */

    private async generatePdf(data: any, opts: any): Promise<Buffer> {
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];
        doc.on('data', chunks.push.bind(chunks));
        return new Promise((res, rej) => {
            doc.on('end', () => res(Buffer.concat(chunks)));
            doc.on('error', rej);
            doc.text('AI Planner Export').end();
        });
    }

    private async generateCsv(data: any, opts: any): Promise<Buffer> {
        const rows = ['Title,Status,Priority'];
        data.activities.forEach((a: any) => rows.push(`"${a.title}","${a.status}","${a.priority}"`));
        return Buffer.from(rows.join('\n'), 'utf-8');
    }

    private async generateExcel(data: any, opts: any): Promise<Buffer> {
        const ExcelJS = (await import('exceljs')).Workbook;
        const wb = new ExcelJS();
        const ws = wb.addWorksheet('Export');
        ws.addRow(['Title', 'Status', 'Priority']);
        data.activities.forEach((a: any) => ws.addRow([a.title, a.status, a.priority]));
        return wb.xlsx.writeBuffer().then((b: any) => Buffer.from(b));
    }

    private async generateICal(data: any, opts: any): Promise<Buffer> {
        let cal = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//AI Planner//EN\r\n';
        data.activities
            .filter((a: any) => a.dueDate)
            .forEach((a: any) => {
                cal += `BEGIN:VEVENT\r\nUID:${a.id}@aiplanner.com\r\nSUMMARY:${a.title}\r\nDTSTART:${format(new Date(a.dueDate), 'yyyyMMddTHHmmss')}Z\r\nEND:VEVENT\r\n`;
            });
        cal += 'END:VCALENDAR\r\n';
        return Buffer.from(cal, 'utf-8');
    }

    private async generateMarkdown(data: any, opts: any): Promise<Buffer> {
        let md = '# AI Planner Export\n\n';
        data.activities.forEach((a: any) => (md += `- [${a.status}] **${a.title}** (${a.priority})\n`));
        return Buffer.from(md, 'utf-8');
    }

    private async generateHtml(data: any, opts: any): Promise<Buffer> {
        const html = `<html><body><h1>Export</h1><ul>${data.activities
            .map((a: any) => `<li>${a.title} – ${a.status}</li>`)
            .join('')}</ul></body></html>`;
        return Buffer.from(html, 'utf-8');
    }

    private async generateText(data: any, opts: any): Promise<Buffer> {
        const txt = data.activities.map((a: any) => `${a.title} | ${a.status} | ${a.priority}`).join('\n');
        return Buffer.from(txt, 'utf-8');
    }

    private async generateHandwriting(data: any, opts: any): Promise<Buffer> {
        // stub – return empty svg
        return Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="20">Handwriting stub</text></svg>`,
            'utf-8',
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Util                                                              */
    /* ------------------------------------------------------------------ */

    private applyFilters(list: any[], f: ExportFilters): any[] {
        return list.filter((a: any) => {
            if (f.status?.length && !f.status.includes(a.status)) return false;
            if (f.priority?.length && !f.priority.includes(a.priority)) return false;
            if (f.tags?.length && !f.tags.some((t: string) => (a.tags || []).includes(t))) return false;
            if (f.includeCompleted === false && a.status === 'completed') return false;
            if (f.includeArchived === false && a.archived) return false;
            return true;
        });
    }

    private applyDateRange(list: any[], dr: { start: string; end: string }): any[] {
        const s = new Date(dr.start);
        const e = new Date(dr.end);
        return list.filter((a: any) => {
            const d = a.dueDate ? new Date(a.dueDate) : new Date(a.createdAt);
            return d >= s && d <= e;
        });
    }

    private countItems(data: any): number {
        return (data.planners?.length || 0) + (data.sections?.length || 0) + (data.activities?.length || 0);
    }

    private mimeType(f: ExportFormat): string {
        const map: Record<ExportFormat, string> = {
            pdf: 'application/pdf',
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json',
            ical: 'text/calendar',
            markdown: 'text/markdown',
            html: 'text/html',
            txt: 'text/plain',
        };
        return map[f];
    }

    private async sendCompleteEmail(userId: string, ex: ExportResult): Promise<void> {
        const user = await this.userRepo.getProfile(userId);
        if (!user?.email) return;
        await this.email.sendExportComplete(user.email, {
            exportId: ex.id,
            format: ex.format,
            downloadUrl: ex.fileUrl!,
            expiresAt: ex.expiresAt!,
            itemsExported: ex.metadata.itemsExported,
        });
    }

    private log(userId: string, action: string, meta?: any): void {
        this.audit.logActivity({ userId, action, metadata: meta, timestamp: new Date() }).catch(() => { });
    }
}