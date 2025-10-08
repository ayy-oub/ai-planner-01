// src/modules/activity/activity.types.ts
import { Timestamp } from 'firebase-admin/firestore';

export interface Activity {
    id: string;
    sectionId: string;
    plannerId: string;
    title: string;
    description?: string;
    type: ActivityType;
    status: ActivityStatus;
    priority: ActivityPriority;
    dueDate?: Date;
    completedAt?: Date;
    tags: string[];
    attachments: Attachment[];
    aiSuggestions: AISuggestion[];
    metadata: ActivityMetadata;
    recurring?: RecurringSettings;
    assignee?: string; // userId if assigned to someone
    dependencies: string[]; // activity IDs this activity depends on
    reminders: Reminder[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export type ActivityType = 'task' | 'event' | 'note' | 'goal' | 'habit' | 'milestone';
export type ActivityStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'archived';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
}

export interface AISuggestion {
    id: string;
    suggestion: string;
    type: AISuggestionType;
    confidence: number;
    accepted: boolean;
    createdAt: Date;
    aiProvider: 'openai' | 'anthropic' | 'gemini';
}

export type AISuggestionType = 'time_estimate' | 'priority' | 'category' | 'schedule' | 'breakdown' | 'optimize';

export interface ActivityMetadata {
    estimatedDuration?: number; // minutes
    actualDuration?: number; // minutes
    difficulty?: number; // 1-5 scale
    energyLevel?: number; // 1-5 scale
    focusTime?: number; // minutes
    interruptions?: number;
    notes?: string;
    location?: string;
    cost?: number;
    customFields?: Record<string, any>;
}

export interface RecurringSettings {
    frequency: RecurringFrequency;
    interval: number;
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    daysOfMonth?: number[]; // 1-31
    months?: number[]; // 1-12
    endDate?: Date;
    occurrences?: number;
    nextOccurrence?: Date;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Reminder {
    id: string;
    type: 'email' | 'push' | 'sms';
    timeBefore: number; // minutes before due date
    message?: string;
    isActive: boolean;
    createdAt: Date;
}

// Request Types
export interface CreateActivityRequest {
    title: string;
    description?: string;
    type?: ActivityType;
    status?: ActivityStatus;
    priority?: ActivityPriority;
    dueDate?: Date;
    tags?: string[];
    assignee?: string;
    dependencies?: string[];
    recurring?: RecurringSettings;
    reminders?: Reminder[];
    metadata?: Partial<ActivityMetadata>;
}

export interface UpdateActivityRequest {
    title?: string;
    description?: string;
    type?: ActivityType;
    status?: ActivityStatus;
    priority?: ActivityPriority;
    dueDate?: Date;
    tags?: string[];
    assignee?: string;
    dependencies?: string[];
    recurring?: RecurringSettings;
    reminders?: Reminder[];
    metadata?: Partial<ActivityMetadata>;
}

export interface ActivityFilterRequest {
    sectionId?: string;
    plannerId?: string;
    status?: ActivityStatus[];
    priority?: ActivityPriority[];
    type?: ActivityType[];
    tags?: string[];
    assignee?: string[];
    dueDateFrom?: Date;
    dueDateTo?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    search?: string;
    sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title' | 'order';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}

export interface BulkActivityUpdateRequest {
    activityIds: string[];
    updates: Partial<Activity>;
}

export interface BulkActivityDeleteRequest {
    activityIds: string[];
}

export interface ActivityReorderRequest {
    activities: Array<{
        id: string;
        order: number;
    }>;
}

// Response Types
export interface ActivityResponse {
    activity: Activity;
    statistics?: ActivityStatistics;
    dependencies: Activity[]; // Full dependency objects
    assigneeInfo?: {
        userId: string;
        displayName: string;
        photoURL?: string;
    };
}

export interface ActivityListResponse {
    activities: Activity[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    filters: ActivityFilterRequest;
}

export interface ActivityStatistics {
    completionRate: number; // percentage
    averageCompletionTime?: number; // minutes
    totalTimeSpent?: number; // minutes
    overdueCount: number;
    upcomingCount: number;
    activitiesByStatus: Record<ActivityStatus, number>;
    activitiesByPriority: Record<ActivityPriority, number>;
    activitiesByType: Record<ActivityType, number>;
}

// AI Integration Types
export interface AIActivityAnalysis {
    complexity: number; // 1-10 scale
    estimatedDuration: number; // minutes
    suggestedPriority: ActivityPriority;
    suggestedSchedule?: {
        bestTime: string; // "morning" | "afternoon" | "evening"
        bestDay: number; // 0-6 (Sunday-Saturday)
        reasoning: string;
    };
    breakdown?: {
        steps: string[];
        estimatedTimePerStep: number[];
    };
    relatedActivities?: string[]; // activity IDs
    energyLevel: number; // 1-5 scale
    focusRequired: number; // 1-5 scale
}

export interface ActivityInsights {
    productivityTrend: 'improving' | 'declining' | 'stable';
    commonInterruptions: string[];
    bestPerformanceTime: string;
    averageCompletionRate: number;
    suggestedImprovements: string[];
    similarActivities: Array<{
        activityId: string;
        similarity: number;
        title: string;
    }>;
}

// Time Tracking Types
export interface TimeEntry {
    id: string;
    activityId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number; // minutes
    description?: string;
    isActive: boolean;
    createdAt: Date;
}

export interface TimeTrackingSummary {
    totalTime: number; // minutes
    activeEntries: TimeEntry[];
    todayTime: number;
    thisWeekTime: number;
    thisMonthTime: number;
    averageSessionDuration: number;
}

// Collaboration Types
export interface ActivityComment {
    id: string;
    activityId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt?: Date;
    mentions?: string[]; // userIds
    attachments?: Attachment[];
}

export interface ActivityHistory {
    id: string;
    activityId: string;
    action: string;
    changes: Record<string, {
        old: any;
        new: any;
    }>;
    userId: string;
    timestamp: Date;
    metadata?: any;
}