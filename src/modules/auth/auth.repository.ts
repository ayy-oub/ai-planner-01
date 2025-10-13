// src/modules/auth/auth.repository.ts
import { SubscriptionStatus, User, UserSubscriptionPlan } from '../user/user.types';
import { AppError, ErrorCode } from '../../shared/utils/errors';
import { logger } from '../../shared/utils/logger';
import firebaseConnection from '../../infrastructure/database/firebase';
import { FirebaseService } from '../../shared/services/firebase.service';
import { injectable, inject } from 'tsyringe';

const firestore = firebaseConnection.getDatabase();

function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      source[key] = deepMerge(target[key], source[key]);
    }
  }
  return { ...target, ...source };
}

@injectable()
export class AuthRepository {
  private collection = firestore.collection('users');

  constructor(
    @inject('FirebaseService') private firebaseService: FirebaseService
  ) {}

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                              */
  /* ------------------------------------------------------------------ */

  async create(userData: Partial<User>): Promise<User> {
    try {
      /* ---------- 1. Hash password (bcrypt, NOT Firebase) ---------- */
      const plainPassword = (userData as User).password;
      let hashedPassword: string | undefined;
      if (plainPassword) {
        const bcrypt = await import('bcryptjs');
        hashedPassword = await bcrypt.hash(plainPassword, 12); // 12 rounds
      }
  
      /* ---------- 2. Create in Firebase Auth (if password provided) ---------- */
      let firebaseUid = userData.uid;
      if (plainPassword) {
        const firebaseUser = await this.firebaseService.createUser({
          email: userData.email!,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          password: plainPassword, // Firebase hashes internally (scrypt)
        });
        firebaseUid = firebaseUser.uid;
      }
  
      /* ---------- 3. Prepare Firestore data (NO password field) ---------- */
      const uid = firebaseUid || this.collection.doc().id;
      const docRef = this.collection.doc(uid);
  
      const userDataWithDefaults: Partial<User> = {
        ...userData,
        uid,
        preferences: {
          theme: 'light',
          accentColor: '#3B82F6',
          defaultView: 'daily',
          notifications: {
            email: true,
            push: true,
            sms: false,
            frequency: 'daily',
            categories: {
              taskReminders: true,
              deadlineAlerts: false,
              productivityInsights: false,
              marketing: false,
              updates: false,
            }
          },
          language: 'en',
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
          ...userData.preferences,
        },
        subscription: {
          plan: UserSubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          features: ['basic-planning', 'basic-export'],
          limits: {
            maxPlanners: 5,
            maxCollaborators: 3,
            maxStorage: 104857600, // 100MB
            maxAIRequests: 50,
          },
          ...userData.subscription,
        },
        statistics: {
          totalPlanners: 0,
          totalTasks: 0,
          completedTasks: 0,
          streakDays: 0,
          longestStreak: 0,
          totalLoginTime: 0,
          aiSuggestionsUsed: 0,
          ...userData.statistics,
        },
        security: {
          twoFactorEnabled: false,
          backupCodes: [],
          sessions: [],
          loginHistory: [],
          password: hashedPassword,
          ...userData.security,
        },
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      /* ---------- 4. Strip password before Firestore write ---------- */
      const { password, ...firestoreData } = userDataWithDefaults;
  
      await docRef.set(firestoreData);
      const doc = await docRef.get();
      return { uid: doc.id, ...doc.data() } as User;
    } catch (error: any) {
      logger.error('Failed to create user in repository', error, { userData });
      if (error.code === 'already-exists') {
        throw new AppError('User already exists', 409, undefined, ErrorCode.USER_ALREADY_EXISTS);
      }
      throw new AppError('Failed to create user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async findById(uid: string): Promise<User | null> {
    try {
      const doc = await this.collection.doc(uid).get();
      if (!doc.exists) return null;
      return { uid: doc.id, ...doc.data() } as User;
    } catch (error: any) {
      logger.error('Failed to find user by ID in repository', error, { uid });
      throw new AppError('Failed to find user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const snapshot = await this.collection.where('email', '==', normalizedEmail).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { uid: doc.id, ...doc.data() } as User;
    } catch (error: any) {
      logger.error('Failed to find user by email in repository', error, { email });
      throw new AppError('Failed to find user by email', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async update(uid: string, updates: Partial<User>): Promise<User> {
    try {
      const docRef = this.collection.doc(uid);
      const doc = await docRef.get();
      if (!doc.exists) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

      const existingData = doc.data() || {};
      const mergedData = deepMerge(existingData, updates);
      await docRef.update({ ...mergedData, updatedAt: new Date() });

      const updatedDoc = await docRef.get();
      return { uid: updatedDoc.id, ...updatedDoc.data() } as User;
    } catch (error: any) {
      logger.error('Failed to update user in repository', error, { uid, updates });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async delete(uid: string): Promise<void> {
    try {
      await this.firebaseService.deleteUser(uid); // delete from Firebase Auth
      const docRef = this.collection.doc(uid);
      const doc = await docRef.get();
      if (!doc.exists) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);
      await docRef.delete();
    } catch (error: any) {
      logger.error('Failed to delete user in repository', error, { uid });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete user', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async countByEmail(email: string): Promise<number> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const snapshot = await this.collection.where('email', '==', normalizedEmail).count().get();
      return snapshot.data().count;
    } catch (error: any) {
      logger.error('Failed to count users by email in repository', error, { email });
      throw new AppError('Failed to count users', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async findByIds(uids: string[]): Promise<User[]> {
    try {
      if (uids.length === 0) return [];
      const batches: string[][] = [];
      while (uids.length) batches.push(uids.splice(0, 10));
      const results: User[] = [];
      for (const batch of batches) {
        const snapshot = await this.collection.where('__name__', 'in', batch).get();
        results.push(...snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      }
      return results;
    } catch (error: any) {
      logger.error('Failed to find users by IDs in repository', error, { uids });
      throw new AppError('Failed to find users', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async findActiveUsers(limit: number = 100): Promise<User[]> {
    try {
      const snapshot = await this.collection
        .where('updatedAt', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    } catch (error: any) {
      logger.error('Failed to find active users in repository', error, { limit });
      throw new AppError('Failed to find active users', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async updateSession(uid: string, sessionId: string, sessionData: any): Promise<void> {
    try {
      const user = await this.findById(uid);
      if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

      const sessions = user.security.sessions || [];
      const index = sessions.findIndex(s => s.id === sessionId);
      if (index >= 0) sessions[index] = { ...sessions[index], ...sessionData };
      else sessions.push(sessionData);

      const trimmedSessions = sessions.slice(-10);
      await this.update(uid, { security: { ...user.security, sessions: trimmedSessions } });
    } catch (error: any) {
      logger.error('Failed to update session in repository', error, { uid, sessionId, sessionData });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update session', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async addLoginAttempt(uid: string, attempt: any): Promise<void> {
    try {
      const user = await this.findById(uid);
      if (!user) throw new AppError('User not found', 404, undefined, ErrorCode.USER_NOT_FOUND);

      const loginHistory = user.security.loginHistory || [];
      loginHistory.push({
        ...attempt,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      });

      const trimmedHistory = loginHistory.slice(-50);
      await this.update(uid, { security: { ...user.security, loginHistory: trimmedHistory } });
    } catch (error: any) {
      logger.error('Failed to add login attempt in repository', error, { uid, attempt });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to add login attempt', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async logActivity(activityData: any): Promise<void> {
    try {
      await firestore.collection('activity_logs').add({ ...activityData, timestamp: new Date() });
    } catch (error: any) {
      logger.error('Failed to log activity in repository', error, activityData);
    }
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    newUsersThisMonth: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalUsersSnapshot,
        activeUsersSnapshot,
        premiumUsersSnapshot,
        newUsersThisMonthSnapshot,
      ] = await Promise.all([
        this.collection.count().get(),
        this.collection.where('updatedAt', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).count().get(),
        this.collection.where('subscription.plan', 'in', ['premium', 'enterprise']).count().get(),
        this.collection.where('createdAt', '>=', startOfMonth).count().get(),
      ]);

      return {
        totalUsers: totalUsersSnapshot.data().count,
        activeUsers: activeUsersSnapshot.data().count,
        premiumUsers: premiumUsersSnapshot.data().count,
        newUsersThisMonth: newUsersThisMonthSnapshot.data().count,
      };
    } catch (error: any) {
      logger.error('Failed to get user stats in repository', error);
      throw new AppError('Failed to get user statistics', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    try {
      const snapshot = await this.collection
        .where('security.passwordResetToken', '==', token)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { uid: doc.id, ...doc.data() } as User;
    } catch (error: any) {
      logger.error('Failed to find user by password reset token in repository', error, { token });
      throw new AppError('Failed to find user by reset token', 500, undefined, ErrorCode.DATABASE_CONNECTION_ERROR);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Security Logs                                                     */
  /* ------------------------------------------------------------------ */

  async getSecurityLogs(userId: string, page: number, limit: number): Promise<any[]> {
    try {
      const snapshot = await firestore
        .collection('security_logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .offset((page - 1) * limit)
        .limit(limit)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Failed to get security logs', error);
      return [];
    }
  }
}