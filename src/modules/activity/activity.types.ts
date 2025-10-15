import { Attachment } from "nodemailer/lib/mailer";
import { RecurringSettings, Reminder } from "../planner/planner.types";
import { AISuggestion } from "../ai/ai.types";

/*  DOMAIN-SPECIFIC ACTIVITY TYPES  */
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
    assignee?: string;
    dependencies: string[];
    reminders: Reminder[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    order: number;
}
export type ActivityType = 'task' | 'event' | 'note' | 'goal' | 'habit' | 'milestone';
export type ActivityStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'archived';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ActivityMetadata {
    estimatedDuration?: number;
    actualDuration?: number;
    difficulty?: number;
    energyLevel?: number;
    focusTime?: number;
    interruptions?: number;
    notes?: string;
    location?: string;
    cost?: number;
    customFields?: Record<string, any>;
}
/*  API  */
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
    activities: Array<{ id: string; order: number }>;
}

/*  RESPONSE  */
export interface ActivityResponse {
    activity: Activity;
    statistics?: ActivityStatistics;
    dependencies: Activity[];
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
    completionRate: number;
    averageCompletionTime?: number;
    totalTimeSpent?: number;
    overdueCount: number;
    upcomingCount: number;
    activitiesByStatus: Record<string, number>;
    activitiesByPriority: Record<string, number>;
    activitiesByType: Record<string, number>;
}

/*  AI / ANALYTICS  */
export interface AIActivityAnalysis {
    complexity: number;
    estimatedDuration: number;
    suggestedPriority: ActivityPriority;
    suggestedSchedule?: {
        bestTime: string;
        bestDay: number;
        reasoning: string;
    };
    breakdown?: {
        steps: string[];
        estimatedTimePerStep: number[];
    };
    relatedActivities?: string[];
    energyLevel: number;
    focusRequired: number;
}

export interface ActivityInsights {
    productivityTrend: 'improving' | 'declining' | 'stable';
    commonInterruptions: string[];
    bestPerformanceTime: string;
    averageCompletionRate: number;
    suggestedImprovements: string[];
    similarActivities: Array<{ activityId: string; similarity: number; title: string }>;
}

/*  TIME TRACKING  */
export interface TimeEntry {
    id: string;
    activityId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    description?: string;
    isActive: boolean;
    createdAt: Date;
}

export interface TimeTrackingSummary {
    totalTime: number;
    activeEntries: TimeEntry[];
    todayTime: number;
    thisWeekTime: number;
    thisMonthTime: number;
    averageSessionDuration: number;
}

/*  COLLABORATION  */
export interface ActivityComment {
    id: string;
    activityId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt?: Date;
    mentions?: string[];
    attachments?: Attachment[];
}

export interface ActivityHistory {
    id: string;
    activityId: string;
    action: string;
    changes: Record<string, { old: any; new: any }>;
    userId: string;
    timestamp: Date;
    metadata?: any;
}