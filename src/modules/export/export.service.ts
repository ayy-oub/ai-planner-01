import { Injectable, Logger } from '@nestjs/common';
import { ExportRepository } from './export.repository';
import { CacheService } from '../../shared/services/cache.service';
import {
    ExportRequest,
    ExportResult,
    ExportOptions,
    ExportFormat,
    ExportType,
    ExportStatus,
    ExportFilters
} from './export.types';
import { PlannerService } from '../planner/planner.service';
import { SectionService } from '../section/section.service';
import { ActivityService } from '../activity/activity.service';
import { UserService } from '../user/user.service';
import { FirebaseService } from '../../shared/services/firebase.service';
import { FileUploadService } from '../../shared/services/file-upload.service';
import { QueueService } from '../../shared/services/queue.service';
import { EmailService } from '../../shared/services/email.service';
import { BadRequestException, NotFoundException, TooManyRequestsException } from '../../shared/utils/errors';
import { validateInput } from '../../shared/utils/validators';
import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);
    private readonly exportQuota = {
        free: { monthly: 10, maxFileSize: 5 * 1024 * 1024 }, // 10 exports, 5MB max
        premium: { monthly: 100, maxFileSize: 50 * 1024 * 1024 }, // 100 exports, 50MB max
        enterprise: { monthly: -1, maxFileSize: 200 * 1024 * 1024 } // unlimited, 200MB max
    };

    constructor(
        private readonly exportRepository: ExportRepository,
        private readonly cacheService: CacheService,
        private readonly plannerService: PlannerService,
        private readonly sectionService: SectionService,
        private readonly activityService: ActivityService,
        private readonly userService: UserService,
        private readonly firebaseService: FirebaseService,
        private readonly fileUploadService: FileUploadService,
        private readonly queueService: QueueService,
        private readonly emailService: EmailService
    ) { }

    /**
     * Create a new export
     */
    async createExport(request: ExportRequest): Promise<ExportResult> {
        try {
            // Validate input
            await validateInput(request, 'exportRequest');

            // Check user quota
            await this.checkExportQuota(request.userId);

            // Create export record
            const exportResult: ExportResult = {
                id: uuidv4(),
                userId: request.userId,
                status: 'pending',
                format: request.format,
                type: request.type,
                metadata: {
                    originalRequest: request,
                    processingTime: 0,
                    itemsExported: 0,
                    warnings: [],
                    errors: []
                },
                createdAt: new Date()
            };

            // Save export record
            await this.exportRepository.saveExport(exportResult);

            // Queue the export job
            await this.queueExportJob(exportResult);

            logger.info(`Export created: ${exportResult.id} for user: ${request.userId}`);

            return exportResult;
        } catch (error) {
            logger.error('Error creating export:', error);
            throw error;
        }
    }

    /**
     * Process export job
     */
    async processExport(exportId: string): Promise<void> {
        const startTime = Date.now();

        try {
            // Get export record
            const exportResult = await this.exportRepository.getExport(exportId);
            if (!exportResult) {
                throw new NotFoundException('Export not found');
            }

            // Update status to processing
            exportResult.status = 'processing';
            await this.exportRepository.updateExport(exportId, { status: 'processing' });

            // Gather data based on export type
            const exportData = await this.gatherExportData(exportResult.metadata.originalRequest);

            // Generate file based on format
            let fileBuffer: Buffer;
            let fileName: string;

            switch (exportResult.format) {
                case 'pdf':
                    fileBuffer = await this.generatePDF(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.pdf`;
                    break;
                case 'csv':
                    fileBuffer = await this.generateCSV(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.csv`;
                    break;
                case 'excel':
                    fileBuffer = await this.generateExcel(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.xlsx`;
                    break;
                case 'json':
                    fileBuffer = Buffer.from(JSON.stringify(exportData, null, 2));
                    fileName = `export_${exportId}.json`;
                    break;
                case 'ical':
                    fileBuffer = await this.generateICalendar(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.ics`;
                    break;
                case 'markdown':
                    fileBuffer = await this.generateMarkdown(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.md`;
                    break;
                case 'html':
                    fileBuffer = await this.generateHTML(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.html`;
                    break;
                case 'txt':
                    fileBuffer = await this.generateText(exportData, exportResult.metadata.originalRequest.options);
                    fileName = `export_${exportId}.txt`;
                    break;
                default:
                    throw new BadRequestException(`Unsupported export format: ${exportResult.format}`);
            }

            // Check file size limit
            const user = await this.userService.getUserProfile(exportResult.userId);
            const plan = user.subscription?.plan || 'free';
            const maxFileSize = this.exportQuota[plan].maxFileSize;

            if (fileBuffer.length > maxFileSize) {
                throw new BadRequestException(`File size exceeds limit for ${plan} plan. Maximum: ${maxFileSize} bytes, Generated: ${fileBuffer.length} bytes`);
            }

            // Upload file to storage
            const fileUrl = await this.fileUploadService.uploadFile({
                buffer: fileBuffer,
                originalname: fileName,
                mimetype: this.getMimeType(exportResult.format),
                size: fileBuffer.length
            } as Express.Multer.File, `exports/${exportResult.userId}/`);

            // Update export record
            const processingTime = Date.now() - startTime;
            const updates = {
                status: 'completed' as ExportStatus,
                fileUrl,
                fileSize: fileBuffer.length,
                completedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                metadata: {
                    ...exportResult.metadata,
                    processingTime,
                    itemsExported: this.countItems(exportData)
                }
            };

            await this.exportRepository.updateExport(exportId, updates);

            // Send notification email
            await this.sendExportCompletionEmail(exportResult.userId, exportResult);

            logger.info(`Export completed: ${exportId} in ${processingTime}ms`);
        } catch (error) {
            logger.error(`Error processing export ${exportId}:`, error);

            // Update export status to failed
            await this.exportRepository.updateExport(exportId, {
                status: 'failed',
                completedAt: new Date(),
                metadata: {
                    ...exportResult.metadata,
                    error: error.message
                }
            });

            throw error;
        }
    }

    /**
     * Get export by ID
     */
    async getExport(userId: string, exportId: string): Promise<ExportResult> {
        try {
            const exportResult = await this.exportRepository.getExport(exportId);

            if (!exportResult) {
                throw new NotFoundException('Export not found');
            }

            if (exportResult.userId !== userId) {
                throw new BadRequestException('Access denied');
            }

            return exportResult;
        } catch (error) {
            logger.error('Error retrieving export:', error);
            throw error;
        }
    }

    /**
     * Get user exports
     */
    async getUserExports(
        userId: string,
        limit: number = 20,
        offset: number = 0,
        status?: ExportStatus
    ): Promise<ExportResult[]> {
        try {
            return await this.exportRepository.getUserExports(userId, limit, offset, status);
        } catch (error) {
            logger.error('Error retrieving user exports:', error);
            throw error;
        }
    }

    /**
     * Delete export
     */
    async deleteExport(userId: string, exportId: string): Promise<void> {
        try {
            const exportResult = await this.getExport(userId, exportId);

            if (exportResult.fileUrl) {
                // Delete file from storage
                await this.fileUploadService.deleteFile(exportResult.fileUrl);
            }

            // Delete export record
            await this.exportRepository.deleteExport(exportId);

            logger.info(`Export deleted: ${exportId}`);
        } catch (error) {
            logger.error('Error deleting export:', error);
            throw error;
        }
    }

    /**
     * Get export quota information
     */
    async getExportQuota(userId: string): Promise<any> {
        try {
            const user = await this.userService.getUserProfile(userId);
            const plan = user.subscription?.plan || 'free';

            const usage = await this.exportRepository.getUserExportUsage(userId, new Date());

            return {
                userId,
                plan,
                monthlyQuota: this.exportQuota[plan].monthly,
                usedThisMonth: usage.count,
                remainingQuota: this.exportQuota[plan].monthly > 0 ?
                    Math.max(0, this.exportQuota[plan].monthly - usage.count) : -1,
                resetsAt: usage.resetsAt,
                unlimited: this.exportQuota[plan].monthly === -1
            };
        } catch (error) {
            logger.error('Error retrieving export quota:', error);
            throw error;
        }
    }

    /**
     * Private method to check export quota
     */
    private async checkExportQuota(userId: string): Promise<void> {
        const quota = await this.getExportQuota(userId);

        if (quota.unlimited) return;

        if (quota.usedThisMonth >= quota.monthlyQuota) {
            throw new TooManyRequestsException(
                `Monthly export quota exceeded. Used: ${quota.usedThisMonth}/${quota.monthlyQuota}. Resets on: ${quota.resetsAt.toISOString()}`
            );
        }
    }

    /**
     * Private method to queue export job
     */
    private async queueExportJob(exportResult: ExportResult): Promise<void> {
        await this.queueService.addJob('export', {
            exportId: exportResult.id,
            userId: exportResult.userId
        }, {
            delay: 0,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
    }

    /**
     * Private method to gather export data
     */
    private async gatherExportData(request: ExportRequest): Promise<any> {
        const data: any = {
            planners: [],
            sections: [],
            activities: []
        };

        try {
            // Get planner data
            if (request.plannerId) {
                const planner = await this.plannerService.getUserPlanner(request.userId, request.plannerId);
                data.planners = [planner];

                // Get sections for the planner
                const sections = await this.sectionService.getSectionsByPlanner(request.userId, request.plannerId);
                data.sections = sections;

                // Get activities for all sections
                for (const section of sections) {
                    const activities = await this.activityService.getActivitiesBySection(request.userId, section.id);
                    data.activities.push(...activities);
                }
            } else if (request.sectionIds && request.sectionIds.length > 0) {
                // Get specific sections
                for (const sectionId of request.sectionIds) {
                    const section = await this.sectionService.getSection(request.userId, sectionId);
                    data.sections.push(section);

                    const activities = await this.activityService.getActivitiesBySection(request.userId, sectionId);
                    data.activities.push(...activities);
                }
            } else if (request.activityIds && request.activityIds.length > 0) {
                // Get specific activities
                for (const activityId of request.activityIds) {
                    const activity = await this.activityService.getActivity(request.userId, activityId);
                    data.activities.push(activity);
                }
            } else {
                // Get all user data
                const planners = await this.plannerService.getUserPlanners(request.userId);
                data.planners = planners;

                for (const planner of planners) {
                    const sections = await this.sectionService.getSectionsByPlanner(request.userId, planner.id);
                    data.sections.push(...sections);

                    for (const section of sections) {
                        const activities = await this.activityService.getActivitiesBySection(request.userId, section.id);
                        data.activities.push(...activities);
                    }
                }
            }

            // Apply filters
            if (request.filters) {
                data.activities = this.filterActivities(data.activities, request.filters);
            }

            // Apply date range filter
            if (request.dateRange) {
                data.activities = this.filterByDateRange(data.activities, request.dateRange);
            }

            return data;
        } catch (error) {
            logger.error('Error gathering export data:', error);
            throw error;
        }
    }

    /**
     * Private method to generate PDF
     */
    private async generatePDF(data: any, options: ExportOptions): Promise<Buffer> {
        try {
            const PDFDocument = (await import('pdfkit')).default;
            const doc = new PDFDocument();
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => { });

            // Title
            doc.fontSize(24).text('AI Planner Export', { align: 'center' });
            doc.moveDown();

            // Date
            doc.fontSize(12).text(`Generated on: ${format(new Date(), 'PPpp')}`, { align: 'center' });
            doc.moveDown();

            // Statistics
            if (data.planners.length > 0) {
                doc.fontSize(16).text('Summary');
                doc.fontSize(12);
                doc.text(`Planners: ${data.planners.length}`);
                doc.text(`Sections: ${data.sections.length}`);
                doc.text(`Activities: ${data.activities.length}`);
                doc.text(`Completed: ${data.activities.filter((a: any) => a.status === 'completed').length}`);
                doc.moveDown();
            }

            // Activities by section
            for (const section of data.sections) {
                const sectionActivities = data.activities.filter((a: any) => a.sectionId === section.id);

                if (sectionActivities.length > 0) {
                    doc.fontSize(16).text(section.title);
                    doc.moveDown();

                    for (const activity of sectionActivities) {
                        doc.fontSize(12);

                        // Activity title with priority indicator
                        const priorityIcon = this.getPriorityIcon(activity.priority);
                        doc.text(`${priorityIcon} ${activity.title}`);

                        // Activity details
                        if (activity.description) {
                            doc.fontSize(10).text(activity.description, { indent: 20 });
                        }

                        if (activity.dueDate) {
                            doc.text(`Due: ${format(new Date(activity.dueDate), 'PPP')}`, { indent: 20 });
                        }

                        if (activity.tags && activity.tags.length > 0) {
                            doc.text(`Tags: ${activity.tags.join(', ')}`, { indent: 20 });
                        }

                        doc.moveDown();
                    }

                    doc.moveDown();
                }
            }

            // Footer
            if (options?.pdfOptions?.footer) {
                const footerText = options.pdfOptions.footer.text || 'AI Planner Export';
                doc.fontSize(10).text(footerText, 50, doc.page.height - 50, {
                    align: 'center',
                    lineBreak: false
                });
            }

            doc.end();

            return new Promise((resolve, reject) => {
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', reject);
            });
        } catch (error) {
            logger.error('Error generating PDF:', error);
            throw error;
        }
    }

    /**
     * Private method to generate CSV
     */
    private async generateCSV(data: any, options: ExportOptions): Promise<Buffer> {
        const csvData = [];

        // Headers
        const headers = [
            'Type',
            'Title',
            'Description',
            'Status',
            'Priority',
            'Due Date',
            'Completed Date',
            'Section',
            'Tags',
            'Estimated Duration',
            'Notes'
        ];

        csvData.push(headers.join(','));

        // Data rows
        for (const activity of data.activities) {
            const section = data.sections.find((s: any) => s.id === activity.sectionId);

            const row = [
                'Activity',
                `"${activity.title.replace(/"/g, '""')}"`,
                `"${(activity.description || '').replace(/"/g, '""')}"`,
                activity.status,
                activity.priority,
                activity.dueDate ? format(new Date(activity.dueDate), 'yyyy-MM-dd') : '',
                activity.completedAt ? format(new Date(activity.completedAt), 'yyyy-MM-dd') : '',
                `"${section?.title || ''}"`,
                `"${(activity.tags || []).join('; ')}"`,
                activity.metadata?.estimatedDuration || '',
                `"${(activity.notes || '').replace(/"/g, '""')}"`
            ];

            csvData.push(row.join(','));
        }

        // Add sections
        for (const section of data.sections) {
            const row = [
                'Section',
                `"${section.title.replace(/"/g, '""')}"`,
                `"${(section.description || '').replace(/"/g, '""')}"`,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                ''
            ];
            csvData.push(row.join(','));
        }

        // Add planners
        for (const planner of data.planners) {
            const row = [
                'Planner',
                `"${planner.title.replace(/"/g, '""')}"`,
                `"${(planner.description || '').replace(/"/g, '""')}"`,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                ''
            ];
            csvData.push(row.join(','));
        }

        const csvString = csvData.join('\n');
        return Buffer.from(csvString, 'utf-8');
    }

    /**
     * Private method to generate Excel
     */
    private async generateExcel(data: any, options: ExportOptions): Promise<Buffer> {
        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();

            // Main activities sheet
            const activitiesSheet = workbook.addWorksheet('Activities');
            activitiesSheet.columns = [
                { header: 'Title', key: 'title', width: 30 },
                { header: 'Description', key: 'description', width: 50 },
                { header: 'Priority', key: 'priority', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Due Date', key: 'dueDate', width: 20 },
                { header: 'Completed Date', key: 'completedDate', width: 20 },
                { header: 'Section', key: 'section', width: 25 },
                { header: 'Tags', key: 'tags', width: 30 },
                { header: 'Estimated Duration', key: 'estimatedDuration', width: 20 },
                { header: 'Notes', key: 'notes', width: 40 }
            ];

            // Style header row
            activitiesSheet.getRow(1).font = { bold: true };
            activitiesSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            activitiesSheet.addRows(data.activities.map((activity: any) => {
                const section = data.sections.find((s: any) => s.id === activity.sectionId);
                return {
                    title: activity.title,
                    description: activity.description,
                    priority: activity.priority,
                    status: activity.status,
                    dueDate: activity.dueDate ? format(new Date(activity.dueDate), 'yyyy-MM-dd') : '',
                    completedDate: activity.completedAt ? format(new Date(activity.completedAt), 'yyyy-MM-dd') : '',
                    section: section?.title || '',
                    tags: (activity.tags || []).join(', '),
                    estimatedDuration: activity.metadata?.estimatedDuration || '',
                    notes: activity.notes || ''
                };
            }));

            // Statistics sheet
            const statsSheet = workbook.addWorksheet('Statistics');
            statsSheet.columns = [
                { header: 'Metric', key: 'metric', width: 25 },
                { header: 'Value', key: 'value', width: 15 }
            ];

            const statsData = [
                { metric: 'Total Activities', value: data.activities.length },
                { metric: 'Completed', value: data.activities.filter((a: any) => a.status === 'completed').length },
                { metric: 'In Progress', value: data.activities.filter((a: any) => a.status === 'in-progress').length },
                { metric: 'Pending', value: data.activities.filter((a: any) => a.status === 'pending').length },
                { metric: 'High Priority', value: data.activities.filter((a: any) => a.priority === 'high').length },
                { metric: 'Medium Priority', value: data.activities.filter((a: any) => a.priority === 'medium').length },
                { metric: 'Low Priority', value: data.activities.filter((a: any) => a.priority === 'low').length }
            ];

            statsSheet.addRows(statsData);

            // Style statistics sheet
            statsSheet.getRow(1).font = { bold: true };
            statsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            const excelBuffer = await workbook.xlsx.writeBuffer();
            return Buffer.from(excelBuffer);
        } catch (error) {
            logger.error('Error generating Excel:', error);
            throw error;
        }
    }

    /**
     * Private method to generate iCalendar
     */
    private async generateICalendar(data: any, options: ExportOptions): Promise<Buffer> {
        let icalContent = 'BEGIN:VCALENDAR\r\n';
        icalContent += 'VERSION:2.0\r\n';
        icalContent += 'PRODID:-//AI Planner//Export//EN\r\n';
        icalContent += 'CALSCALE:GREGORIAN\r\n';
        icalContent += 'METHOD:PUBLISH\r\n';
        icalContent += `X-WR-CALNAME:AI Planner Export\r\n`;
        icalContent += `X-WR-TIMEZONE:${options.timezone || 'UTC'}\r\n`;

        for (const activity of data.activities) {
            if (activity.dueDate) {
                const startDate = new Date(activity.dueDate);
                const duration = activity.metadata?.estimatedDuration || 60; // Default 1 hour
                const endDate = new Date(startDate.getTime() + duration * 60000);

                icalContent += 'BEGIN:VEVENT\r\n';
                icalContent += `UID:${activity.id}@aiplanner.com\r\n`;
                icalContent += `DTSTART:${this.formatICalDate(startDate)}\r\n`;
                icalContent += `DTEND:${this.formatICalDate(endDate)}\r\n`;
                icalContent += `SUMMARY:${activity.title}\r\n`;
                if (activity.description) {
                    icalContent += `DESCRIPTION:${activity.description.replace(/\n/g, '\\n')}\r\n`;
                }
                icalContent += `STATUS:${activity.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}\r\n`;
                icalContent += `PRIORITY:${this.mapPriorityToICal(activity.priority)}\r\n`;
                icalContent += 'END:VEVENT\r\n';
            }
        }

        icalContent += 'END:VCALENDAR\r\n';
        return Buffer.from(icalContent, 'utf-8');
    }

    /**
     * Private method to generate Markdown
     */
    private async generateMarkdown(data: any, options: ExportOptions): Promise<Buffer> {
        let markdown = '# AI Planner Export\n\n';
        markdown += `Generated on: ${format(new Date(), 'PPpp')}\n\n`;

        // Summary
        markdown += '## Summary\n\n';
        markdown += `- **Total Planners:** ${data.planners.length}\n`;
        markdown += `- **Total Sections:** ${data.sections.length}\n`;
        markdown += `- **Total Activities:** ${data.activities.length}\n`;
        markdown += `- **Completed Activities:** ${data.activities.filter((a: any) => a.status === 'completed').length}\n`;
        markdown += `- **In Progress Activities:** ${data.activities.filter((a: any) => a.status === 'in-progress').length}\n`;
        markdown += `- **Pending Activities:** ${data.activities.filter((a: any) => a.status === 'pending').length}\n\n`;

        // Planners
        if (data.planners.length > 0) {
            markdown += '## Planners\n\n';
            data.planners.forEach((planner: any) => {
                markdown += `### ${planner.title}\n\n`;
                if (planner.description) {
                    markdown += `${planner.description}\n\n`;
                }
                markdown += `- **Created:** ${format(new Date(planner.createdAt), 'PPpp')}\n`;
                markdown += `- **Color:** ${planner.color}\n\n`;
            });
        }

        // Sections by Planner
        if (data.sections.length > 0) {
            markdown += '## Sections\n\n';

            for (const planner of data.planners) {
                const plannerSections = data.sections.filter((s: any) => s.plannerId === planner.id);

                if (plannerSections.length > 0) {
                    markdown += `### ${planner.title} Sections\n\n`;

                    plannerSections.forEach((section: any) => {
                        markdown += `#### ${section.title}\n\n`;
                        if (section.description) {
                            markdown += `${section.description}\n\n`;
                        }
                        markdown += `- **Type:** ${section.type}\n`;
                        markdown += `- **Order:** ${section.order}\n`;
                        markdown += `- **Activities:** ${data.activities.filter((a: any) => a.sectionId === section.id).length}\n\n`;
                    });
                }
            }
        }

        // Activities by Section
        if (data.activities.length > 0) {
            markdown += '## Activities\n\n';

            for (const section of data.sections) {
                const sectionActivities = data.activities.filter((a: any) => a.sectionId === section.id);

                if (sectionActivities.length > 0) {
                    markdown += `### ${section.title}\n\n`;

                    sectionActivities.forEach((activity: any) => {
                        markdown += `#### ${activity.title}\n\n`;

                        if (activity.description) {
                            markdown += `${activity.description}\n\n`;
                        }

                        markdown += '| Property | Value |\n';
                        markdown += '|----------|-------|\n';
                        markdown += `| Status | ${activity.status} |\n`;
                        markdown += `| Priority | ${activity.priority} |\n`;

                        if (activity.dueDate) {
                            markdown += `| Due Date | ${format(new Date(activity.dueDate), 'PPpp')} |\n`;
                        }

                        if (activity.completedAt) {
                            markdown += `| Completed At | ${format(new Date(activity.completedAt), 'PPpp')} |\n`;
                        }

                        if (activity.metadata?.estimatedDuration) {
                            markdown += `| Estimated Duration | ${activity.metadata.estimatedDuration} minutes |\n`;
                        }

                        if (activity.tags && activity.tags.length > 0) {
                            markdown += `| Tags | ${activity.tags.join(', ')} |\n`;
                        }

                        markdown += '\n';
                    });
                }
            }
        }

        return Buffer.from(markdown, 'utf-8');
    }

    /**
     * Private method to generate HTML
     */
    private async generateHTML(data: any, options: ExportOptions): Promise<Buffer> {
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Planner Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    h1, h2, h3, h4 {
      color: #2c3e50;
      margin-top: 0;
    }
    
    h1 {
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    
    h2 {
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 8px;
      margin-top: 40px;
      margin-bottom: 20px;
    }
    
    h3 {
      color: #34495e;
      margin-top: 25px;
    }
    
    .summary {
      background: #ecf0f1;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .summary-item {
      background: white;
      padding: 15px;
      border-radius: 5px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .summary-number {
      font-size: 24px;
      font-weight: bold;
      color: #3498db;
      display: block;
    }
    
    .summary-label {
      font-size: 14px;
      color: #7f8c8d;
      margin-top: 5px;
    }
    
    .planner-card {
      background: #ffffff;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .planner-title {
      font-size: 18px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 10px;
    }
    
    .section-card {
      background: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 0 5px 5px 0;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #34495e;
      margin-bottom: 8px;
    }
    
    .activity-card {
      background: white;
      border: 1px solid #e1e8ed;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 10px;
      transition: box-shadow 0.2s ease;
    }
    
    .activity-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .activity-title {
      font-size: 14px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
    }
    
    .activity-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 13px;
      color: #7f8c8d;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .status-badge {
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .status-completed {
      background: #d4edda;
      color: #155724;
    }
    
    .status-pending {
      background: #fff3cd;
      color: #856404;
    }
    
    .status-in-progress {
      background: #cce5ff;
      color: #004085;
    }
    
    .priority-badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .priority-urgent {
      background: #dc3545;
      color: white;
    }
    
    .priority-high {
      background: #fd7e14;
      color: white;
    }
    
    .priority-medium {
      background: #ffc107;
      color: #212529;
    }
    
    .priority-low {
      background: #28a745;
      color: white;
    }
    
    .tag {
      display: inline-block;
      background: #e9ecef;
      color: #495057;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-right: 5px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
      text-align: center;
      color: #7f8c8d;
      font-size: 12px;
    }
    
    @media print {
      body { background-color: white; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI Planner Export</h1>
    <p><strong>Generated on:</strong> ${format(new Date(), 'PPpp')}</p>`;

        // Summary
        html += `
    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${data.planners.length}</span>
          <div class="summary-label">Planners</div>
        </div>
        <div class="summary-item">
          <span class="summary-number">${data.sections.length}</span>
          <div class="summary-label">Sections</div>
        </div>
        <div class="summary-item">
          <span class="summary-number">${data.activities.length}</span>
          <div class="summary-label">Activities</div>
        </div>
        <div class="summary-item">
          <span class="summary-number">${data.activities.filter((a: any) => a.status === 'completed').length}</span>
          <div class="summary-label">Completed</div>
        </div>
        <div class="summary-item">
          <span class="summary-number">${data.activities.filter((a: any) => a.status === 'in-progress').length}</span>
          <div class="summary-label">In Progress</div>
        </div>
        <div class="summary-item">
          <span class="summary-number">${data.activities.filter((a: any) => a.priority === 'high' || a.priority === 'urgent').length}</span>
          <div class="summary-label">High Priority</div>
        </div>
      </div>
    </div>`;

        // Planners
        if (data.planners.length > 0) {
            html += `<h2>Planners</h2>`;

            data.planners.forEach((planner: any) => {
                html += `
        <div class="planner-card">
          <div class="planner-title">${planner.title}</div>`;

                if (planner.description) {
                    html += `<p>${planner.description}</p>`;
                }

                html += `<div class="activity-meta">
            <div class="meta-item">
              <span>📅 Created: ${format(new Date(planner.createdAt), 'PPpp')}</span>
            </div>
            <div class="meta-item">
              <span>🎨 Color: ${planner.color}</span>
            </div>
          </div>
        </div>`;
            });
        }

        // Sections and Activities
        if (data.sections.length > 0) {
            html += `<h2>Sections & Activities</h2>`;

            for (const planner of data.planners) {
                const plannerSections = data.sections.filter((s: any) => s.plannerId === planner.id);

                if (plannerSections.length > 0) {
                    html += `<h3>${planner.title}</h3>`;

                    for (const section of plannerSections) {
                        const sectionActivities = data.activities.filter((a: any) => a.sectionId === section.id);

                        html += `
            <div class="section-card">
              <div class="section-title">${section.title}</div>`;

                        if (section.description) {
                            html += `<p>${section.description}</p>`;
                        }

                        if (sectionActivities.length > 0) {
                            html += `<p><strong>Activities (${sectionActivities.length}):</strong></p>`;

                            sectionActivities.forEach((activity: any) => {
                                const priorityClass = `priority-${activity.priority}`;
                                const statusClass = `status-${activity.status}`;

                                html += `
                <div class="activity-card">
                  <div class="activity-title">${activity.title}</div>
                  <div class="activity-meta">
                    <div class="meta-item">
                      <span class="status-badge ${statusClass}">${activity.status}</span>
                    </div>
                    <div class="meta-item">
                      <span class="priority-badge ${priorityClass}">${activity.priority}</span>
                    </div>`;

                                if (activity.dueDate) {
                                    html += `
                    <div class="meta-item">
                      <span>📅 ${format(new Date(activity.dueDate), 'PPP')}</span>
                    </div>`;
                                }

                                if (activity.metadata?.estimatedDuration) {
                                    html += `
                    <div class="meta-item">
                      <span>⏱️ ${activity.metadata.estimatedDuration} min</span>
                    </div>`;
                                }

                                html += `
                  </div>`;

                                if (activity.description) {
                                    html += `<p style="margin-top: 8px; font-size: 13px; color: #555;">${activity.description}</p>`;
                                }

                                if (activity.tags && activity.tags.length > 0) {
                                    html += `<div style="margin-top: 8px;">`;
                                    activity.tags.forEach((tag: string) => {
                                        html += `<span class="tag">${tag}</span>`;
                                    });
                                    html += `</div>`;
                                }

                                html += `</div>`;
                            });
                        }

                        html += `</div>`;
                    }
                }
            }
        }

        // Footer
        html += `
    <div class="footer">
      <p>Generated by AI Planner • ${format(new Date(), 'PPpp')}</p>
    </div>
  </div>
</body>
</html>`;

        return Buffer.from(html, 'utf-8');
    }

    /**
     * Private method to generate plain text
     */
    private async generateText(data: any, options: ExportOptions): Promise<Buffer> {
        let text = 'AI PLANNER EXPORT\n';
        text += `Generated on: ${format(new Date(), 'PPpp')}\n\n`;

        // Summary
        text += 'SUMMARY\n';
        text += '-------\n';
        text += `Total Planners: ${data.planners.length}\n`;
        text += `Total Sections: ${data.sections.length}\n`;
        text += `Total Activities: ${data.activities.length}\n`;
        text += `Completed Activities: ${data.activities.filter((a: any) => a.status === 'completed').length}\n`;
        text += `In Progress Activities: ${data.activities.filter((a: any) => a.status === 'in-progress').length}\n`;
        text += `Pending Activities: ${data.activities.filter((a: any) => a.status === 'pending').length}\n\n`;

        // Planners
        if (data.planners.length > 0) {
            text += 'PLANNERS\n';
            text += '--------\n\n';

            data.planners.forEach((planner: any) => {
                text += `Title: ${planner.title}\n`;
                if (planner.description) {
                    text += `Description: ${planner.description}\n`;
                }
                text += `Created: ${format(new Date(planner.createdAt), 'PPpp')}\n`;
                text += `Color: ${planner.color}\n\n`;
            });
        }

        // Sections and Activities
        if (data.sections.length > 0) {
            text += 'SECTIONS & ACTIVITIES\n';
            text += '---------------------\n\n';

            for (const planner of data.planners) {
                const plannerSections = data.sections.filter((s: any) => s.plannerId === planner.id);

                if (plannerSections.length > 0) {
                    text += `${planner.title.toUpperCase()}\n`;
                    text += '='.repeat(planner.title.length) + '\n\n';

                    for (const section of plannerSections) {
                        const sectionActivities = data.activities.filter((a: any) => a.sectionId === section.id);

                        text += `Section: ${section.title}\n`;
                        text += '-'.repeat(section.title.length + 8) + '\n';

                        if (section.description) {
                            text += `${section.description}\n\n`;
                        }

                        if (sectionActivities.length > 0) {
                            text += `Activities (${sectionActivities.length}):\n\n`;

                            sectionActivities.forEach((activity: any) => {
                                text += `  • ${activity.title}\n`;
                                text += `    Status: ${activity.status}\n`;
                                text += `    Priority: ${activity.priority}\n`;

                                if (activity.dueDate) {
                                    text += `    Due: ${format(new Date(activity.dueDate), 'PPpp')}\n`;
                                }

                                if (activity.completedAt) {
                                    text += `    Completed: ${format(new Date(activity.completedAt), 'PPpp')}\n`;
                                }

                                if (activity.description) {
                                    text += `    Description: ${activity.description}\n`;
                                }

                                if (activity.tags && activity.tags.length > 0) {
                                    text += `    Tags: ${activity.tags.join(', ')}\n`;
                                }

                                if (activity.metadata?.estimatedDuration) {
                                    text += `    Estimated Duration: ${activity.metadata.estimatedDuration} minutes\n`;
                                }

                                text += '\n';
                            });
                        }

                        text += '\n';
                    }
                }
            }
        }

        return Buffer.from(text, 'utf-8');
    }

    /**
     * Private helper methods
     */
    private getMimeType(format: ExportFormat): string {
        const mimeTypes = {
            pdf: 'application/pdf',
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json',
            ical: 'text/calendar',
            markdown: 'text/markdown',
            html: 'text/html',
            txt: 'text/plain'
        };
        return mimeTypes[format];
    }

    private getPriorityIcon(priority: string): string {
        const icons = {
            urgent: '🚨',
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };
        return icons[priority] || '⚪';
    }

    private formatICalDate(date: Date): string {
        return format(date, 'yyyyMMddTHHmmss') + 'Z';
    }

    private mapPriorityToICal(priority: string): number {
        const priorityMap = {
            urgent: 1,
            high: 2,
            medium: 5,
            low: 9
        };
        return priorityMap[priority] || 5;
    }

    private countItems(data: any): number {
        let count = 0;
        if (data.planners) count += data.planners.length;
        if (data.sections) count += data.sections.length;
        if (data.activities) count += data.activities.length;
        return count;
    }

    private filterActivities(activities: any[], filters: ExportFilters): any[] {
        if (!filters) return activities;

        return activities.filter(activity => {
            // Status filter
            if (filters.status && filters.status.length > 0) {
                if (!filters.status.includes(activity.status)) return false;
            }

            // Priority filter
            if (filters.priority && filters.priority.length > 0) {
                if (!filters.priority.includes(activity.priority)) return false;
            }

            // Tags filter
            if (filters.tags && filters.tags.length > 0) {
                const activityTags = activity.tags || [];
                if (!filters.tags.some(tag => activityTags.includes(tag))) return false;
            }

            // Completion filter
            if (filters.includeCompleted === false && activity.status === 'completed') {
                return false;
            }

            // Archived filter
            if (filters.includeArchived === false && activity.archived) {
                return false;
            }

            return true;
        });
    }

    private filterByDateRange(activities: any[], dateRange: { start: string; end: string }): any[] {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        return activities.filter(activity => {
            const activityDate = activity.dueDate ? new Date(activity.dueDate) : new Date(activity.createdAt);
            return activityDate >= startDate && activityDate <= endDate;
        });
    }

    private async sendExportCompletionEmail(userId: string, exportResult: ExportResult): Promise<void> {
        try {
            const user = await this.userService.getUserProfile(userId);

            await this.emailService.sendEmail({
                to: user.email,
                subject: 'Your AI Planner Export is Ready',
                template: 'export-complete',
                context: {
                    userName: user.displayName || user.email,
                    exportType: exportResult.type,
                    exportFormat: exportResult.format,
                    exportId: exportResult.id,
                    downloadUrl: exportResult.fileUrl,
                    expiresAt: exportResult.expiresAt,
                    itemsExported: exportResult.metadata.itemsExported
                }
            });
        } catch (error) {
            logger.error('Error sending export completion email:', error);
        }
    }
}