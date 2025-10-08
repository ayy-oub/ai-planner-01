import { ExportService } from '../../../../src/modules/export/export.service';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { ExportFormat, ExportType } from '../../../../src/shared/types/export.types';

jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('ExportService', () => {
    let exportService: ExportService;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        exportService = new ExportService(cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('exportToPDF', () => {
        const exportData = {
            plannerId,
            format: ExportFormat.PDF,
            includeSections: true,
            includeActivities: true,
            includeComments: false,
            dateRange: {
                start: new Date(),
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        };

        it('should successfully export planner to PDF', async () => {
            const mockPdfBuffer = Buffer.from('PDF content');
            const mockExportResult = {
                fileName: 'planner-export.pdf',
                fileSize: 1024000,
                mimeType: 'application/pdf',
                buffer: mockPdfBuffer
            };

            // Mock the PDF generation
            jest.spyOn(exportService as any, 'generatePDF').mockResolvedValue(mockExportResult);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await exportService.exportToPDF(userId, exportData);

            expect(cacheService.set).toHaveBeenCalledWith(
                `export:pdf:${userId}:${plannerId}`,
                JSON.stringify(mockExportResult),
                3600
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith('export.pdf.completed', {
                exportData: mockExportResult,
                userId
            });
            expect(result).toEqual(mockExportResult);
        });

        it('should return cached export if available', async () => {
            const cachedExport = {
                fileName: 'cached-export.pdf',
                fileSize: 512000,
                mimeType: 'application/pdf',
                buffer: Buffer.from('Cached PDF content')
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedExport));

            const result = await exportService.exportToPDF(userId, exportData);

            expect(result).toEqual(cachedExport);
        });

        it('should handle export failures gracefully', async () => {
            jest.spyOn(exportService as any, 'generatePDF').mockRejectedValue(
                new Error('PDF generation failed')
            );

            await expect(exportService.exportToPDF(userId, exportData))
                .rejects.toThrow('Failed to export planner to PDF');
        });

        it('should validate export data', async () => {
            const invalidData = {
                plannerId: '', // Invalid planner ID
                format: ExportFormat.PDF,
                includeSections: true
            };

            await expect(exportService.exportToPDF(userId, invalidData))
                .rejects.toThrow('Invalid export data');
        });
    });

    describe('exportToCalendar', () => {
        const calendarExportData = {
            plannerId,
            format: ExportFormat.ICAL,
            includeActivities: true,
            dateRange: {
                start: new Date(),
                end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            calendarName: 'My Planner Calendar'
        };

        it('should successfully export to calendar format', async () => {
            const mockCalendarData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AI Planner//EN
BEGIN:VEVENT
UID:event-123@aiplanner.com
DTSTART:20240101T090000Z
DTEND:20240101T100000Z
SUMMARY:Test Event
END:VEVENT
END:VCALENDAR`;

            jest.spyOn(exportService as any, 'generateICalendar').mockResolvedValue(mockCalendarData);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await exportService.exportToCalendar(userId, calendarExportData);

            expect(result).toHaveProperty('data', mockCalendarData);
            expect(result).toHaveProperty('fileName', 'planner-export.ics');
            expect(result).toHaveProperty('mimeType', 'text/calendar');
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('export.calendar.completed', {
                exportData: expect.any(Object),
                userId
            });
        });

        it('should handle different calendar formats', async () => {
            const csvExportData = {
                ...calendarExportData,
                format: ExportFormat.CSV
            };

            jest.spyOn(exportService as any, 'generateCSV').mockResolvedValue('Title,Start Date,End Date\nTest Event,2024-01-01,2024-01-01');

            const result = await exportService.exportToCalendar(userId, csvExportData);

            expect(result.mimeType).toBe('text/csv');
            expect(result.fileName).toContain('.csv');
        });

        it('should filter events by date range', async () => {
            const limitedRangeData = {
                ...calendarExportData,
                dateRange: {
                    start: new Date(),
                    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Only 7 days
                }
            };

            jest.spyOn(exportService as any, 'generateICalendar').mockResolvedValue('VCALENDAR data');

            await exportService.exportToCalendar(userId, limitedRangeData);

            expect(eventEmitter.emit).toHaveBeenCalledWith('export.calendar.completed',
                expect.objectContaining({
                    exportData: expect.objectContaining({
                        dateRange: limitedRangeData.dateRange
                    })
                })
            );
        });
    });

    describe('exportToHandwriting', () => {
        const handwritingExportData = {
            plannerId,
            format: ExportFormat.SVG,
            handwritingStyle: 'cursive',
            includeSections: true,
            includeActivities: true,
            paperSize: 'A4',
            orientation: 'portrait'
        };

        it('should successfully export to handwriting format', async () => {
            const mockHandwritingData = `<svg width="210mm" height="297mm" xmlns="http://www.w3.org/2000/svg">
        <text x="10" y="20" font-family="cursive" font-size="16">My Planner</text>
      </svg>`;

            jest.spyOn(exportService as any, 'generateHandwriting').mockResolvedValue({
                data: mockHandwritingData,
                format: ExportFormat.SVG
            });
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await exportService.exportToHandwriting(userId, handwritingExportData);

            expect(result).toHaveProperty('data', mockHandwritingData);
            expect(result).toHaveProperty('fileName', 'planner-handwriting.svg');
            expect(result).toHaveProperty('mimeType', 'image/svg+xml');
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('export.handwriting.completed', {
                exportData: expect.any(Object),
                userId
            });
        });

        it('should support different handwriting styles', async () => {
            const printStyleData = {
                ...handwritingExportData,
                handwritingStyle: 'print'
            };

            jest.spyOn(exportService as any, 'generateHandwriting').mockResolvedValue({
                data: 'Print style SVG',
                format: ExportFormat.SVG
            });

            const result = await exportService.exportToHandwriting(userId, printStyleData);

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'export.handwriting.completed',
                expect.objectContaining({
                    exportData: expect.objectContaining({
                        handwritingStyle: 'print'
                    })
                })
            );
        });

        it('should handle different paper sizes', async () => {
            const letterSizeData = {
                ...handwritingExportData,
                paperSize: 'letter',
                orientation: 'landscape'
            };

            jest.spyOn(exportService as any, 'generateHandwriting').mockResolvedValue({
                data: 'Letter size landscape SVG',
                format: ExportFormat.SVG
            });

            const result = await exportService.exportToHandwriting(userId, letterSizeData);

            expect(result.fileName).toContain('handwriting');
        });
    });

    describe('exportData', () => {
        const dataExportConfig = {
            plannerId,
            format: ExportFormat.JSON,
            includeSections: true,
            includeActivities: true,
            includeMetadata: true,
            anonymize: false
        };

        it('should successfully export raw data', async () => {
            const mockPlannerData = {
                id: plannerId,
                title: 'My Planner',
                sections: [
                    {
                        id: 'section-1',
                        title: 'Section 1',
                        activities: [
                            { id: 'activity-1', title: 'Task 1' }
                        ]
                    }
                ],
                metadata: { version: 1 }
            };

            jest.spyOn(exportService as any, 'fetchPlannerData').mockResolvedValue(mockPlannerData);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await exportService.exportData(userId, dataExportConfig);

            expect(result).toHaveProperty('data');
            expect(result.data).toHaveProperty('id', plannerId);
            expect(result.data).toHaveProperty('sections');
            expect(result.sections).toHaveLength(1);
            expect(cacheService.set).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('export.data.completed', {
                exportData: expect.any(Object),
                userId
            });
        });

        it('should anonymize data when requested', async () => {
            const sensitiveData = {
                id: plannerId,
                title: 'John\'s Personal Planner',
                userId: 'john-doe-123',
                sections: [
                    {
                        title: 'Private Tasks',
                        activities: [
                            { title: 'Call mom' }
                        ]
                    }
                ]
            };

            jest.spyOn(exportService as any, 'fetchPlannerData').mockResolvedValue(sensitiveData);

            const result = await exportService.exportData(userId, {
                ...dataExportConfig,
                anonymize: true
            });

            expect(result.data.title).not.toContain('John');
            expect(result.data).not.toHaveProperty('userId');
            expect(result.data.sections[0].title).toBe('Section 1');
        });

        it('should support different data formats', async () => {
            const xmlConfig = {
                ...dataExportConfig,
                format: ExportFormat.XML
            };

            jest.spyOn(exportService as any, 'convertToXML').mockResolvedValue('<planner><title>Test</title></planner>');

            const result = await exportService.exportData(userId, xmlConfig);

            expect(result.mimeType).toBe('application/xml');
            expect(result.fileName).toContain('.xml');
        });

        it('should filter data based on date range', async () => {
            const dateRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31')
            };

            jest.spyOn(exportService as any, 'fetchPlannerData').mockResolvedValue({
                id: plannerId,
                sections: []
            });

            await exportService.exportData(userId, {
                ...dataExportConfig,
                dateRange
            });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'export.data.completed',
                expect.objectContaining({
                    exportData: expect.objectContaining({
                        dateRange
                    })
                })
            );
        });
    });

    describe('getExportHistory', () => {
        it('should successfully retrieve export history', async () => {
            const mockHistory = [
                {
                    id: 'export-1',
                    userId,
                    type: ExportType.PDF,
                    format: ExportFormat.PDF,
                    fileName: 'planner-1.pdf',
                    fileSize: 1024000,
                    createdAt: new Date(),
                    status: 'completed'
                },
                {
                    id: 'export-2',
                    userId,
                    type: ExportType.CALENDAR,
                    format: ExportFormat.ICAL,
                    fileName: 'planner-2.ics',
                    fileSize: 512000,
                    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    status: 'completed'
                }
            ];

            jest.spyOn(exportService as any, 'fetchExportHistory').mockResolvedValue(mockHistory);

            const result = await exportService.getExportHistory(userId);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('type', ExportType.PDF);
            expect(result[1]).toHaveProperty('type', ExportType.CALENDAR);
        });

        it('should support pagination', async () => {
            jest.spyOn(exportService as any, 'fetchExportHistory').mockResolvedValue([]);

            await exportService.getExportHistory(userId, { page: 2, limit: 5 });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'export.history.retrieved',
                expect.objectContaining({
                    userId,
                    pagination: { page: 2, limit: 5 }
                })
            );
        });

        it('should filter by export type', async () => {
            jest.spyOn(exportService as any, 'fetchExportHistory').mockResolvedValue([]);

            await exportService.getExportHistory(userId, {
                filter: { type: ExportType.PDF }
            });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'export.history.retrieved',
                expect.objectContaining({
                    userId,
                    filter: { type: ExportType.PDF }
                })
            );
        });

        it('should handle empty export history', async () => {
            jest.spyOn(exportService as any, 'fetchExportHistory').mockResolvedValue([]);

            const result = await exportService.getExportHistory(userId);

            expect(result).toEqual([]);
        });
    });

    describe('deleteExport', () => {
        it('should successfully delete export', async () => {
            const exportId = 'export-123';
            const existingExport = {
                id: exportId,
                userId,
                fileName: 'test-export.pdf',
                status: 'completed'
            };

            jest.spyOn(exportService as any, 'findExportById').mockResolvedValue(existingExport);
            jest.spyOn(exportService as any, 'deleteExportFile').mockResolvedValue(true);
            jest.spyOn(exportService as any, 'deleteExportRecord').mockResolvedValue(true);
            eventEmitter.emit.mockReturnValue();

            const result = await exportService.deleteExport(userId, exportId);

            expect(result).toBe(true);
            expect(eventEmitter.emit).toHaveBeenCalledWith('export.deleted', {
                exportId,
                userId
            });
        });

        it('should throw error if export not found', async () => {
            jest.spyOn(exportService as any, 'findExportById').mockResolvedValue(null);

            await expect(exportService.deleteExport(userId, 'non-existent'))
                .rejects.toThrow('Export not found');
        });

        it('should only allow owner to delete export', async () => {
            jest.spyOn(exportService as any, 'findExportById').mockResolvedValue({
                id: 'export-123',
                userId: 'different-user-id'
            });

            await expect(exportService.deleteExport(userId, 'export-123'))
                .rejects.toThrow('Export not found or access denied');
        });

        it('should handle file deletion failures', async () => {
            jest.spyOn(exportService as any, 'findExportById').mockResolvedValue({
                id: 'export-123',
                userId,
                fileName: 'test.pdf'
            });
            jest.spyOn(exportService as any, 'deleteExportFile').mockRejectedValue(
                new Error('File not found')
            );

            await expect(exportService.deleteExport(userId, 'export-123'))
                .rejects.toThrow('Failed to delete export file');
        });
    });

    describe('validateExportPermissions', () => {
        it('should validate user has export permissions', async () => {
            jest.spyOn(exportService as any, 'checkUserPermissions').mockResolvedValue({
                canExport: true,
                limits: {
                    maxExportsPerDay: 10,
                    maxFileSize: 50 * 1024 * 1024,
                    formats: ['pdf', 'ical', 'csv']
                }
            });

            const result = await exportService.validateExportPermissions(userId);

            expect(result.canExport).toBe(true);
            expect(result.limits.maxExportsPerDay).toBe(10);
        });

        it('should check plan-based restrictions', async () => {
            jest.spyOn(exportService as any, 'checkUserPermissions').mockResolvedValue({
                canExport: false,
                reason: 'Plan limit exceeded',
                limits: {
                    maxExportsPerDay: 0,
                    maxFileSize: 0,
                    formats: []
                }
            });

            const result = await exportService.validateExportPermissions(userId);

            expect(result.canExport).toBe(false);
            expect(result.reason).toBe('Plan limit exceeded');
        });

        it('should check daily export limits', async () => {
            jest.spyOn(exportService as any, 'getDailyExportCount').mockResolvedValue(10);
            jest.spyOn(exportService as any, 'checkUserPermissions').mockResolvedValue({
                canExport: true,
                limits: { maxExportsPerDay: 10 }
            });

            const result = await exportService.validateExportPermissions(userId);

            expect(result.canExport).toBe(false);
            expect(result.reason).toContain('Daily export limit reached');
        });
    });
});