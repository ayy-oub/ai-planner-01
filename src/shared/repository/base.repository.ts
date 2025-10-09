// base-repository.ts
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { PaginationOptions, PaginatedResponse, QueryOptions } from '../types';

/**
 * Public repository interface
 */
export interface IBaseRepository<T> {
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findOne(options: QueryOptions): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  count(options?: QueryOptions): Promise<number>;
  exists(id: string): Promise<boolean>;
  paginate(options: PaginationOptions): Promise<PaginatedResponse<T>>;
}

/**
 * BaseRepository
 *
 * Public methods implement common behavior (validation, sanitize, timestamps, error handling)
 * and delegate to protected abstract *FromDB methods which concrete repositories must implement.
 */
export abstract class BaseRepository<T extends { id: string }> implements IBaseRepository<T> {
  protected abstract readonly collectionName: string;
  protected abstract readonly primaryKey: string;

  // === public implementations ===

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    this.logOperation('findAll', { options });
    try {
      const opts = this.buildQueryOptions(options);
      return await this.findAllFromDB(opts);
    } catch (err: any) {
      this.handleError(err, 'findAll');
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      this.validateId(id);
      this.logOperation('findById', { id });
      const result = await this.findByIdFromDB(id);
      return result;
    } catch (err: any) {
      this.handleError(err, 'findById');
    }
  }

  async findOne(options: QueryOptions): Promise<T | null> {
    try {
      this.logOperation('findOne', { options });
      const opts = this.buildQueryOptions(options);
      return await this.findOneFromDB(opts);
    } catch (err: any) {
      this.handleError(err, 'findOne');
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      this.validate(data, false);
      const sanitized = this.sanitize({ ...data });
      const withTimestamps = this.addTimestamps(sanitized, false);
      await this.onBeforeCreate?.(withTimestamps);
      const created = await this.createInDB(withTimestamps);
      await this.onAfterCreate?.(created);
      return created;
    } catch (err: any) {
      this.handleError(err, 'create');
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      this.validateId(id);
      this.validate(data, true);

      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError(this.collectionName, id);
      }

      const sanitized = this.sanitize({ ...data });
      const withTimestamps = this.addTimestamps(sanitized, true);

      await this.onBeforeUpdate?.(id, withTimestamps);
      const updated = await this.updateInDB(id, withTimestamps);
      await this.onAfterUpdate?.(updated);

      return updated;
    } catch (err: any) {
      this.handleError(err, 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      this.validateId(id);
      await this.onBeforeDelete?.(id);
      const result = await this.deleteInDB(id);
      if (result) {
        await this.onAfterDelete?.(id);
      }
      return result;
    } catch (err: any) {
      this.handleError(err, 'delete');
    }
  }

  async count(options: QueryOptions = {}): Promise<number> {
    try {
      const opts = this.buildQueryOptions(options);
      return await this.countFromDB(opts);
    } catch (err: any) {
      this.handleError(err, 'count');
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      this.validateId(id);
      return await this.existsFromDB(id);
    } catch (err: any) {
      this.handleError(err, 'exists');
    }
  }

  async paginate(options: PaginationOptions): Promise<PaginatedResponse<T>> {
    try {
      // Set safe defaults and validate
      const page = Math.max(1, Math.floor(options.page || 1));
      const limit = Math.min(100, Math.max(1, Math.floor(options.limit || 10)));
      const opts: PaginationOptions = { ...options, page, limit };
      this.validatePagination(opts);
      const { items, total } = await this.paginateFromDB(opts);
      const pagination = this.createPaginationMetadata(total, page, limit);
      return { data: items, pagination };
    } catch (err: any) {
      this.handleError(err, 'paginate');
    }
  }

  // === protected abstract DB hooks (subclasses must implement) ===

  protected abstract findAllFromDB(options: QueryOptions): Promise<T[]>;
  protected abstract findByIdFromDB(id: string): Promise<T | null>;
  protected abstract findOneFromDB(options: QueryOptions): Promise<T | null>;
  protected abstract createInDB(data: Partial<T>): Promise<T>;
  protected abstract updateInDB(id: string, data: Partial<T>): Promise<T>;
  protected abstract deleteInDB(id: string): Promise<boolean>;
  protected abstract countFromDB(options: QueryOptions): Promise<number>;
  protected abstract existsFromDB(id: string): Promise<boolean>;
  protected abstract paginateFromDB(options: PaginationOptions): Promise<{ items: T[]; total: number }>;

  // === hooks for event-driven repositories (optional overrides) ===
  onBeforeCreate?(data: Partial<T>): Promise<void>;
  onAfterCreate?(entity: T): Promise<void>;
  onBeforeUpdate?(id: string, data: Partial<T>): Promise<void>;
  onAfterUpdate?(entity: T): Promise<void>;
  onBeforeDelete?(id: string): Promise<void>;
  onAfterDelete?(id: string): Promise<void>;

  // === helpers & utilities ===

  protected validate(data: Partial<T>, isUpdate: boolean = false): void {
    // Override in subclass for field-specific validation.
    // Provide a default no-op.
  }

  protected validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('Invalid ID format');
    }
  }

  protected handleError(error: Error | any, operation: string): never {
    // Only log unexpected errors (not AppError subclasses) at error level.
    if (!(error instanceof AppError)) {
      logger.error(`Repository operation failed: ${operation}`, {
        error: error?.message ?? String(error),
        collection: this.collectionName,
        stack: error?.stack,
      });
    } else {
      logger.debug(`Repository operation (expected failure): ${operation}`, {
        collection: this.collectionName,
        message: (error as AppError).message,
      });
    }

    // Re-throw AppError as-is
    if (error instanceof AppError) {
      throw error;
    }

    // DB-specific mapping (prefer checking codes on DB adapters in concrete implementations)
    const msg = String(error?.message ?? error);

    if (error && (error.code === 11000 || msg.includes('duplicate key'))) {
      // Mongo duplicate key code 11000
      throw new ValidationError('Resource already exists', { details: { error: msg } });
    }

    if (msg.toLowerCase().includes('not found')) {
      throw new NotFoundError(this.collectionName);
    }

    throw new AppError(`Database operation failed: ${msg}`, 500, 'DATABASE_ERROR', { operation, collection: this.collectionName });
  }

  protected createPaginationMetadata(total: number, page: number, limit: number) {
    const safeLimit = Math.max(1, limit);
    const pages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 1;
    const hasNext = page < pages;
    const hasPrev = page > 1;

    return {
      page,
      limit: safeLimit,
      total,
      pages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : undefined,
      prevPage: hasPrev ? page - 1 : undefined,
    };
  }

  protected buildQueryOptions(options: QueryOptions = {}): QueryOptions {
    return {
      ...options,
      // ... add defaults if required
    };
  }

  protected sanitize(data: Partial<T>): Partial<T> {
    // Remove undefined values and commonly internal fields
    const sanitized = { ...data } as any;

    Object.keys(sanitized).forEach((k) => {
      if (sanitized[k] === undefined) {
        delete sanitized[k];
      }
    });

    // Don't allow callers to change primary key or internal timestamps or version directly
    delete sanitized[this.primaryKey];
    delete sanitized.createdAt;
    delete sanitized.updatedAt;
    delete sanitized.version;

    return sanitized;
  }

  protected addTimestamps(data: Partial<T>, isUpdate: boolean = false): Partial<T> {
    const now = new Date();
    if (!isUpdate) {
      (data as any).createdAt = now;
      (data as any).version = 1;
    } else {
      (data as any).updatedAt = now;
      // version should be incremented by DB/upper layer during update operations (or here if we have the existing entity)
      // leave version handling to update logic that has access to existing entity
    }
    return data;
  }

  protected validatePagination(options: PaginationOptions): void {
    if (!options || typeof options !== 'object') {
      throw new ValidationError('Invalid pagination options');
    }
    if (!options.page || options.page < 1) {
      throw new ValidationError('Page must be greater than 0');
    }
    if (!options.limit || options.limit < 1 || options.limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }
    if (options.sort && typeof options.sort !== 'string') {
      throw new ValidationError('Sort must be a string');
    }
    if (options.order && !['asc', 'desc'].includes(options.order)) {
      throw new ValidationError('Order must be either "asc" or "desc"');
    }
  }

  protected logOperation(operation: string, details: any = {}): void {
    logger.debug(`Repository operation: ${operation}`, {
      collection: this.collectionName,
      ...details,
    });
  }
}
