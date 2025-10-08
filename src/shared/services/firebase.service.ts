import * as admin from 'firebase-admin';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

/**
 * Firebase service configuration
 */
export interface FirebaseServiceConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    databaseURL: string;
    storageBucket: string;
}

/**
 * Firebase service
 */
export class FirebaseService {
    private static instance: FirebaseService;
    private app: admin.app.App;
    private firestore: admin.firestore.Firestore;
    private auth: admin.auth.Auth;
    private storage: admin.storage.Storage;
    private initialized = false;

    private constructor() {
        this.initializeApp();
    }

    /**
     * Get Firebase service instance
     */
    static getInstance(): FirebaseService {
        if (!FirebaseService.instance) {
            FirebaseService.instance = new FirebaseService();
        }
        return FirebaseService.instance;
    }

    /**
     * Initialize Firebase app
     */
    private initializeApp(): void {
        try {
            if (this.initialized) {
                return;
            }

            // Check if app is already initialized
            if (admin.apps.length > 0) {
                this.app = admin.apps[0]!;
                logger.info('Using existing Firebase app');
            } else {
                // Initialize new app
                this.app = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: config.firebase.projectId,
                        clientEmail: config.firebase.clientEmail,
                        privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
                    }),
                    databaseURL: config.firebase.databaseURL,
                    storageBucket: config.firebase.storageBucket,
                });

                logger.info('Firebase app initialized', {
                    projectId: config.firebase.projectId,
                });
            }

            this.firestore = this.app.firestore();
            this.auth = this.app.auth();
            this.storage = this.app.storage();
            this.initialized = true;

            this.setupFirestore();
            this.setupAuth();

        } catch (error) {
            logger.error('Failed to initialize Firebase', { error: error.message });
            throw new AppError(`Failed to initialize Firebase: ${error.message}`, 500, 'FIREBASE_INIT_ERROR');
        }
    }

    /**
     * Setup Firestore configuration
     */
    private setupFirestore(): void {
        try {
            // Enable offline persistence in development
            if (config.app.env === 'development' && this.firestore) {
                // Note: Persistence is enabled by default in Admin SDK
            }

            // Set timestamps in snapshots
            this.firestore.settings({
                timestampsInSnapshots: true,
                ignoreUndefinedProperties: true,
            } as any);

            logger.info('Firestore configured');
        } catch (error) {
            logger.error('Failed to setup Firestore', { error: error.message });
        }
    }

    /**
     * Setup Auth configuration
     */
    private setupAuth(): void {
        try {
            // Configure auth settings if needed
            logger.info('Auth configured');
        } catch (error) {
            logger.error('Failed to setup Auth', { error: error.message });
        }
    }

    /**
     * Get Firestore instance
     */
    getFirestore(): admin.firestore.Firestore {
        if (!this.initialized) {
            throw new AppError('Firebase not initialized', 500, 'FIREBASE_NOT_INITIALIZED');
        }
        return this.firestore;
    }

    /**
     * Get Auth instance
     */
    getAuth(): admin.auth.Auth {
        if (!this.initialized) {
            throw new AppError('Firebase not initialized', 500, 'FIREBASE_NOT_INITIALIZED');
        }
        return this.auth;
    }

    /**
     * Get Storage instance
     */
    getStorage(): admin.storage.Storage {
        if (!this.initialized) {
            throw new AppError('Firebase not initialized', 500, 'FIREBASE_NOT_INITIALIZED');
        }
        return this.storage;
    }

    /**
     * Get Firebase app instance
     */
    getApp(): admin.app.App {
        if (!this.initialized) {
            throw new AppError('Firebase not initialized', 500, 'FIREBASE_NOT_INITIALIZED');
        }
        return this.app;
    }

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
        metadata?: admin.storage.UploadMetadata
    ): Promise<admin.storage.UploadResponse> {
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
        metadata?: admin.storage.UploadMetadata
    ): Promise<admin.storage.UploadResponse> {
        try {
            const bucket = this.storage.bucket();
            const file = bucket.file(destination);

            await file.save(buffer, {
                metadata,
            });

            logger.info('Buffer uploaded', { destination });
            return [{}, file];
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
    async getFileMetadata(filePath: string): Promise<admin.storage.FileMetadata> {
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
        options?: admin.storage.GetSignedUrlConfig
    ): Promise<string> {
        try {
            const bucket = this.storage.bucket();
            const [url] = await bucket.file(filePath).getSignedUrl({
                expires,
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

        try {
            // Test Firestore
            await this.firestore.collection('_health').limit(1).get();
            const firestoreHealthy = true;

            // Test Auth
            try {
                await this.auth.listUsers(1);
                const authHealthy = true;
            } catch (error) {
                const authHealthy = false;
            }

            // Test Storage
            try {
                await this.storage.bucket().getMetadata();
                const storageHealthy = true;
            } catch (error) {
                const storageHealthy = false;
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
        return snapshot.docs.map(doc => firebaseUtils.docToObject(doc)!).filter(Boolean);
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
    createBlob(data: Uint8Array): admin.firestore.Blob {
        return admin.firestore.Blob.fromUint8Array(data);
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

export {
    FirebaseService,
    FirebaseServiceConfig,
    firebaseUtils,
};