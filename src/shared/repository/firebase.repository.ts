import { Firestore, CollectionReference, QueryDocumentSnapshot, Query, Timestamp, FieldValue, GeoPoint } from '@google-cloud/firestore';
import { logger } from '../utils/logger';
import { AppError, NotFoundError } from '../utils/errors';
import { FirebaseService } from '../services/firebase.service';
import { BaseRepository, IBaseRepository } from './base.repository';
import { QueryOptions, PaginationOptions, PaginatedResponse } from '../types';

/* -------------------------------------------------------------------------- */
/*                                CONFIG TYPES                                */
/* -------------------------------------------------------------------------- */

export interface FirestoreRepositoryConfig {
    collectionName: string;
    primaryKey?: string;
    softDelete?: boolean;
    auditEnabled?: boolean;
    cacheEnabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              QUERY BUILDER                                 */
/* -------------------------------------------------------------------------- */

export class FirestoreQueryBuilder {
    private query: Query;

    constructor(private collectionRef: CollectionReference) {
        this.query = collectionRef;
    }

    where(field: string, operator: FirebaseFirestore.WhereFilterOp, value: any): this {
        this.query = this.query.where(field, operator, value);
        return this;
    }

    orderBy(field: string, direction: FirebaseFirestore.OrderByDirection = 'asc'): this {
        this.query = this.query.orderBy(field, direction);
        return this;
    }

    limit(limit: number): this {
        this.query = this.query.limit(limit);
        return this;
    }

    startAfter(snapshot: QueryDocumentSnapshot): this {
        this.query = this.query.startAfter(snapshot);
        return this;
    }

    startAt(snapshot: QueryDocumentSnapshot): this {
        this.query = this.query.startAt(snapshot);
        return this;
    }

    build(): Query {
        return this.query;
    }
}

/* -------------------------------------------------------------------------- */
/*                            FIRESTORE UTILITIES                             */
/* -------------------------------------------------------------------------- */

export const firestoreUtils = {
    toFirestore(data: Record<string, any>): Record<string, any> {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            cleaned[key] =
                value instanceof Date ? Timestamp.fromDate(value) : value;
        }
        return cleaned;
    },

    fromFirestore<T extends { id: string }>(doc: QueryDocumentSnapshot): T {
        const data = doc.data();
        for (const field of ['createdAt', 'updatedAt', 'deletedAt']) {
            if (data[field]?.toDate) data[field] = data[field].toDate();
        }
        return { id: doc.id, ...data } as T;
    },

    fieldValue: {
        serverTimestamp: () => FieldValue.serverTimestamp(),
        delete: () => FieldValue.delete(),
        arrayUnion: (...elements: any[]) => FieldValue.arrayUnion(...elements),
        arrayRemove: (...elements: any[]) => FieldValue.arrayRemove(...elements),
        increment: (n: number) => FieldValue.increment(n),
    },

    geoPoint(lat: number, lng: number): GeoPoint {
        return new GeoPoint(lat, lng);
    },
};

/* -------------------------------------------------------------------------- */
/*                            BASE FIRESTORE REPO                             */
/* -------------------------------------------------------------------------- */

