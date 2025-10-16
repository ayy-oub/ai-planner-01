import admin from 'firebase-admin';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

class FirebaseConnection {
    private static instance: FirebaseConnection;
    private app: admin.app.App | null = null;
    private db: admin.firestore.Firestore | null = null;
    private isConnected = false;

    private constructor() {
        this.initializeFirebase();
    }

    static getInstance(): FirebaseConnection {
        if (!FirebaseConnection.instance) {
            FirebaseConnection.instance = new FirebaseConnection();
        }
        return FirebaseConnection.instance;
    }

    private initializeFirebase(): void {
        try {
            if (!this.app) {
                const serviceAccount = {
                    projectId: config.firebase.projectId,
                    clientEmail: config.firebase.clientEmail,
                    privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
                };

                this.app = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: config.firebase.databaseURL,
                    storageBucket: config.firebase.storageBucket,
                });

                this.db = this.app.firestore();

                // Enable offline persistence for better performance
                this.db.settings({
                    ignoreUndefinedProperties: true
                });

                this.isConnected = true;
                logger.info('Firebase connection established successfully');
            }
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error);
            throw new AppError('Firebase initialization failed', 500);
        }
    }

    public getApp(): admin.app.App {
        if (!this.app) {
            throw new Error('Firebase Admin not initialized');
        }
        return this.app;
    }

    getDatabase(): admin.firestore.Firestore {
        if (!this.db || !this.isConnected) {
            throw new AppError('Firebase connection not established', 500);
        }
        return this.db;
    }

    getAuth(): admin.auth.Auth {
        if (!this.app || !this.isConnected) {
            throw new AppError('Firebase connection not established', 500);
        }
        return this.app.auth();
    }

    getStorage(): admin.storage.Storage {
        if (!this.app || !this.isConnected) {
            throw new AppError('Firebase connection not established', 500);
        }
        return this.app.storage();
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.db) return false;

            // Perform a simple operation to check connectivity
            await this.db.collection('__health__').limit(1).get();
            return true;
        } catch (error) {
            logger.error('Firebase health check failed:', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.app) {
                await this.app.delete();
                this.app = null;
                this.db = null;
                this.isConnected = false;
                logger.info('Firebase connection closed');
            }
        } catch (error) {
            logger.error('Error closing Firebase connection:', error);
            throw new AppError('Failed to close Firebase connection', 500);
        }
    }

    get connectionStatus(): boolean {
        return this.isConnected;
    }
}

// Export singleton instance
export const firebaseConnection = FirebaseConnection.getInstance();

export async function connectDatabase(): Promise<void> {
    firebaseConnection.getDatabase(); // ensures initialization
}

export default firebaseConnection;