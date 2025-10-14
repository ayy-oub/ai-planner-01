import { ActivityType } from "../activity/activity.types";

/*  DOMAIN-SPECIFIC SECTION TYPES  */
export interface Section {
    id: string;
    plannerId: string;
    title: string;
    description?: string;
    order: number;
    type: SectionType;
    activities: string[];               // only IDs to avoid circular graph
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
    defaultActivityType?: ActivityType;
  }
  
  export interface SectionMetadata {
    totalActivities: number;
    completedActivities: number;
    lastActivityAt: Date;
    averageCompletionTime?: number;
  }
  
  /*  API  */
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
    sections: Array<{ id: string; order: number }>;
  }
  
  export interface SectionFilterRequest {
    plannerId?: string;
    type?: SectionType[];
    search?: string;
    sortBy?: 'order' | 'title' | 'createdAt' | 'updatedAt' | 'lastActivityAt';
    sortOrder?: 'asc' | 'desc';
  }
  
  /*  RESPONSE  */
  export interface SectionResponse {
    section: Section;
    statistics: SectionStatistics;
    activities: string[]; // activity IDs
  }
  
  export interface SectionStatistics {
    totalActivities: number;
    completedActivities: number;
    pendingActivities: number;
    overdueActivities: number;
    averageCompletionTime?: number;
    activitiesByStatus: Record<string, number>;
    activitiesByPriority: Record<string, number>;
    lastActivityAt?: Date;
  }
  
  export interface SectionListResponse {
    sections: Section[];
    total: number;
    plannerId: string;
  }
  
  /*  BULK / AI  */
  export interface BulkSectionUpdateRequest {
    sectionIds: string[];
    updates: Partial<Section>;
  }
  
  export interface BulkSectionDeleteRequest {
    sectionIds: string[];
  }
  
  export interface SectionOptimizationSuggestion {
    type: 'reorder' | 'merge' | 'split' | 'rename';
    suggestion: string;
    confidence: number;
    reasoning: string;
    targetSections?: string[];
    recommendedOrder?: number[];
  }