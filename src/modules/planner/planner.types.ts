import { Timestamp } from 'firebase-admin/firestore';
import { SectionType, SectionSettings, SectionMetadata } from '../section/section.types';
import { ActivityType, ActivityStatus, ActivityPriority, ActivityMetadata } from '../activity/activity.types';

/*  CORE PLANNER DOMAIN  */
export interface Planner {
  id: string;
  userId: string;
  title: string;
  description?: string;
  color: string;
  icon: string;
  sections: Section[];          // full Section graph
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
  role: Role;
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

/*  SHARED SUB-TYPES  */
export type Role = 'viewer' | 'editor' | 'admin';

/*  SECTION (lightweight – no activities graph)  */
export interface Section {
  id: string;
  plannerId: string;
  title: string;
  description?: string;
  order: number;
  type: SectionType;
  activities: Activity[]; // activities live here
  settings: SectionSettings;
  metadata: SectionMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}



/*  ACTIVITY (lightweight – no parent graph)  */
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
}



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



export interface RecurringSettings {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  months?: number[];
  endDate?: Date;
  occurrences?: number;
  nextOccurrence?: Date;
}

export interface Reminder {
  id: string;
  type: 'email' | 'push' | 'sms';
  timeBefore: number;
  message?: string;
  isActive: boolean;
  createdAt: Date;
}

/*  API REQUEST / RESPONSE  */
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
  role: Role;
  message?: string;
}

export interface DuplicatePlannerRequest {
  title?: string;
  includeActivities?: boolean;
  includeSections?: boolean;
}

export interface ExportPlannerRequest {
  format: 'pdf' | 'json' | 'csv' | 'ics';
  includeSections?: string[];
  includeActivities?: boolean;
  dateRange?: { start: Date; end: Date };
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

/*  RESPONSES  */
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
  role: 'owner' | Role;
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
  role: Role;
  addedAt: Date;
  addedBy: string;
}

/*  AI  */
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

/*  REAL-TIME  */
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