export abstract class FirestoreRepository<T extends { id: string }>
    extends BaseRepository<T>
    implements IBaseRepository<T> {
    protected db: Firestore;
    protected collectionRef: CollectionReference;
    protected firebaseService: FirebaseService;
    protected primaryKey: string;

    constructor(protected config: FirestoreRepositoryConfig) {
        super();
        this.firebaseService = FirebaseService.getInstance();
        this.db = this.firebaseService.getFirestore();

        this.collectionRef = this.db.collection(config.collectionName);
        this.primaryKey = config.primaryKey || 'id';
    }

    /* ----------------------------- Query Builder ----------------------------- */
    protected buildQuery(options: QueryOptions = {}): Query {
        let query: Query = this.collectionRef;

        if (this.config.softDelete) {
            query = query.where('isDeleted', '==', false);
        }

        if (options.where) {
            for (const condition of options.where) {
                query = query.where(condition.field, condition.operator, condition.value);
            }
        }

        if (options.orderBy) {
            for (const order of options.orderBy) {
                query = query.orderBy(order.field, order.direction);
            }
        }

        if (options.limit) query = query.limit(options.limit);
        if (options.startAfter) query = query.startAfter(options.startAfter);
        if (options.startAt) query = query.startAt(options.startAt);
        if (options.endAt) query = query.endAt(options.endAt);
        if (options.endBefore) query = query.endBefore(options.endBefore);

        return query;
    }

    /* ------------------------------- CRUD OPS ------------------------------- */

    async findAll(options: QueryOptions = {}): Promise<T[]> {
        try {
            const snapshot = await this.buildQuery(options).get();
            return snapshot.docs.map(doc =>
                firestoreUtils.fromFirestore<T>(doc)
            );
        } catch (err) {
            this.handleError(err, 'findAll');
        }
    }

    async findById(id: string): Promise<T | null> {
        try {
            this.validateId(id);
            const doc = await this.collectionRef.doc(id).get();
            if (!doc.exists) return null;
            const entity = firestoreUtils.fromFirestore<T>(doc as QueryDocumentSnapshot);
            if (this.config.softDelete && (entity as any).isDeleted) return null;
            return entity;
        } catch (err) {
            this.handleError(err, 'findById');
        }
    }

    async findOne(options: QueryOptions): Promise<T | null> {
        try {
            const snapshot = await this.buildQuery({ ...options, limit: 1 }).get();
            return snapshot.empty ? null : firestoreUtils.fromFirestore<T>(snapshot.docs[0]);
        } catch (err) {
            this.handleError(err, 'findOne');
        }
    }

    async create(data: Partial<T>): Promise<T> {
        try {
            this.validate(data);
            this.addTimestamps(data);

            const docRef = this.collectionRef.doc();
            const entity = { id: docRef.id, ...data } as T;
            await docRef.set(firestoreUtils.toFirestore(entity));
            return entity;
        } catch (err) {
            this.handleError(err, 'create');
        }
    }

    async update(id: string, data: Partial<T>): Promise<T> {
        try {
            this.validateId(id);
            this.validate(data, true);
            this.addTimestamps(data, true);
            const docRef = this.collectionRef.doc(id);
            await docRef.update(firestoreUtils.toFirestore(data));
            const updated = await this.findById(id);
            if (!updated) throw new NotFoundError(this.config.collectionName);
            return updated;
        } catch (err) {
            this.handleError(err, 'update');
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            this.validateId(id);
            const docRef = this.collectionRef.doc(id);

            if (this.config.softDelete) {
                await docRef.update({
                    isDeleted: true,
                    deletedAt: Timestamp.fromDate(new Date()),
                });
            } else {
                await docRef.delete();
            }

            return true;
        } catch (err) {
            this.handleError(err, 'delete');
        }
    }

    async exists(id: string): Promise<boolean> {
        try {
            const doc = await this.collectionRef.doc(id).get();
            return doc.exists && (!this.config.softDelete || !(doc.data() as any)?.isDeleted);
        } catch (err) {
            this.handleError(err, 'exists');
        }
    }

    /* ------------------------------ COUNT & PAGINATION ------------------------------ */

    async count(options: QueryOptions = {}): Promise<number> {
        try {
            const query = this.buildQuery(options);
            const snapshot = await query.count().get();
            return snapshot.data().count;
        } catch (err) {
            this.handleError(err, 'count');
        }
    }

    async paginate(options: PaginationOptions): Promise<PaginatedResponse<T>> {
        try {
            const { page = 1, limit = 10, sort = 'createdAt', order = 'asc', cursor } = options;

            const queryOptions: QueryOptions = {
                orderBy: [{ field: sort, direction: order }],
                limit: limit + 1, // fetch one extra to check for next page
                startAfter: cursor,
            };

            const snapshot = await this.buildQuery(queryOptions).get();
            const docs = snapshot.docs.slice(0, limit); // actual page
            const hasNext = snapshot.docs.length > limit;

            const data = docs.map(doc => firestoreUtils.fromFirestore<T>(doc));
            const total = await this.count();
            const totalPages = Math.ceil(total / limit);

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: totalPages,
                    hasNext,
                    hasPrev: page > 1,
                    nextPage: hasNext ? page + 1 : undefined,
                    prevPage: page > 1 ? page - 1 : undefined,
                },
            };
        } catch (err) {
            this.handleError(err, 'paginate');
        }
    }

    /* ----------------------------- BATCH OPERATIONS ----------------------------- */

    async createMany(items: Partial<T>[]): Promise<T[]> {
        try {
            const batch = this.db.batch();
            const created: T[] = [];

            for (const item of items) {
                this.addTimestamps(item);
                const docRef = this.collectionRef.doc();
                const entity = { id: docRef.id, ...item } as T;
                batch.set(docRef, firestoreUtils.toFirestore(entity));
                created.push(entity);
            }

            await batch.commit();
            return created;
        } catch (err) {
            this.handleError(err, 'createMany');
        }
    }

    async updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> {
        try {
            const batch = this.db.batch();
            const updated: T[] = [];

            for (const { id, data } of updates) {
                this.validateId(id);
                this.addTimestamps(data, true);
                const docRef = this.collectionRef.doc(id);
                batch.update(docRef, firestoreUtils.toFirestore(data));
                updated.push({ id, ...data } as T);
            }

            await batch.commit();
            return updated;
        } catch (err) {
            this.handleError(err, 'updateMany');
        }
    }

    async deleteMany(ids: string[]): Promise<number> {
        try {
            const batch = this.db.batch();
            for (const id of ids) {
                const docRef = this.collectionRef.doc(id);
                if (this.config.softDelete) {
                    batch.update(docRef, {
                        isDeleted: true,
                        deletedAt: Timestamp.fromDate(new Date()),
                    });
                } else {
                    batch.delete(docRef);
                }
            }
            await batch.commit();
            return ids.length;
        } catch (err) {
            this.handleError(err, 'deleteMany');
        }
    }

    /* ------------------------------- TRANSACTIONS ------------------------------- */

    async runTransaction<U>(
        fn: (transaction: FirebaseFirestore.Transaction) => Promise<U>
    ): Promise<U> {
        try {
            return await this.db.runTransaction(fn);
        } catch (err) {
            this.handleError(err, 'runTransaction');
        }
    }

    /* -------------------------- UTIL / HELPER FUNCTIONS -------------------------- */

    protected handleError(error: unknown, operation: string): never {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`Firestore ${operation} failed`, { error: err.message });
        throw new AppError(`Firestore ${operation} failed: ${err.message}`, 500);
    }
}

