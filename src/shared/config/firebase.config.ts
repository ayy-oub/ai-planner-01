import admin from 'firebase-admin';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export interface FirebaseConfig {
    serviceAccount: {
        projectId: string;
        clientEmail: string;
        privateKey: string;
    };
    databaseURL: string;
    storageBucket: string;
}

class FirebaseManager {
    private static instance: FirebaseManager;
    private app: admin.app.App | null = null;

    private constructor() { }

    public static getInstance(): FirebaseManager {
        if (!FirebaseManager.instance) {
            FirebaseManager.instance = new FirebaseManager();
        }
        return FirebaseManager.instance;
    }

    public initialize(): void {
        try {
            if (!this.app) {
                this.app = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: config.firebase.projectId,
                        clientEmail: config.firebase.clientEmail,
                        privateKey: config.firebase.privateKey,
                    }),
                    databaseURL: config.firebase.databaseURL,
                    storageBucket: config.firebase.storageBucket,
                });

                logger.info('Firebase Admin initialized successfully');
            }
        } catch (error) {
            logger.error('Failed to initialize Firebase Admin:', error);
            throw error;
        }
    }

    public getApp(): admin.app.App {
        if (!this.app) {
            throw new Error('Firebase Admin not initialized');
        }
        return this.app;
    }

    public getFirestore(): admin.firestore.Firestore {
        return this.getApp().firestore();
    }

    public getAuth(): admin.auth.Auth {
        return this.getApp().auth();
    }

    public getStorage(): admin.storage.Storage {
        return this.getApp().storage();
    }
}

export const firebaseManager = FirebaseManager.getInstance();

// Export convenience functions
export const getFirestore = (): admin.firestore.Firestore => firebaseManager.getFirestore();
export const getAuth = (): admin.auth.Auth => firebaseManager.getAuth();
export const getStorage = (): admin.storage.Storage => firebaseManager.getStorage();

export default firebaseManager;