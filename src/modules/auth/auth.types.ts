// auth.types.ts

import { Request } from 'express';

/**
 * User roles
 */
export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

/**
 * User subscription status
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',     // from first file
  PAST_DUE = 'past_due',   // from second file
  TRIALING = 'trialing',   // from second file
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  // Merged defaultView variants: first file uses 'daily' | 'weekly' | 'monthly'; second uses 'grid' | 'list' | 'calendar'.
  // Choose to support both in union type, but recommend clarifying usage in app.
  defaultView: 'daily' | 'weekly' | 'monthly' | 'grid' | 'list' | 'calendar';
  notifications: boolean | {    // Either a simple boolean or detailed object
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  // Added from second file
  weekStartsOn?: 0 | 1;  // optional for backward compatibility
  compactMode?: boolean;
  showCompleted?: boolean;
  autoSave?: boolean;
  soundEnabled?: boolean;
}

/**
 * User subscription
 */
export interface UserSubscription {
  plan: 'free' | 'premium' | 'enterprise';
  status: SubscriptionStatus;
  expiresAt?: Date;       // from first file (optional)
  startedAt?: Date;       // from first file (optional)
  cancelledAt?: Date;     // from first file (optional)
  currentPeriodStart?: Date; // from second file (optional)
  currentPeriodEnd?: Date;   // from second file (optional)
  trialStart?: Date;         // from second file (optional)
  trialEnd?: Date;           // from second file (optional)
  cancelAtPeriodEnd?: boolean; // from second file (optional)
  paymentMethod?: string;       // from second file
  subscriptionId?: string;      // from second file
  priceId?: string;             // from second file
  features: string[];
  limits: {
    maxPlanners?: number;       // using first file keys but optional
    maxCollaborators?: number;
    maxStorage?: number;
    maxAIRequests?: number;
    planners?: number;          // from second file, optional alternative
    collaborators?: number;
    storage?: number;           // in MB
    aiRequests?: number;
  };
}

/**
 * User statistics
 */
export interface UserStatistics {
  totalPlanners: number;
  totalTasks: number;
  completedTasks: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate?: Date;        // from first file (optional)
  lastActivity?: Date;          // from second file (optional)
  totalLoginTime?: number;      // from first file
  aiSuggestionsUsed?: number;   // from first file
  accountAge?: number;          // from second file (in days)
  loginCount?: number;          // from second file
  totalTimeSpent?: number;      // from second file (in minutes)
  productivityScore?: number;   // from second file (0-100)
}

/**
 * User security
 */
export interface UserSecurity {
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];
  sessions?: UserSession[];      // from first file, optional here
  loginHistory?: LoginAttempt[]; // from first file, optional here
  failedLoginAttempts?: number;  // from second file, optional here
  lockedUntil?: Date;
  passwordChangedAt?: Date;      // from second file, optional here
  trustedDevices?: Array<{       // from second file
    id: string;
    name: string;
    lastUsed: Date;
    createdAt: Date;
  }>;
  recentActivity?: Array<{       // from second file
    action: string;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    location?: string;
  }>;
}

/**
 * User session
 */
export interface UserSession {
  id?: string;               // from first file
  sessionId?: string;        // from second file
  userAgent: string;
  ip: string;
  location?: string;
  deviceInfo?: string | {    // flexible between both files
    userAgent: string;
    ip?: string;
    location?: string;
  };
  createdAt: Date;
  lastAccessedAt?: Date;     // from first file
  lastAccessed?: Date;       // from second file (optional)
  expiresAt: Date;
  isActive: boolean;
}

/**
 * Login attempt
 */
export interface LoginAttempt {
  id?: string;
  email?: string;            // from second file
  timestamp: Date;
  success: boolean;
  ip?: string;
  userAgent?: string;
  location?: string;
  failureReason?: string;
}

/**
 * User profile
 */
export interface UserProfile {
  displayName: string;
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
  timezone: string;
  language: string;
}

/**
 * User base interface
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;   // first file has it here
  photoURL?: string;      // from first file
  emailVerified: boolean;
  role?: UserRole;        // optional for backward compatibility
  profile?: UserProfile;  // optional because first file uses displayName etc. directly
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
}

/**
 * Auth tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Login DTO
 */
