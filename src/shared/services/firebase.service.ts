// src/services/firebase/firebaseService.ts
import * as admin from 'firebase-admin';
import { UploadOptions, UploadResponse, File, GetSignedUrlConfig, FileMetadata } from '@google-cloud/storage';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import firebaseConnection from '@/infrastructure/database/firebase';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export interface FirebaseServiceConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    databaseURL: string;
    storageBucket: string;
}

/* ------------------------------------------------------------------ */
/* Service class (no longer initialises Firebase)                     */
/* ------------------------------------------------------------------ */
export class FirebaseService {
    private static instance: FirebaseService;

    /* all refs are obtained from firebaseConnection */
    private get firestore(): admin.firestore.Firestore { return firebaseConnection.getDatabase(); }
    private get auth(): admin.auth.Auth { return firebaseConnection.getAuth(); }
    private get storage(): admin.storage.Storage { return firebaseConnection.getStorage(); }
    private get app(): admin.app.App { return firebaseConnection['app']!; } // or expose a getter in FirebaseConnection if you want to keep app private

    constructor() { /* empty – connection already exists */ }

    public static getInstance(): FirebaseService {
        if (!FirebaseService.instance) {
            FirebaseService.instance = new FirebaseService();
        }
        return FirebaseService.instance;
    }

    /* ---------------------------------------------------------------- */
    /* Convenience getters (same names as before)                       */
    /* ---------------------------------------------------------------- */
    get db(): admin.firestore.Firestore { return this.firestore; }
    get authInstance(): admin.auth.Auth { return this.auth; }
    get storageInstance(): admin.storage.Storage { return this.storage; }


    /**
     * Convert Firestore timestamp to Date
     */
    convertToDate(timestamp: admin.firestore.Timestamp): Date {
        return timestamp.toDate();
    }

    /**
     * Convert Date to Firestore timestamp
     */
    convertToTimestamp(date: Date): admin.firestore.Timestamp {
        return admin.firestore.Timestamp.fromDate(date);
    }

    /**
     * Create Firestore field value
     */
    getFieldValue(): typeof admin.firestore.FieldValue {
        return admin.firestore.FieldValue;
    }

    /**
     * Create server timestamp
     */
    serverTimestamp(): admin.firestore.FieldValue {
        return admin.firestore.FieldValue.serverTimestamp();
    }

    /**
     * Create array union
     */
    arrayUnion(...elements: any[]): admin.firestore.FieldValue {
        return admin.firestore.FieldValue.arrayUnion(...elements);
    }

    /**
     * Create array remove
     */
    arrayRemove(...elements: any[]): admin.firestore.FieldValue {
        return admin.firestore.FieldValue.arrayRemove(...elements);
    }

    /**
     * Create increment
     */
    increment(n: number): admin.firestore.FieldValue {
        return admin.firestore.FieldValue.increment(n);
    }

    /**
     * Create delete field
     */
    delete(): admin.firestore.FieldValue {
        return admin.firestore.FieldValue.delete();
    }

