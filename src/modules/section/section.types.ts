// src/modules/section/section.types.ts
import { Timestamp } from 'firebase-admin/firestore';

export interface Section {
    id: string;
    plannerId: string;
    title: string;
    description?: string;
    order: number;
    type: SectionType;
    activities: string[]; // Array of activity IDs
    settings: SectionSettings;
    metadata: SectionMetadata;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export type SectionType = 'tasks' | 'notes' | 'goals' | 'habits' | 'milestones';

export interface SectionSettings {
    collapsed: boolean;
    color: string;
    icon: string;
    visibility: 'visible' | 'hidden' | 'collapsed';
    maxActivities?: number;
    autoArchiveCompleted?: boolean;
    defaultActivityType?: 'task' | 'event' | 'note' | 'goal' | 'habit';
}

export interface SectionMetadata {
    totalActivities: number;
    completedActivities: number;
    lastActivityAt: Date;
    averageCompletionTime?: number; // minutes
}

// Request Types
export interface CreateSectionRequest {
    title: string;
    description?: string;
    type: SectionType;
    order?: number;
    settings?: Partial<SectionSettings>;
}

export interface UpdateSectionRequest {
    title?: string;
    description?: string;
    order?: number;
    settings?: Partial<SectionSettings>;
}

export interface ReorderSectionRequest {
    sections: Array<{
        id: string;
        order: number;
    }>;
}

export interface SectionFilterRequest {
    plannerId?: string;
    type?: SectionType[];
    search?: string;
    sortBy?: 'order' | 'title' | 'createdAt' | 'updatedAt' | 'lastActivityAt';
    sortOrder?: 'asc' | 'desc';
}

// Response Types
export interface SectionResponse {
    section: Section;
    statistics: SectionStatistics;
    activities: string[]; // Activity IDs for quick reference
}

export interface SectionStatistics {
    totalActivities: number;
    completedActivities: number;
    pendingActivities: number;
    overdueActivities: number;
    averageCompletionTime?: number;
    activitiesByStatus: Record<string, number>;
    activitiesByPriority: Record<string, number>;
}

export interface SectionListResponse {
    sections: Section[];
    total: number;
    plannerId: string;
}

// Bulk Operations
export interface BulkSectionUpdateRequest {
    sectionIds: string[];
    updates: Partial<Section>;
}

export interface BulkSectionDeleteRequest {
    sectionIds: string[];
}

// AI Suggestions
export interface SectionOptimizationSuggestion {
    type: 'reorder' | 'merge' | 'split' | 'rename';
    suggestion: string;
    confidence: number;
    reasoning: string;
    targetSections?: string[];
    recommendedOrder?: number[];
}