export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: {
    userAgent: string;
    deviceId?: string;
  };
}

/**
 * Register DTO
 */
export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
  acceptTerms: boolean;
  marketingEmails?: boolean;
  deviceInfo?: {
    userAgent: string;
    deviceId?: string;
  };
}

/**
 * Token DTO
 */
export interface TokenDto {
  refreshToken: string;
}

/**
 * Forgot Password DTO
 */
export interface ForgotPasswordDto {
  email: string;
  recaptchaToken?: string;
}

/**
 * Reset Password DTO
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Update Profile DTO
 */
export interface UpdateProfileDto {
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * Change Password DTO
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Verify Email DTO
 */
export interface VerifyEmailDto {
  token: string;
}

/**
 * Auth response interfaces
 */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
}

export interface UserProfileResponse {
  user: User;
}

export interface PasswordResetResponse {
  message: string;
}

export interface EmailVerificationResponse {
  message: string;
}

/**
 * JWT Payload
 */
export interface JwtPayload {
  uid: string;
  email: string;
  role?: UserRole;
  emailVerified: boolean;
  subscriptionStatus?: SubscriptionStatus;
  type?: 'access' | 'refresh' | 'reset' | 'verify';
  iat: number;
  exp: number;
}

export interface UserPayload {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  emailVerified?: boolean;
  subscription?: {
    plan: string;
    [key: string]: any;
  };
  lockedUntil?: Date | null;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  uid: string;
  sessionId: string;
  iat: number;
  exp: number;
}

/**
 * Email verification token payload
 */
export interface EmailVerificationPayload {
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Password reset token payload
 */
export interface PasswordResetPayload {
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Two-factor authentication payload
 */
export interface TwoFactorPayload {
  uid: string;
  method: 'authenticator' | 'sms' | 'email';
  iat: number;
  exp: number;
}

/**
 * Auth request - extends Express Request with optional user
 */
export interface AuthRequest extends Request {
  user?: User;
}

/**
 * Validation result types
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Rate limiting config
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Session config
 */
export interface SessionConfig {
  secret: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

/**
 * User creation data
 */
export interface UserCreateData {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
  preferences?: Partial<UserPreferences>;
}

/**
 * User update data
 */
export interface UserUpdateData {
  email?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  pronouns?: string;
  birthday?: Date;
  timezone?: string;
  language?: string;
  preferences?: Partial<UserPreferences>;
  socialLinks?: Partial<UserProfile['socialLinks']>;
}

/**
 * User authentication data
 */
export interface UserAuthData {
  uid: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  subscriptionStatus: SubscriptionStatus;
  twoFactorEnabled: boolean;
}

/**
 * User activity
 */
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  location?: string;
}

/**
 * User notification preferences
 */
export interface UserNotificationPreferences {
  email: {
    plannerUpdates: boolean;
    taskReminders: boolean;
    marketing: boolean;
    weeklyDigest: boolean;
    aiInsights: boolean;
  };
  push: {
    plannerUpdates: boolean;
    taskReminders: boolean;
    dailySummary: boolean;
  };
  sms: {
    taskReminders: boolean;
    urgentAlerts: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
}

/**
 * User export data
 */
export interface UserExportData {
  user: User;
  planners: any[];
  activities: any[];
  sessions: UserSession[];
  activityLog: UserActivity[];
}

/**
 * Password history
 */
export interface PasswordHistory {
  userId: string;
  passwordHash: string;
  createdAt: Date;
}

/**
 * API key
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string; // Hashed
  permissions: string[];
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * Audit log
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: any;
  metadata?: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

/**
 * User search filters
 */
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
  searchQuery?: string; // Search in email, displayName, bio
}

/**
 * User sort options
 */
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

export interface LoginRequest {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  acceptTerms: boolean;
  marketingEmails?: boolean;
  ip?: string;
  userAgent?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
  recaptchaToken?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<UserPreferences>;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SecurityLog {
  id: string;
  userId: string;
  event: string;
  metadata?: any;
  timestamp: Date;
  ip: string;
  userAgent: string;
}