/* -------------------------------------------------------------------------- */
/*                      SOFT DELETE & AUDITABLE VARIANTS                      */
/* -------------------------------------------------------------------------- */

export abstract class SoftDeleteFirestoreRepository<T extends { id: string }>
    extends FirestoreRepository<T> {
    constructor(config: FirestoreRepositoryConfig) {
        super({ ...config, softDelete: true });
    }

    findActive(options: QueryOptions = {}): Promise<T[]> {
        return this.findAll({
            ...options,
            where: [...(options.where || []), { field: 'isDeleted', operator: '==', value: false }],
        });
    }

    findDeleted(options: QueryOptions = {}): Promise<T[]> {
        return this.findAll({
            ...options,
            where: [...(options.where || []), { field: 'isDeleted', operator: '==', value: true }],
        });
    }

    async restore(id: string): Promise<T> {
        return this.update(id, { isDeleted: false, deletedAt: null } as any);
    }

    async hardDelete(id: string): Promise<boolean> {
        const docRef = this.collectionRef.doc(id);
        await docRef.delete();
        return true;
    }
}

export abstract class AuditableFirestoreRepository<T extends { id: string }>
    extends FirestoreRepository<T> {
    async createWithAudit(data: Partial<T>, createdBy: string): Promise<T> {
        (data as any).createdBy = createdBy;
        return this.create(data);
    }

    async updateWithAudit(id: string, data: Partial<T>, updatedBy: string): Promise<T> {
        (data as any).updatedBy = updatedBy;
        return this.update(id, data);
    }
}
