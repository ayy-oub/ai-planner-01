// src/modules/user/user.types.ts
import { Timestamp } from 'firebase-admin/firestore';

/* ------------------------------------------------------------------ */
/*  Enums                                                             */
/* ------------------------------------------------------------------ */
export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
}

export enum UserSubscriptionPlan {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

/* ------------------------------------------------------------------ */
/*  Sub-types                                                         */
/* ------------------------------------------------------------------ */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  defaultView: 'daily' | 'weekly' | 'monthly' | 'grid' | 'list' | 'calendar';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    categories: {
      taskReminders: boolean;
      deadlineAlerts: boolean;
      productivityInsights: boolean;
      marketing: boolean;
      updates: boolean;
    };
  };
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn?: 0 | 1;
  compactMode?: boolean;
  showCompleted?: boolean;
  autoSave?: boolean;
  soundEnabled?: boolean;
  /** optional updatedAt used by repository updates */
  updatedAt?: Date;
}

export interface UserSubscription {
  plan: UserSubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt?: Date;
  startedAt?: Date;
  cancelledAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: string;
  subscriptionId?: string;
  customerId?: string;
  priceId?: string;
  features: string[];
  limits: {
    maxPlanners?: number;
    maxCollaborators?: number;
    maxStorage?: number;
    maxAIRequests?: number;
    planners?: number;
    collaborators?: number;
    storage?: number;
    aiRequests?: number;
  };
}

export interface UserStatistics {
  totalPlanners: number;
  totalTasks: number;
  completedTasks: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate?: Date;
  lastActivity?: Date;
  totalLoginTime?: number;
  aiSuggestionsUsed?: number;
  accountAge?: number;
  loginCount?: number;
  totalTimeSpent?: number;
  productivityScore?: number;
}

export interface UserSecurity {
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];
  sessions?: UserSession[];
  loginHistory?: LoginAttempt[];
  failedLoginAttempts?: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  trustedDevices?: Array<{
    id: string;
    name: string;
    lastUsed: Date;
    createdAt: Date;
  }>;
  recentActivity?: Array<{
    action: string;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    location?: string;
  }>;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  password?: string; // internal only
}

export interface UserSession {
  id?: string;
  sessionId?: string;
  userAgent: string;
  ip: string;
  location?: string;
  deviceInfo?: string | { userAgent: string; ip?: string; location?: string };
  createdAt: Date;
  lastAccessedAt?: Date;
  lastAccessed?: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface LoginAttempt {
  id?: string;
  email?: string;
  timestamp: Date;
  success: boolean;
  ip?: string;
  userAgent?: string;
  location?: string;
  failureReason?: string;
}

export interface UserProfile {
  bio?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    instagram?: string;
  };
  pronouns?: string;
  birthday?: Date;
  timezone?: string;
  language?: string;
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Canonical User entity                                             */
/* ------------------------------------------------------------------ */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  role?: UserRole;
  profile?: UserProfile;
  preferences: UserPreferences;
  subscription: UserSubscription;
  statistics: UserStatistics;
  security: UserSecurity;
  lockedUntil?: Date;
  failedLoginAttempts?: number;
  lastLogin?: Date;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  isActive?: boolean;
  isDeleted?: boolean;
  metadata?: {
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
    lastRefreshAt?: Timestamp;
  };
  password?: string; // internal only
}

/* ------------------------------------------------------------------ */
/*  Other user-scoped types                                           */
/* ------------------------------------------------------------------ */
export interface UserSearchFilters {
  role?: UserRole[];
  subscriptionStatus?: SubscriptionStatus[];
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  searchQuery?: string;
}

export type UserSortField =
  | 'email'
  | 'displayName'
  | 'role'
  | 'subscriptionStatus'
  | 'createdAt'
  | 'updatedAt'
  | 'lastLogin'
  | 'statistics.totalPlanners'
  | 'statistics.productivityScore';

export interface UserSortOptions {
  field: UserSortField;
  order: 'asc' | 'desc';
}

export interface UserExportData {
  user: User;
  planners: any[];
  activities: any[];
  sessions: UserSession[];
  activityLog: UserActivity[];
}

export interface UserActivity {
  id: string;
  userId: string;
  type: string;
  metadata?: any;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

/* ------------------------------------------------------------------ */
/*  Supporting types used by repository / controller                   */
/* ------------------------------------------------------------------ */

/** User settings (stored under user's config/settings doc) */
export interface UserSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  privacy?: {
    showEmail?: boolean;
    showProfile?: boolean;
    dataSharing?: boolean;
  };
  notificationsEnabled?: boolean;
  updatedAt?: Date;
}

/** Notification record stored in `notifications` collection */
export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'email' | 'sms' | 'in_app' | 'push' | 'webhook';
  title: string;
  message: string;
  status?: 'unread' | 'read' | 'dismissed';
  read?: boolean;
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
}

/** Session record stored in `sessions` collection */
export interface SessionRecord extends UserSession {}

/**
 * Represents a user's avatar in storage
 */
export interface AvatarRecord {
  uid: string;
  userId: string;
  filePath: string; // e.g. "avatars/uid.png"
  publicUrl: string; // signed or public URL
  contentType?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents an export operation record
 */
export interface ExportRecord {
  id: string;
  userId: string;
  filePath?: string; // e.g. "exports/user123.zip"
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}