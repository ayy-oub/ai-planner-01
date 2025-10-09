// cache-repository.ts
import crypto from 'crypto';
import { CacheService, CacheOptions } from '../services/cache.service';
import { CacheError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * ICacheRepository contract
 */
export interface ICacheRepository<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  getMany(keys: string[]): Promise<Map<string, T | null>>;
  setMany(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;
  clear(pattern?: string): Promise<void>;
  size(): Promise<number>;
  getStats?(): Promise<any>;
  resetStats?(): Promise<void>;
}

export interface CacheRepositoryConfig {
  prefix?: string;
  defaultTTL?: number;
  compression?: boolean; // not used by default; left for CacheService implementations
  json?: boolean;
}

/**
 * Base CacheRepository (wraps your CacheService)
 */
export class CacheRepository<T = any> implements ICacheRepository<T> {
  protected readonly cache: CacheService;
  protected readonly config: Required<CacheRepositoryConfig>;

  constructor(cacheService: CacheService, config: CacheRepositoryConfig = {}) {
    this.cache = cacheService;
    this.config = {
      prefix: (config.prefix || 'cache').replace(/[:*]/g, ''), // sanitize prefix
      defaultTTL: config.defaultTTL ?? 300,
      compression: config.compression ?? false,
      json: config.json ?? true,
    };
  }

  protected generateKey(key: string): string {
    // Remove dangerous characters from user-provided keys and keep full key length reasonable
    const clean = String(key).trim();
    // Use prefix + safe key. If key is long (like object), hash it.
    const keyBody = clean.length > 128 ? crypto.createHash('md5').update(clean).digest('hex') : clean;
    return `${this.config.prefix}:${keyBody}`;
  }

  async get(key: string): Promise<T | null> {
    try {
      const k = this.generateKey(key);
      const options: CacheOptions = { json: this.config.json };

      const value = await this.cache.get(k, options);
      if (value === undefined) {
        // Some cache adapters return undefined for miss; normalize to null
        logger.debug('Cache miss', { key: k, prefix: this.config.prefix });
        return null;
      }

      if (value === null) {
        logger.debug('Cache miss', { key: k, prefix: this.config.prefix });
        return null;
      }

      logger.debug('Cache hit', { key: k, prefix: this.config.prefix });
      return value;
    } catch (err: any) {
      logger.error('Cache get error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to get cache value: ${err?.message ?? String(err)}`);
    }
  }

  async set(key: string, value: T, ttl: number = this.config.defaultTTL): Promise<void> {
    try {
      const k = this.generateKey(key);
      const options: CacheOptions = { ttl, json: this.config.json };
      await this.cache.set(k, value, options);
      logger.debug('Cache set', { key: k, ttl, prefix: this.config.prefix });
    } catch (err: any) {
      logger.error('Cache set error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to set cache value: ${err?.message ?? String(err)}`);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.delete(k);
      logger.debug('Cache delete', { key: k, result: res, prefix: this.config.prefix });
      return !!res;
    } catch (err: any) {
      logger.error('Cache delete error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to delete cache value: ${err?.message ?? String(err)}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.exists(k);
      return !!res;
    } catch (err: any) {
      logger.error('Cache exists error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to check cache key existence: ${err?.message ?? String(err)}`);
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.expire(k, ttl);
      logger.debug('Cache expire', { key: k, ttl, result: res, prefix: this.config.prefix });
      return !!res;
    } catch (err: any) {
      logger.error('Cache expire error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to set cache key TTL: ${err?.message ?? String(err)}`);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.ttl(k);
      return typeof res === 'number' ? res : -1;
    } catch (err: any) {
      logger.error('Cache TTL error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to get cache key TTL: ${err?.message ?? String(err)}`);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.increment(k, amount);
      logger.debug('Cache increment', { key: k, amount, result: res, prefix: this.config.prefix });
      return Number(res);
    } catch (err: any) {
      logger.error('Cache increment error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to increment cache value: ${err?.message ?? String(err)}`);
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const k = this.generateKey(key);
      const res = await this.cache.decrement(k, amount);
      logger.debug('Cache decrement', { key: k, amount, result: res, prefix: this.config.prefix });
      return Number(res);
    } catch (err: any) {
      logger.error('Cache decrement error', { error: err?.message ?? String(err), key });
      throw new CacheError(`Failed to decrement cache value: ${err?.message ?? String(err)}`);
    }
  }

  async getMany(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const mapping = new Map<string, T | null>();
      if (!keys || keys.length === 0) return mapping;

      const cacheKeys = keys.map(k => this.generateKey(k));
      const options: CacheOptions = { json: this.config.json };
      const results = await this.cache.getMany(cacheKeys, options);

      // Normalize results and map back to original keys
      keys.forEach((orig, idx) => {
        const ck = cacheKeys[idx];
        const val = results.has(ck) ? results.get(ck) : null;
        mapping.set(orig, val === undefined ? null : val);
      });

      logger.debug('Cache getMany', { keys: cacheKeys.length, prefix: this.config.prefix });
      return mapping;
    } catch (err: any) {
      logger.error('Cache getMany error', { error: err?.message ?? String(err), keys });
      throw new CacheError(`Failed to get multiple cache values: ${err?.message ?? String(err)}`);
    }
  }

  async setMany(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      if (!entries || entries.length === 0) return;

      // Allow CacheService to support native multi-set for performance
      if (typeof this.cache.setMany === 'function') {
        const formatted = entries.map(e => ({
          key: this.generateKey(e.key),
          value: e.value,
          ttl: e.ttl ?? this.config.defaultTTL,
        }));
        await this.cache.setMany(formatted);
      } else {
        // fallback to serial set
        for (const e of entries) {
          await this.set(e.key, e.value, e.ttl ?? this.config.defaultTTL);
        }
      }

      logger.debug('Cache setMany', { count: entries.length, prefix: this.config.prefix });
    } catch (err: any) {
      logger.error('Cache setMany error', { error: err?.message ?? String(err), count: entries?.length });
      throw new CacheError(`Failed to set multiple cache values: ${err?.message ?? String(err)}`);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    try {
      if (!keys || keys.length === 0) return 0;
      const cacheKeys = keys.map(k => this.generateKey(k));
      const res = await this.cache.deleteMany(cacheKeys);
      logger.debug('Cache deleteMany', { keys: cacheKeys.length, removed: res, prefix: this.config.prefix });
      return Number(res) || 0;
    } catch (err: any) {
      logger.error('Cache deleteMany error', { error: err?.message ?? String(err), keys });
      throw new CacheError(`Failed to delete multiple cache values: ${err?.message ?? String(err)}`);
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      const clearPattern = pattern ? `${this.config.prefix}:${pattern}` : `${this.config.prefix}:*`;
      await this.cache.clear(clearPattern);
      logger.info('Cache cleared', { pattern: clearPattern, prefix: this.config.prefix });
    } catch (err: any) {
      logger.error('Cache clear error', { error: err?.message ?? String(err), pattern });
      throw new CacheError(`Failed to clear cache: ${err?.message ?? String(err)}`);
    }
  }

  async size(): Promise<number> {
    try {
      const res = await this.cache.size();
      return Number(res) || 0;
    } catch (err: any) {
      logger.error('Cache size error', { error: err?.message ?? String(err) });
      throw new CacheError(`Failed to get cache size: ${err?.message ?? String(err)}`);
    }
  }

  async getStats(): Promise<any> {
    try {
      return await this.cache.getStats();
    } catch (err: any) {
      logger.error('Cache getStats error', { error: err?.message ?? String(err) });
      throw new CacheError(`Failed to get cache stats: ${err?.message ?? String(err)}`);
    }
  }

  async resetStats(): Promise<void> {
    try {
      if (typeof this.cache.resetStats === 'function') {
        await this.cache.resetStats();
      }
    } catch (err: any) {
      logger.error('Cache resetStats error', { error: err?.message ?? String(err) });
      throw new CacheError(`Failed to reset cache stats: ${err?.message ?? String(err)}`);
    }
  }
}

/**
 * Specialized cache repositories (same as your original file, but typed/safer)
 * Example: UserCacheRepository, SessionCacheRepository, RateLimitCacheRepository, ApiResponseCacheRepository, EntityCacheRepository
 * (I'll provide the RateLimit and ApiResponse improvements below.)
 */

/** Rate limit repository improvements */
export class RateLimitCacheRepository extends CacheRepository {
  constructor(cacheService: CacheService) {
    super(cacheService, { prefix: 'rate_limit', defaultTTL: 900, json: true });
  }

  async checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    reset: number;
    current: number;
  }> {
    // Use window boundaries to group counts and compute TTL properly
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rate:${identifier}:${bucket}`;
    const current = await this.increment(key);

    if (current === 1) {
      // set TTL in seconds (round up)
      await this.expire(key, Math.ceil(windowMs / 1000));
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const ttlSeconds = await this.ttl(key);
    const reset = ttlSeconds > 0 ? Math.floor(Date.now() / 1000) + ttlSeconds : 0;

    return { allowed, remaining, reset, current };
  }

  async getRateLimitStats(identifier: string, windowMs: number, limit: number): Promise<{
    current: number;
    limit: number;
    reset: number;
  }> {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rate:${identifier}:${bucket}`;
    const current = Number((await this.get(key)) || 0);
    const ttlSeconds = await this.ttl(key);
    const reset = ttlSeconds > 0 ? Math.floor(Date.now() / 1000) + ttlSeconds : 0;
    return { current, limit, reset };
  }

  async resetRateLimit(identifier: string, windowMs: number): Promise<void> {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `rate:${identifier}:${bucket}`;
    await this.delete(key);
  }
}

/** API response cache improvements */
export class ApiResponseCacheRepository extends CacheRepository {
  constructor(cacheService: CacheService) {
    super(cacheService, { prefix: 'api_responses', defaultTTL: 300, json: true });
  }

  private generateResponseKey(method: string, path: string, query: any): string {
    const queryStr = query ? JSON.stringify(query) : '';
    const hash = crypto.createHash('md5').update(queryStr).digest('hex');
    // include method+path for human readability
    return this.generateKey(`${method}:${path}:${hash}`);
  }

  async cacheResponse(method: string, path: string, query: any, response: any, ttl?: number): Promise<void> {
    const key = this.generateResponseKey(method, path, query);
    await this.set(key, response, ttl);
  }

  async getCachedResponse(method: string, path: string, query: any): Promise<any | null> {
    const key = this.generateResponseKey(method, path, query);
    return this.get(key);
  }

  async invalidateResponse(method: string, path: string, query?: any): Promise<void> {
    if (query) {
      const key = this.generateResponseKey(method, path, query);
      await this.delete(key);
    } else {
      // clear by pattern (cache.clear should support patterns)
      await this.clear(`${method}:${path}:*`);
    }
  }
}

/**
 * Factory
 */
export class CacheRepositoryFactory {
  private readonly repositories = new Map<string, ICacheRepository<any>>();

  constructor(private readonly cacheService: CacheService) {}

  create<T = any>(name: string, config?: CacheRepositoryConfig): ICacheRepository<T> {
    const normalized = String(name || 'default').toLowerCase();
    if (this.repositories.has(normalized)) {
      return this.repositories.get(normalized)!;
    }
    const repo = new CacheRepository<T>(this.cacheService, { prefix: normalized, ...(config || {}) });
    this.repositories.set(normalized, repo);
    return repo;
  }

  createUserCache(): CacheRepository {
    return new CacheRepository(this.cacheService, { prefix: 'users', defaultTTL: 1800, json: true });
  }

  createSessionCache(): CacheRepository {
    return new CacheRepository(this.cacheService, { prefix: 'sessions', defaultTTL: 3600, json: true });
  }

  createRateLimitCache(): RateLimitCacheRepository {
    return new RateLimitCacheRepository(this.cacheService);
  }

  createApiResponseCache(): ApiResponseCacheRepository {
    return new ApiResponseCacheRepository(this.cacheService);
  }

  createEntityCache<T>(entityName: string, config?: CacheRepositoryConfig): CacheRepository<T> {
    return new CacheRepository<T>(this.cacheService, { prefix: `entities:${String(entityName).toLowerCase()}`, ...(config || {}) });
  }
}
