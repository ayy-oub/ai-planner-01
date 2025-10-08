import { Firestore, CollectionReference, DocumentReference, QuerySnapshot, DocumentSnapshot, QueryDocumentSnapshot } from '@google-cloud/firestore';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { BaseRepository, IBaseRepository } from './base.repository';
import { QueryOptions, PaginationOptions, PaginatedResponse } from '../types';
import { FirebaseService } from '../services/firebase.service';

/**
 * Firestore repository configuration
 */
export interface FirestoreRepositoryConfig {
    collectionName: string;
    primaryKey?: string;
    softDelete?: boolean;
    auditEnabled?: boolean;
    cacheEnabled?: boolean;
}

/**
 * Firestore query builder
 */
export class FirestoreQueryBuilder {
    private query: FirebaseFirestore.Query;

    constructor(private collectionRef: CollectionReference) {
        this.query = collectionRef;
    }

    /**
     * Add where clause
     */
    where(field: string, operator: FirebaseFirestore.WhereFilterOp, value: any): FirestoreQueryBuilder {
        this.query = this.query.where(field, operator, value);
        return this;
    }

    /**
     * Add order by clause
     */
    orderBy(field: string, direction?: FirebaseFirestore.OrderByDirection): FirestoreQueryBuilder {
        this.query = this.query.orderBy(field, direction);
        return this;
    }

    /**
     * Add limit clause
     */
    limit(limit: number): FirestoreQueryBuilder {
        this.query = this.query.limit(limit);
        return this;
    }

    /**
     * Add offset clause (using startAfter)
     */
    offset(offset: number): FirestoreQueryBuilder {
        // Note: Firestore doesn't have direct offset, use startAfter with cursor
        return this;
    }

    /**
     * Add start after cursor
     */
    startAfter(snapshot: QueryDocumentSnapshot): FirestoreQueryBuilder {
        this.query = this.query.startAfter(snapshot);
        return this;
    }

    /**
     * Add start at cursor
     */
    startAt(snapshot: QueryDocumentSnapshot): FirestoreQueryBuilder {
        this.query = this.query.startAt(snapshot);
        return this;
    }

    /**
     * Build the query
     */
    build(): FirebaseFirestore.Query {
        return this.query;
    }
}

/**
 * Firestore base repository
 */
