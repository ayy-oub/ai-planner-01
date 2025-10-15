/* ------------------------------------------------------------------ */
/*  export.types.ts  –  domain models for export functionality        */
/* ------------------------------------------------------------------ */

export interface ExportRequest {
    userId: string;
    plannerId?: string;
    sectionIds?: string[];
    activityIds?: string[];
    format: ExportFormat;
    type: ExportType;
    filters?: ExportFilters;
    dateRange?: { start: string; end: string };
    options?: ExportOptions;
    metadata?: Record<string, any>;
}

export interface ExportOptions {
    includeCompleted?: boolean;
    includeArchived?: boolean;
    template?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    timezone?: string;
    locale?: string;
    paperSize?: PaperSize;
    orientation?: PageOrientation;
    margins?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    header?: {
        enabled: boolean;
        text?: string;
        includeDate: boolean;
        includePageNumbers: boolean;
    };
    footer?: {
        enabled: boolean;
        text?: string;
        includeDate: boolean;
        includePageNumbers: boolean;
    };
    styling?: {
        theme: 'light' | 'dark' | 'auto';
        fontSize: number;
        fontFamily: string;
        colorScheme: string;
        showGridLines: boolean;
        highlightPriority: boolean;
        colorCodeCategories: boolean;
    };
    filters?: {
        priority?: ('low' | 'medium' | 'high' | 'urgent')[];
        status?: ('pending' | 'in-progress' | 'completed' | 'cancelled')[];
        tags?: string[];
        categories?: string[];
    };
    grouping?: {
        by: 'date' | 'priority' | 'category' | 'status' | 'none';
        sortOrder: 'asc' | 'desc';
    };
    columns?: string[];
    customFields?: Record<string, any>;
}

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'excel' | 'ical' | 'markdown' | 'html' | 'txt';
export type ExportType = 'planner' | 'section' | 'activity' | 'calendar' | 'report' | 'handwriting';
export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid';
export type PageOrientation = 'portrait' | 'landscape';

export interface ExportResult {
    id: string;
    userId: string;
    status: ExportStatus;
    format: ExportFormat;
    type: ExportType;
    fileUrl?: string;
    fileSize?: number;
    pageCount?: number;
    metadata: {
        originalRequest: ExportRequest;
        processingTime: number;
        itemsExported: number;
        warnings?: string[];
        errors?: string[];
    };
    createdAt: Date;
    updatedAt?: Date;
    completedAt?: Date;
    expiresAt?: Date;
}

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface ExportStats {
    total: number;
    byStatus: Record<string, number>;
    byFormat: Record<string, number>;
    byType: Record<string, number>;
    averageProcessingTime: number;
    successRate: number;
}


export interface ExportFilters {
    status?: string[];
    priority?: string[];
    tags?: string[];
    includeCompleted?: boolean;
    includeArchived?: boolean;
}
export interface ExportTemplate {
    id: string;
    name: string;
    description: string;
    type: ExportType;
    format: ExportFormat;
    options: ExportOptions;
    isDefault: boolean;
    isPublic: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PDFExportData {
    title: string;
    subtitle?: string;
    generatedDate: Date;
    sections: PDFSection[];
    totalTasks: number;
    completedTasks: number;
    statistics: {
        completionRate: number;
        averageTaskDuration: number;
        tasksByPriority: Record<string, number>;
        tasksByStatus: Record<string, number>;
    };
}

export interface PDFSection {
    title: string;
    activities: PDFActivity[];
    subtotal: number;
}

export interface PDFActivity {
    title: string;
    description?: string;
    priority: string;
    status: string;
    dueDate?: Date;
    completedAt?: Date;
    estimatedDuration?: number;
    tags: string[];
    notes?: string;
}

export interface CalendarExportData {
    calendarName: string;
    timezone: string;
    events: CalendarEvent[];
}

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    allDay: boolean;
    location?: string;
    url?: string;
    categories: string[];
    priority: string;
    status: string;
}

export interface HandwritingExportData {
    strokes: HandwritingStroke[];
    canvasSize: {
        width: number;
        height: number;
    };
    background: string;
    metadata: {
        penType: string;
        penSize: number;
        penColor: string;
    };
}

export interface HandwritingStroke {
    points: {
        x: number;
        y: number;
        pressure?: number;
        timestamp: number;
    }[];
    color: string;
    width: number;
    opacity: number;
}

export interface ExportJob {
    id: string;
    userId: string;
    exportId: string;
    status: ExportStatus;
    progress: number;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    attempts: number;
    maxAttempts: number;
}

export interface ExportQuota {
    userId: string;
    plan: 'free' | 'premium' | 'enterprise';
    monthlyQuota: number;
    remainingQuota: number;
    usedThisMonth: number;
    resetsAt: Date;
    unlimited: boolean;
}