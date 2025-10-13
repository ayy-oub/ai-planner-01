// src/modules/auth/auth.types.ts
import { Request } from 'express';
import {
  User,
  UserRole,
  SubscriptionStatus,
  UserPreferences,
} from '../user/user.types'; // single source

/* ------------------------------------------------------------------ */
/*  Authentication DTOs                                               */
/* ------------------------------------------------------------------ */
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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface JwtPayload {
  uid: string;
  email: string;
  role?: UserRole;
  emailVerified: boolean;
  subscriptionStatus?: SubscriptionStatus;
  type: 'access' | 'refresh' | 'reset' | 'verify';
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

export interface RefreshTokenPayload {
  uid: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface EmailVerificationPayload {
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

export interface PasswordResetPayload {
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

/* ------------------------------------------------------------------ */
/*  Response types (kept from previous auth.types.ts)                 */
/* ------------------------------------------------------------------ */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  message: string;
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

/* ------------------------------------------------------------------ */
/*  Express helper                                                    */
/* ------------------------------------------------------------------ */
export interface AuthRequest extends Request {
  user?: User;
}

/* ------------------------------------------------------------------ */
/*  Missing types added back                                            */
/* ------------------------------------------------------------------ */
export interface UpdateProfileRequest {
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<UserPreferences>;
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