export abstract class FirestoreRepository<T extends { id: string }>
    extends BaseRepository<T>
    implements IBaseRepository<T> {
    protected db: Firestore;
    protected collectionRef: CollectionReference;
    protected firebaseService: FirebaseService;

    constructor(protected config: FirestoreRepositoryConfig) {
        super();
        this.firebaseService = new FirebaseService();
        this.db = this.firebaseService.getFirestore();
        this.collectionRef = this.db.collection(config.collectionName);
        this.primaryKey = config.primaryKey || 'id';
    }

    /**
     * Convert Firestore document to entity
     */
    protected fromFirestore(doc: QueryDocumentSnapshot): T {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            deletedAt: data.deletedAt?.toDate(),
        } as T;
    }

    /**
     * Convert entity to Firestore document
     */
    protected toFirestore(entity: Partial<T>): Record<string, any> {
        const data = { ...entity } as Record<string, any>;

        // Remove undefined values
        Object.keys(data).forEach(key => {
            if (data[key] === undefined) {
                delete data[key];
            }
        });

        // Convert Date objects to Firestore timestamps
        if (data.createdAt instanceof Date) {
            data.createdAt = this.firebaseService.convertToTimestamp(data.createdAt);
        }
        if (data.updatedAt instanceof Date) {
            data.updatedAt = this.firebaseService.convertToTimestamp(data.updatedAt);
        }
        if (data.deletedAt instanceof Date) {
            data.deletedAt = this.firebaseService.convertToTimestamp(data.deletedAt);
        }

        return data;
    }

    /**
     * Build Firestore query from options
     */
    protected buildQuery(options: QueryOptions = {}): FirebaseFirestore.Query {
        let query: FirebaseFirestore.Query = this.collectionRef;

        // Apply soft delete filter
        if (this.config.softDelete) {
            query = query.where('isDeleted', '==', false);
        }

        // Apply where clauses
        if (options.where) {
            for (const where of options.where) {
                query = query.where(where.field, where.operator, where.value);
            }
        }

        // Apply ordering
        if (options.orderBy) {
            for (const order of options.orderBy) {
                query = query.orderBy(order.field, order.direction);
            }
        }

        // Apply limit
        if (options.limit) {
            query = query.limit(options.limit);
        }

        // Apply pagination cursors
        if (options.startAfter) {
            query = query.startAfter(options.startAfter);
        }

        if (options.startAt) {
            query = query.startAt(options.startAt);
        }

        if (options.endAt) {
            query = query.endAt(options.endAt);
        }

        if (options.endBefore) {
            query = query.endBefore(options.endBefore);
        }

        return query;
    }

    /**
     * Find all entities
     */
    async findAll(options: QueryOptions = {}): Promise<T[]> {
        try {
            this.logOperation('findAll', { options });

            const query = this.buildQuery(options);
            const snapshot = await query.get();

            return snapshot.docs.map(doc => this.fromFirestore(doc));
        } catch (error) {
            this.handleError(error, 'findAll');
        }
    }

    /**
     * Find entity by ID
     */
    async findById(id: string): Promise<T | null> {
        try {
            this.validateId(id);
            this.logOperation('findById', { id });

            const doc = await this.collectionRef.doc(id).get();

            if (!doc.exists) {
                return null;
            }

            const entity = this.fromFirestore(doc);

            // Check soft delete
            if (this.config.softDelete && (entity as any).isDeleted) {
                return null;
            }

            return entity;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find one entity matching criteria
     */
    async findOne(options: QueryOptions): Promise<T | null> {
        try {
            this.logOperation('findOne', { options });

            const query = this.buildQuery({ ...options, limit: 1 });
            const snapshot = await query.get();

            if (snapshot.empty) {
                return null;
            }

            return this.fromFirestore(snapshot.docs[0]);
        } catch (error) {
            this.handleError(error, 'findOne');
        }
    }

    /**
     * Create new entity
     */
    async create(data: Partial<T>): Promise<T> {
        try {
            this.validate(data);
            this.addTimestamps(data);

            this.logOperation('create', { data });

            const docRef = this.collectionRef.doc();
            const firestoreData = this.toFirestore(data);

            await docRef.set({
                ...firestoreData,
                id: docRef.id,
            });

            return this.findById(docRef.id)!;
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Update entity
     */
    async update(id: string, data: Partial<T>): Promise<T> {
        try {
            this.validateId(id);
            this.validate(data, true);
            this.addTimestamps(data, true);

            this.logOperation('update', { id, data });

            const docRef = this.collectionRef.doc(id);
            const firestoreData = this.toFirestore(data);

            await docRef.update(firestoreData);

            const updated = await this.findById(id);
            if (!updated) {
                throw new NotFoundError(this.config.collectionName);
            }

            return updated;
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Delete entity
     */
    async delete(id: string): Promise<boolean> {
        try {
            this.validateId(id);
            this.logOperation('delete', { id });

            const docRef = this.collectionRef.doc(id);

            if (this.config.softDelete) {
                // Soft delete
                await docRef.update({
                    isDeleted: true,
                    deletedAt: this.firebaseService.convertToTimestamp(new Date()),
                });
            } else {
                // Hard delete
                await docRef.delete();
            }

            return true;
        } catch (error) {
            this.handleError(error, 'delete');
        }
    }

    /**
     * Count entities matching criteria
     */
    async count(options: QueryOptions = {}): Promise<number> {
        try {
            this.logOperation('count', { options });

            const query = this.buildQuery(options);
            const snapshot = await query.select(this.primaryKey).get();

            return snapshot.size;
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Check if entity exists
     */
    async exists(id: string): Promise<boolean> {
        try {
            this.validateId(id);
            this.logOperation('exists', { id });

            const doc = await this.collectionRef.doc(id).get();
            return doc.exists && (!this.config.softDelete || !(doc.data() as any)?.isDeleted);
        } catch (error) {
            this.handleError(error, 'exists');
        }
    }

    /**
     * Get paginated results
     */
    async paginate(options: PaginationOptions): Promise<PaginatedResponse<T>> {
        try {
            this.validatePagination(options);
            this.logOperation('paginate', { options });

            const { page, limit, sort, order } = options;
            const offset = (page - 1) * limit;

            // Build query with sorting
            const queryOptions: QueryOptions = {
                orderBy: sort ? [{ field: sort, direction: order || 'asc' }] : undefined,
                limit: limit + 1, // Get one extra to check if there's a next page
            };

            // Apply offset using cursor-based pagination
            if (offset > 0) {
                // Get the document at the offset position
                const offsetQuery = this.buildQuery({
                    ...queryOptions,
                    limit: offset,
                });
                const offsetSnapshot = await offsetQuery.get();

                if (offsetSnapshot.size === offset) {
                    const lastDoc = offsetSnapshot.docs[offset - 1];
                    queryOptions.startAfter = lastDoc;
                }
            }

            const query = this.buildQuery(queryOptions);
            const snapshot = await query.get();

            const hasMore = snapshot.size > limit;
            const docs = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;
            const data = docs.map(doc => this.fromFirestore(doc));

            const total = await this.count(); // This could be optimized

            return {
                data,
                pagination: this.createPaginationMetadata(total, page, limit),
            };
        } catch (error) {
            this.handleError(error, 'paginate');
        }
    }

    /**
     * Find with streaming
     */
    async *findWithStream(options: QueryOptions = {}): AsyncGenerator<T, void, unknown> {
        try {
            const query = this.buildQuery(options);
            const stream = query.stream();

            for await (const doc of stream) {
                yield this.fromFirestore(doc as QueryDocumentSnapshot);
            }
        } catch (error) {
            this.handleError(error, 'findWithStream');
        }
    }

    /**
     * Batch create
     */
    async createMany(items: Partial<T>[]): Promise<T[]> {
        try {
            this.logOperation('createMany', { count: items.length });

            const batch = this.db.batch();
            const createdIds: string[] = [];

            for (const item of items) {
                this.validate(item);
                this.addTimestamps(item);

                const docRef = this.collectionRef.doc();
                const firestoreData = this.toFirestore(item);

                batch.set(docRef, {
                    ...firestoreData,
                    id: docRef.id,
                });

                createdIds.push(docRef.id);
            }

            await batch.commit();

            // Fetch created entities
            return Promise.all(
                createdIds.map(id => this.findById(id))
            ).then(results => results.filter(Boolean) as T[]);
        } catch (error) {
            this.handleError(error, 'createMany');
        }
    }

    /**
     * Batch update
     */
    async updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> {
        try {
            this.logOperation('updateMany', { count: updates.length });

            const batch = this.db.batch();
            const updatedIds: string[] = [];

            for (const update of updates) {
                this.validateId(update.id);
                this.validate(update.data, true);
                this.addTimestamps(update.data, true);

                const docRef = this.collectionRef.doc(update.id);
                const firestoreData = this.toFirestore(update.data);

                batch.update(docRef, firestoreData);
                updatedIds.push(update.id);
            }

            await batch.commit();

            // Fetch updated entities
            return Promise.all(
                updatedIds.map(id => this.findById(id))
            ).then(results => results.filter(Boolean) as T[]);
        } catch (error) {
            this.handleError(error, 'updateMany');
        }
    }

    /**
     * Batch delete
     */
    async deleteMany(ids: string[]): Promise<number> {
        try {
            this.logOperation('deleteMany', { count: ids.length });

            const batch = this.db.batch();

            for (const id of ids) {
                this.validateId(id);

                const docRef = this.collectionRef.doc(id);

                if (this.config.softDelete) {
                    batch.update(docRef, {
                        isDeleted: true,
                        deletedAt: this.firebaseService.convertToTimestamp(new Date()),
                    });
                } else {
                    batch.delete(docRef);
                }
            }

            await batch.commit();
            return ids.length;
        } catch (error) {
            this.handleError(error, 'deleteMany');
        }
    }

    /**
     * Run transaction
     */
    async runTransaction<T>(
        transactionFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>
    ): Promise<T> {
        try {
            return await this.db.runTransaction(transactionFn);
        } catch (error) {
            this.handleError(error, 'runTransaction');
        }
    }

    /**
     * Create compound query
     */
    createCompoundQuery(conditions: Array<{
        field: string;
        operator: FirebaseFirestore.WhereFilterOp;
        value: any;
    }>): FirestoreQueryBuilder {
        let queryBuilder = new FirestoreQueryBuilder(this.collectionRef);

        for (const condition of conditions) {
            queryBuilder = queryBuilder.where(
                condition.field,
                condition.operator,
                condition.value
            );
        }

        return queryBuilder;
    }

    /**
     * Create collection group query
     */
    createCollectionGroupQuery(collectionId: string): FirebaseFirestore.Query {
        return this.db.collectionGroup(collectionId);
    }

    /**
     * Get collection reference
     */
    getCollectionRef(): CollectionReference {
        return this.collectionRef;
    }

    /**
     * Get document reference
     */
    getDocumentRef(id: string): DocumentReference {
        return this.collectionRef.doc(id);
    }

    /**
     * Get Firestore instance
     */
    getFirestore(): Firestore {
        return this.db;
    }
}

/**
 * Firestore repository with soft delete support
 */
export abstract class SoftDeleteFirestoreRepository<T extends { id: string }>
    extends FirestoreRepository<T> {
    constructor(config: FirestoreRepositoryConfig) {
        super({
            ...config,
            softDelete: true,
        });
    }

    /**
     * Find only non-deleted entities
     */
    async findActive(options: QueryOptions = {}): Promise<T[]> {
        return this.findAll({
            ...options,
            where: [
                ...(options.where || []),
                { field: 'isDeleted', operator: '==', value: false },
            ],
        });
    }

    /**
     * Find only deleted entities
     */
    async findDeleted(options: QueryOptions = {}): Promise<T[]> {
        return this.findAll({
            ...options,
            where: [
                ...(options.where || []),
                { field: 'isDeleted', operator: '==', value: true },
            ],
        });
    }

    /**
     * Find all entities including deleted
     */
    async findAllWithDeleted(options: QueryOptions = {}): Promise<T[]> {
        return this.findAll(options);
    }

    /**
     * Restore soft deleted entity
     */
    async restore(id: string): Promise<T> {
        return this.update(id, {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
        } as any);
    }

    /**
     * Permanently delete entity
     */
    async hardDelete(id: string): Promise<boolean> {
        try {
            this.validateId(id);
            this.logOperation('hardDelete', { id });

            const docRef = this.getDocumentRef(id);
            await docRef.delete();

            return true;
        } catch (error) {
            this.handleError(error, 'hardDelete');
        }
    }
}

/**
 * Firestore repository with audit support
 */
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

    async findByCreator(userId: string, options: QueryOptions = {}): Promise<T[]> {
        return this.findAll({
            ...options,
            where: [
                ...(options.where || []),
                { field: 'createdBy', operator: '==', value: userId },
            ],
        });
    }

    async findRecentlyCreated(limit: number = 10): Promise<T[]> {
        return this.findAll({
            orderBy: [{ field: 'createdAt', direction: 'desc' }],
            limit,
        });
    }

    async findRecentlyUpdated(limit: number = 10): Promise<T[]> {
        return this.findAll({
            orderBy: [{ field: 'updatedAt', direction: 'desc' }],
            limit,
        });
    }
}

/**
 * Firestore repository factory
 */
export class FirestoreRepositoryFactory implements IRepositoryFactory {
    private repositories = new Map<string, IBaseRepository<any>>();

    create<T extends { id: string }>(
        name: string,
        entityClass: new () => T,
        config?: Partial<FirestoreRepositoryConfig>
    ): IBaseRepository<T> {
        if (this.repositories.has(name)) {
            return this.repositories.get(name)!;
        }

        const repositoryConfig: FirestoreRepositoryConfig = {
            collectionName: name,
            primaryKey: 'id',
            softDelete: false,
            auditEnabled: false,
            cacheEnabled: false,
            ...config,
        };

        // Create a concrete repository class dynamically
        class DynamicFirestoreRepository extends FirestoreRepository<T> {
            constructor() {
                super(repositoryConfig);
            }
        }

        const repository = new DynamicFirestoreRepository();
        this.repositories.set(name, repository);

        return repository;
    }
}

/**
 * Firestore utilities
 */
export const firestoreUtils = {
    /**
     * Convert Firestore timestamp to Date
     */
    timestampToDate(timestamp: FirebaseFirestore.Timestamp): Date {
        return timestamp.toDate();
    },

    /**
     * Convert Date to Firestore timestamp
     */
    dateToTimestamp(date: Date): FirebaseFirestore.Timestamp {
        return FirebaseFirestore.Timestamp.fromDate(date);
    },

    /**
     * Create Firestore field value
     */
    fieldValue: {
        serverTimestamp: () => FirebaseFirestore.FieldValue.serverTimestamp(),
        delete: () => FirebaseFirestore.FieldValue.delete(),
        arrayUnion: (...elements: any[]) => FirebaseFirestore.FieldValue.arrayUnion(...elements),
        arrayRemove: (...elements: any[]) => FirebaseFirestore.FieldValue.arrayRemove(...elements),
        increment: (n: number) => FirebaseFirestore.FieldValue.increment(n),
    },

    /**
     * Create Firestore GeoPoint
     */
    geoPoint(latitude: number, longitude: number): FirebaseFirestore.GeoPoint {
        return new FirebaseFirestore.GeoPoint(latitude, longitude);
    },

    /**
     * Create Firestore Blob
     */
    blob(bytes: Uint8Array): FirebaseFirestore.Blob {
        return FirebaseFirestore.Blob.fromUint8Array(bytes);
    },
};