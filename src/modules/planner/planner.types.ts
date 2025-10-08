// src/modules/planner/planner.types.ts
import { Timestamp } from 'firebase-admin/firestore';

// Planner Types
export interface Planner {
    id: string;
    userId: string;
    title: string;
    description?: string;
    color: string;
    icon: string;
    sections: Section[];
    settings: PlannerSettings;
    collaborators: Collaborator[];
    tags: string[];
    metadata: PlannerMetadata;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date;
}

export interface PlannerSettings {
    isPublic: boolean;
    allowCollaboration: boolean;
    autoArchive: boolean;
    reminderEnabled: boolean;
    defaultView: 'grid' | 'list' | 'calendar';
    theme: 'light' | 'dark' | 'auto';
}

export interface Collaborator {
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
    addedAt: Date;
    addedBy: string;
}

export interface PlannerMetadata {
    version: number;
    schemaVersion: string;
    lastActivityAt: Date;
    totalActivities: number;
    completedActivities: number;
}

export interface Section {
    id: string;
    plannerId: string;
    title: string;
    description?: string;
    order: number;
    type: 'tasks' | 'notes' | 'goals' | 'habits';
    activities: Activity[];
    settings: SectionSettings;
    createdAt: Date;
    updatedAt: Date;
}

export interface SectionSettings {
    collapsed: boolean;
    color: string;
    icon: string;
    visibility: 'visible' | 'hidden' | 'collapsed';
}

export interface Activity {
    id: string;
    sectionId: string;
    plannerId: string;
    title: string;
    description?: string;
    type: 'task' | 'event' | 'note' | 'goal' | 'habit';
    status: ActivityStatus;
    priority: ActivityPriority;
    dueDate?: Date;
    completedAt?: Date;
    tags: string[];
    attachments: Attachment[];
    aiSuggestions: AISuggestion[];
    metadata: ActivityMetadata;
    recurring?: RecurringSettings;
    createdAt: Date;
    updatedAt: Date;
}

export type ActivityStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'archived';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: Date;
}

export interface AISuggestion {
    id: string;
    suggestion: string;
    type: 'time_estimate' | 'priority' | 'category' | 'schedule';
    confidence: number;
    accepted: boolean;
    createdAt: Date;
}

export interface ActivityMetadata {
    estimatedDuration?: number; // minutes
    actualDuration?: number; // minutes
    difficulty?: number; // 1-5 scale
    energyLevel?: number; // 1-5 scale
    focusTime?: number; // minutes
    interruptions?: number;
    notes?: string;
}

export interface RecurringSettings {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval: number;
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    daysOfMonth?: number[]; // 1-31
    months?: number[]; // 1-12
    endDate?: Date;
    occurrences?: number;
}

// Request Types
export interface CreatePlannerRequest {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
    settings?: Partial<PlannerSettings>;
    tags?: string[];
}

export interface UpdatePlannerRequest {
    title?: string;
    description?: string;
    color?: string;
    icon?: string;
    settings?: Partial<PlannerSettings>;
    tags?: string[];
}

export interface PlannerFilterRequest {
    search?: string;
    tags?: string[];
    isArchived?: boolean;
    isPublic?: boolean;
    collaborators?: string[];
    sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'lastActivityAt';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}

export interface SharePlannerRequest {
    email: string;
    role: 'viewer' | 'editor' | 'admin';
    message?: string;
}

export interface DuplicatePlannerRequest {
    title?: string;
    includeActivities?: boolean;
    includeSections?: boolean;
}

// Response Types
export interface PlannerResponse {
    planner: Planner;
    statistics: PlannerStatistics;
    permissions: UserPermissions;
}

export interface PlannerStatistics {
    totalSections: number;
    totalActivities: number;
    completedActivities: number;
    pendingActivities: number;
    overdueActivities: number;
    activitiesByPriority: Record<ActivityPriority, number>;
    activitiesByStatus: Record<ActivityStatus, number>;
}

export interface UserPermissions {
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
    canArchive: boolean;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface PlannerListResponse {
    planners: Planner[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface CollaboratorResponse {
    userId: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: 'viewer' | 'editor' | 'admin';
    addedAt: Date;
    addedBy: string;
}

// AI Integration Types
export interface AIPlannerSuggestion {
    type: 'optimize_schedule' | 'suggest_tasks' | 'categorize' | 'prioritize';
    suggestions: AISuggestionDetail[];
    confidence: number;
    reasoning: string;
}

export interface AISuggestionDetail {
    id: string;
    title: string;
    description: string;
    action: 'add' | 'modify' | 'delete' | 'reorder';
    targetId?: string;
    targetType: 'section' | 'activity';
    metadata?: any;
}

// Export Types
export interface ExportPlannerRequest {
    format: 'pdf' | 'json' | 'csv' | 'ics';
    includeSections?: boolean[];
    includeActivities?: boolean;
    dateRange?: {
        start: Date;
        end: Date;
    };
    template?: string;
}

export interface ImportPlannerRequest {
    format: 'json' | 'csv';
    data: any;
    options?: {
        overwrite: boolean;
        skipDuplicates: boolean;
        mapFields: Record<string, string>;
    };
}

// Activity Filter Types
export interface ActivityFilterRequest {
    status?: ActivityStatus[];
    priority?: ActivityPriority[];
    tags?: string[];
    dueDateFrom?: Date;
    dueDateTo?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    search?: string;
    assignee?: string[];
    sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
}

// Bulk Operation Types
export interface BulkActivityUpdateRequest {
    activityIds: string[];
    updates: Partial<Activity>;
}

export interface BulkActivityDeleteRequest {
    activityIds: string[];
}

// Real-time Collaboration Types
export interface CollaborationEvent {
    type: 'activity_created' | 'activity_updated' | 'activity_deleted' |
    'section_created' | 'section_updated' | 'section_deleted' |
    'planner_updated' | 'user_joined' | 'user_left';
    userId: string;
    data: any;
    timestamp: Date;
}

export interface UserPresence {
    userId: string;
    displayName: string;
    photoURL?: string;
    currentSection?: string;
    lastSeen: Date;
    isActive: boolean;
}