    /**
     * Get user by UID
     */
    async getUserByUid(uid: string): Promise<admin.auth.UserRecord | null> {
        try {
            const user = await this.auth.getUser(uid);
            return user;
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                return null;
            }
            logger.error('Failed to get user by UID', { error: error.message, uid });
            throw new AppError(`Failed to get user: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
        try {
            const user = await this.auth.getUserByEmail(email);
            return user;
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                return null;
            }
            logger.error('Failed to get user by email', { error: error.message, email });
            throw new AppError(`Failed to get user: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Get user by UID or throw error if not found
     */
    public async getUser(uid: string): Promise<admin.auth.UserRecord> {
        const user = await this.getUserByUid(uid);
        if (!user) {
            throw new AppError('User not found', 404, 'FIREBASE_USER_NOT_FOUND');
        }
        return user;
    }

    /**
     * Check if user has a specific permission (via custom claims)
     */
    public async checkUserPermission(uid: string, permission: string): Promise<boolean> {
        try {
            const user = await this.auth.getUser(uid);
            const claims = user.customClaims || {};
            const permissions: string[] = claims.permissions || [];

            return permissions.includes(permission);
        } catch (error: any) {
            logger.error('Error checking user permissions', { uid, error: error.message });
            return false;
        }
    }


    /**
     * Create new user
     */
    async createUser(userData: {
        email: string;
        password?: string;
        displayName?: string;
        photoURL?: string;
        disabled?: boolean;
        emailVerified?: boolean;
    }): Promise<admin.auth.UserRecord> {
        try {
            const user = await this.auth.createUser(userData);
            logger.info('User created', { uid: user.uid, email: user.email });
            return user;
        } catch (error: any) {
            logger.error('Failed to create user', { error: error.message, email: userData.email });
            throw new AppError(`Failed to create user: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Update user
     */
    async updateUser(uid: string, userData: Partial<{
        email: string;
        password: string;
        displayName: string;
        photoURL: string;
        disabled: boolean;
        emailVerified: boolean;
    }>): Promise<admin.auth.UserRecord> {
        try {
            const user = await this.auth.updateUser(uid, userData);
            logger.info('User updated', { uid });
            return user;
        } catch (error: any) {
            logger.error('Failed to update user', { error: error.message, uid });
            throw new AppError(`Failed to update user: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Delete user
     */
    async deleteUser(uid: string): Promise<void> {
        try {
            await this.auth.deleteUser(uid);
            logger.info('User deleted', { uid });
        } catch (error: any) {
            logger.error('Failed to delete user', { error: error.message, uid });
            throw new AppError(`Failed to delete user: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Set custom user claims
     */
    async setCustomUserClaims(uid: string, claims: Record<string, any>): Promise<void> {
        try {
            await this.auth.setCustomUserClaims(uid, claims);
            logger.info('Custom claims set', { uid, claims });
        } catch (error: any) {
            logger.error('Failed to set custom claims', { error: error.message, uid });
            throw new AppError(`Failed to set custom claims: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Create custom token
     */
    async createCustomToken(uid: string, additionalClaims?: Record<string, any>): Promise<string> {
        try {
            const token = await this.auth.createCustomToken(uid, additionalClaims);
            logger.info('Custom token created', { uid });
            return token;
        } catch (error: any) {
            logger.error('Failed to create custom token', { error: error.message, uid });
            throw new AppError(`Failed to create custom token: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Verify ID token
     */
    async verifyIdToken(idToken: string, checkRevoked: boolean = false): Promise<admin.auth.DecodedIdToken> {
        try {
            const decodedToken = await this.auth.verifyIdToken(idToken, checkRevoked);
            logger.debug('ID token verified', { uid: decodedToken.uid });
            return decodedToken;
        } catch (error: any) {
            logger.error('Failed to verify ID token', { error: error.message });
            throw new AppError(`Invalid token: ${error.message}`, 401, 'INVALID_TOKEN');
        }
    }

    /**
     * Revoke refresh tokens
     */
    async revokeRefreshTokens(uid: string): Promise<void> {
        try {
            await this.auth.revokeRefreshTokens(uid);
            logger.info('Refresh tokens revoked', { uid });
        } catch (error: any) {
            logger.error('Failed to revoke refresh tokens', { error: error.message, uid });
            throw new AppError(`Failed to revoke refresh tokens: ${error.message}`, 500, 'FIREBASE_AUTH_ERROR');
        }
    }

    /**
     * Upload file to storage
     */
    async uploadFile(
        filePath: string,
        destination: string,
        metadata?: UploadOptions
    ): Promise<UploadResponse> {
        try {
            const bucket = this.storage.bucket();
            const uploadResponse = await bucket.upload(filePath, {
                destination,
                metadata,
            });

            logger.info('File uploaded', { filePath, destination });
            return uploadResponse;
        } catch (error: any) {
            logger.error('Failed to upload file', { error: error.message, filePath });
            throw new AppError(`Failed to upload file: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Upload buffer to storage
     */
    async uploadBuffer(
        buffer: Buffer,
        destination: string,
        metadata?: UploadOptions
    ): Promise<[File]> {
        try {
            const bucket = this.storage.bucket();
            const file = bucket.file(destination);

            await file.save(buffer, {
                metadata,
            });

            logger.info('Buffer uploaded', { destination });
            return [file];
        } catch (error: any) {
            logger.error('Failed to upload buffer', { error: error.message });
            throw new AppError(`Failed to upload buffer: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Get file from storage
     */
    async getFile(filePath: string): Promise<Buffer> {
        try {
            const bucket = this.storage.bucket();
            const file = bucket.file(filePath);
            const [buffer] = await file.download();

            logger.info('File downloaded', { filePath });
            return buffer;
        } catch (error: any) {
            logger.error('Failed to get file', { error: error.message, filePath });
            throw new AppError(`Failed to get file: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Delete file from storage
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            const bucket = this.storage.bucket();
            await bucket.file(filePath).delete();

            logger.info('File deleted', { filePath });
        } catch (error: any) {
            logger.error('Failed to delete file', { error: error.message, filePath });
            throw new AppError(`Failed to delete file: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(filePath: string): Promise<FileMetadata> {
        try {
            const bucket = this.storage.bucket();
            const [metadata] = await bucket.file(filePath).getMetadata();

            logger.debug('File metadata retrieved', { filePath });
            return metadata;
        } catch (error: any) {
            logger.error('Failed to get file metadata', { error: error.message, filePath });
            throw new AppError(`Failed to get file metadata: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Generate signed URL
     */
    async generateSignedUrl(
        filePath: string,
        expires: Date,
        action: 'read' | 'write' | 'delete' | 'resumable',
        options?: Omit<GetSignedUrlConfig, 'expires' | 'action'>
    ): Promise<string> {
        try {
            const bucket = this.storage.bucket();
            const [url] = await bucket.file(filePath).getSignedUrl({
                expires,
                action,
                ...options,
            });

            logger.info('Signed URL generated', { filePath, expires: expires.toISOString() });
            return url;
        } catch (error: any) {
            logger.error('Failed to generate signed URL', { error: error.message, filePath });
            throw new AppError(`Failed to generate signed URL: ${error.message}`, 500, 'FIREBASE_STORAGE_ERROR');
        }
    }

    /**
     * Run Firestore transaction
     */
    async runTransaction<T>(
        updateFunction: (transaction: admin.firestore.Transaction) => Promise<T>
    ): Promise<T> {
        try {
            return await this.firestore.runTransaction(updateFunction);
        } catch (error: any) {
            logger.error('Transaction failed', { error: error.message });
            throw new AppError(`Transaction failed: ${error.message}`, 500, 'FIREBASE_TRANSACTION_ERROR');
        }
    }

    /**
     * Run Firestore batch operation
     */
    async runBatch<T>(
        operations: (batch: admin.firestore.WriteBatch) => void
    ): Promise<void> {
        try {
            const batch = this.firestore.batch();
            operations(batch);
            await batch.commit();

            logger.info('Batch operation completed');
        } catch (error: any) {
            logger.error('Batch operation failed', { error: error.message });
            throw new AppError(`Batch operation failed: ${error.message}`, 500, 'FIREBASE_BATCH_ERROR');
        }
    }

    /**
     * Get Firestore collection
     */
    getCollection(collectionPath: string): admin.firestore.CollectionReference {
        return this.firestore.collection(collectionPath);
    }

    /**
     * Get Firestore document
     */
    getDocument(documentPath: string): admin.firestore.DocumentReference {
        return this.firestore.doc(documentPath);
    }

    /**
     * Create collection group query
     */
    collectionGroup(collectionId: string): admin.firestore.Query {
        return this.firestore.collectionGroup(collectionId);
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        services: {
            firestore: boolean;
            auth: boolean;
            storage: boolean;
        };
        latency: number;
        error?: string;
    }> {
        const start = Date.now();

        let firestoreHealthy = false;
        let authHealthy = false;
        let storageHealthy = false;

        try {
            // Test Firestore
            await this.firestore.collection('_health').limit(1).get();
            firestoreHealthy = true;

            // Test Auth
            try {
                await this.auth.listUsers(1);
                authHealthy = true;
            } catch (error) {
                authHealthy = false;
            }

            // Test Storage
            try {
                await this.storage.bucket().getMetadata();
                storageHealthy = true;
            } catch (error) {
                storageHealthy = false;
            }

            const latency = Date.now() - start;

            return {
                status: (firestoreHealthy && authHealthy && storageHealthy) ? 'healthy' : 'unhealthy',
                services: {
                    firestore: firestoreHealthy,
                    auth: authHealthy,
                    storage: storageHealthy,
                },
                latency,
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                services: {
                    firestore: false,
                    auth: false,
                    storage: false,
                },
                latency: Date.now() - start,
                error: error.message,
            };
        }
    }


    /**
     * Disconnect Firebase
     */
    async disconnect(): Promise<void> {
        try {
            await this.app.delete();
            logger.info('Firebase app disconnected');
        } catch (error: any) {
            logger.error('Failed to disconnect Firebase', { error: error.message });
            throw error;
        }
    }
}

/**
 * Firebase utilities
 */
export const firebaseUtils = {
    /**
     * Convert Firestore document to plain object
     */
    docToObject<T>(doc: admin.firestore.DocumentSnapshot): T | null {
        if (!doc.exists) {
            return null;
        }

        const data = doc.data()!;
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
        } as T;
    },

    /**
     * Convert Firestore query snapshot to array of objects
     */
    querySnapshotToArray<T>(snapshot: admin.firestore.QuerySnapshot): T[] {
        return snapshot.docs
            .map(doc => firebaseUtils.docToObject(doc) as T | undefined)
            .filter((item): item is T => Boolean(item));
    },

    /**
     * Create Firestore GeoPoint
     */
    createGeoPoint(latitude: number, longitude: number): admin.firestore.GeoPoint {
        return new admin.firestore.GeoPoint(latitude, longitude);
    },

    /**
     * Create Firestore Timestamp
     */
    createTimestamp(date?: Date): admin.firestore.Timestamp {
        return date ? admin.firestore.Timestamp.fromDate(date) : admin.firestore.Timestamp.now();
    },

    /**
     * Create Firestore Blob
     */
    createBlob(data: Uint8Array): Buffer {
        return Buffer.from(data);
    },

    /**
     * Parse Firestore document path
     */
    parseDocumentPath(path: string): {
        collection: string;
        documentId: string;
        parentPath?: string;
    } {
        const parts = path.split('/');
        if (parts.length % 2 === 0) {
            throw new Error('Invalid document path');
        }

        return {
            collection: parts[parts.length - 2],
            documentId: parts[parts.length - 1],
            parentPath: parts.slice(0, -2).join('/'),
        };
    },

    /**
     * Build Firestore document path
     */
    buildDocumentPath(collection: string, documentId: string, parentPath?: string): string {
        if (parentPath) {
            return `${parentPath}/${collection}/${documentId}`;
        }
        return `${collection}/${documentId}`;
    },
};