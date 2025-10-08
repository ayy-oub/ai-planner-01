import { initializeApp, deleteApp, FirebaseApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { createClient, RedisClientType } from 'redis';

let firebaseApp: FirebaseApp;
let firestore: Firestore;
let auth: Auth;
let redisClient: RedisClientType;

/**
 * Initialize test database connections
 */
export const initializeTestDatabases = async () => {
    // Initialize Firebase for testing
    if (!firebaseApp && process.env.FIREBASE_PROJECT_ID) {
        firebaseApp = initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID,
            credential: require('firebase-admin').credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        }, 'test-app');

        firestore = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);

        // Use emulator if available
        if (process.env.FIRESTORE_EMULATOR_HOST) {
            firestore.settings({
                host: process.env.FIRESTORE_EMULATOR_HOST,
                ssl: false
            });
        }
    }

    // Initialize Redis for testing
    if (!redisClient && process.env.REDIS_HOST) {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || '6379')
            },
            password: process.env.REDIS_PASSWORD,
            database: parseInt(process.env.REDIS_TEST_DB || '15') // Use separate DB for tests
        });

        await redisClient.connect();
    }

    return { firebaseApp, firestore, auth, redisClient };
};

/**
 * Cleanup test database connections
 */
export const cleanupTestDatabases = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null as any;
    }

    if (firebaseApp) {
        await deleteApp(firebaseApp);
        firebaseApp = null as any;
        firestore = null as any;
        auth = null as any;
    }
};

/**
 * Clear all test data from databases
 */
export const clearTestData = async () => {
    if (firestore) {
        // Clear Firestore collections
        const collections = ['users', 'planners', 'sections', 'activities'];

        for (const collection of collections) {
            const snapshot = await firestore.collection(collection).get();
            const batch = firestore.batch();

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        }
    }

    if (redisClient) {
        // Clear Redis test database
        await redisClient.flushDb();
    }
};

/**
 * Seed test data
 */
export const seedTestData = async (data: {
    users?: any[];
    planners?: any[];
    sections?: any[];
    activities?: any[];
}) => {
    if (firestore) {
        // Seed users
        if (data.users) {
            const batch = firestore.batch();
            data.users.forEach(user => {
                const ref = firestore.collection('users').doc(user.uid);
                batch.set(ref, user);
            });
            await batch.commit();
        }

        // Seed planners
        if (data.planners) {
            const batch = firestore.batch();
            data.planners.forEach(planner => {
                const ref = firestore.collection('planners').doc(planner.id);
                batch.set(ref, planner);
            });
            await batch.commit();
        }

        // Seed sections
        if (data.sections) {
            const batch = firestore.batch();
            data.sections.forEach(section => {
                const ref = firestore.collection('sections').doc(section.id);
                batch.set(ref, section);
            });
            await batch.commit();
        }

        // Seed activities
        if (data.activities) {
            const batch = firestore.batch();
            data.activities.forEach(activity => {
                const ref = firestore.collection('activities').doc(activity.id);
                batch.set(ref, activity);
            });
            await batch.commit();
        }
    }
};

/**
 * Create a test user in Firebase Auth
 */
export const createTestUser = async (userData: {
    uid: string;
    email: string;
    password: string;
    displayName?: string;
    emailVerified?: boolean;
}) => {
    if (!auth) {
        throw new Error('Auth not initialized');
    }

    await auth.createUser({
        uid: userData.uid,
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName || 'Test User',
        emailVerified: userData.emailVerified ?? true
    });

    return userData.uid;
};

/**
 * Delete a test user from Firebase Auth
 */
export const deleteTestUser = async (uid: string) => {
    if (!auth) {
        throw new Error('Auth not initialized');
    }

    try {
        await auth.deleteUser(uid);
    } catch (error) {
        // User might not exist, that's okay
    }
};

/**
 * Create a custom token for testing
 */
export const createCustomToken = async (uid: string, claims?: any) => {
    if (!auth) {
        throw new Error('Auth not initialized');
    }

    return auth.createCustomToken(uid, claims);
};

/**
 * Get Firestore instance
 */
export const getFirestoreInstance = () => {
    if (!firestore) {
        throw new Error('Firestore not initialized');
    }
    return firestore;
};

/**
 * Get Auth instance
 */
export const getAuthInstance = () => {
    if (!auth) {
        throw new Error('Auth not initialized');
    }
    return auth;
};

/**
 * Get Redis client
 */
export const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
};

/**
 * Wait for Firestore document to exist
 */
export const waitForDocument = async (
    collection: string,
    docId: string,
    timeout: number = 5000
) => {
    if (!firestore) {
        throw new Error('Firestore not initialized');
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const doc = await firestore.collection(collection).doc(docId).get();
        if (doc.exists) {
            return doc;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Document ${collection}/${docId} not found within timeout`);
};