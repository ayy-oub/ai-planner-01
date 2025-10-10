import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Async error handling wrapper
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Async middleware wrapper with enhanced error handling
 */
export const asyncMiddleware = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error: any) {
      // Log the error for debugging
      logger.error('Async middleware error', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.uid,
        requestId: (req as any).requestId,
      });

      // Ensure error is an AppError instance
      if (!(error instanceof AppError)) {
        error = new AppError(
          error.message || 'Internal server error',
          500,
          'INTERNAL_ERROR',
          { originalError: error.message }
        );
      }

      next(error);
    }
  };
};

/**
 * Retry wrapper for async operations
 */
export const retryAsync = async <T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: 'fixed' | 'exponential';
    maxDelay?: number;
    onError?: (error: Error, attempt: number) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> => {
  const {
    attempts = 3,
    delay = 1000,
    backoff = 'fixed',
    maxDelay = 30000,
    onError,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Log error
      logger.warn(`Async operation failed (attempt ${attempt}/${attempts})`, {
        error: error.message,
        attempt,
        attempts,
        delay,
      });

      // Call error handler if provided
      if (onError) {
        onError(error, attempt);
      }

      // Check if we should retry
      if (attempt === attempts || !shouldRetry(error)) {
        break;
      }

      // Calculate delay for next attempt
      let currentDelay = delay;
      if (backoff === 'exponential') {
        currentDelay = Math.min(delay * Math.pow(2, attempt - 1), maxDelay);
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  throw lastError!;
};

/**
 * Timeout wrapper for async operations
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AppError(timeoutMessage, 408, 'TIMEOUT_ERROR'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId!);
    throw error;
  }
};

/**
 * Debounce wrapper for async functions
 */
export const debounceAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
  } = {}
): T => {
  let timeoutId: NodeJS.Timeout | undefined;
  let pendingPromise: Promise<any> | undefined;

  return ((...args: Parameters<T>) => {
    const { leading = false, trailing = true } = options;

    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error: any) {
          reject(error);
        }
      };

      const later = () => {
        timeoutId = undefined;
        if (trailing) {
          pendingPromise = execute();
        }
      };

      const shouldCallNow = leading && !timeoutId;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(later, wait);

      if (shouldCallNow) {
        pendingPromise = execute();
      }

      if (!shouldCallNow && !trailing) {
        resolve(undefined);
      }
    });
  }) as T;
};

/**
 * Throttle wrapper for async functions
 */
export const throttleAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  limit: number
): T => {
  let inProgress = 0;
  let queue: Array<{ resolve: Function; reject: Function; args: Parameters<T> }> = [];

  const processQueue = async () => {
    if (inProgress >= limit || queue.length === 0) {
      return;
    }

    inProgress++;
    const { resolve, reject, args } = queue.shift()!;

    try {
      const result = await func(...args);
      resolve(result);
    } catch (error: any) {
      reject(error);
    } finally {
      inProgress--;
      processQueue(); // Process next item in queue
    }
  };

  return ((...args: Parameters<T>) => {
    return new Promise((resolve, reject) => {
      queue.push({ resolve, reject, args });
      processQueue();
    });
  }) as T;
};

/**
 * Rate limit wrapper for async functions
 */
export const rateLimitAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  maxCalls: number,
  windowMs: number
): T => {
  let calls: number[] = [];

  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    
    // Remove old calls outside the window
    calls = calls.filter(timestamp => now - timestamp < windowMs);
    
    // Check if we can make the call
    if (calls.length >= maxCalls) {
      throw new AppError(
        `Rate limit exceeded. Maximum ${maxCalls} calls per ${windowMs}ms`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }
    
    // Record this call
    calls.push(now);
    
    return func(...args);
  }) as T;
};

/**
 * Circuit breaker wrapper for async operations
 */
export const circuitBreakerAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    onStateChange?: (state: string) => void;
  } = {}
): T => {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    onStateChange,
  } = options;

  let failures = 0;
  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let nextAttempt = 0;

  return (async (...args: Parameters<T>) => {
    if (state === 'open') {
      if (Date.now() < nextAttempt) {
        throw new AppError('Circuit breaker is open', 503, 'CIRCUIT_BREAKER_OPEN');
      }
      state = 'half-open';
      if (onStateChange) onStateChange('half-open');
    }

    try {
      const result = await func(...args);
      
      // Success
      if (state === 'half-open') {
        state = 'closed';
        failures = 0;
        if (onStateChange) onStateChange('closed');
      }
      
      return result;
    } catch (error: any) {
      failures++;
      
      if (failures >= failureThreshold) {
        state = 'open';
        nextAttempt = Date.now() + resetTimeout;
        if (onStateChange) onStateChange('open');
      }
      
      throw error;
    }
  }) as T;
};

/**
 * Cache wrapper for async functions
 */
export const cacheAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  getCacheKey: (...args: Parameters<T>) => string,
  options: {
    ttl?: number;
    cache?: Map<string, { value: any; expiry: number }>;
  } = {}
): T => {
  const { ttl = 60000, cache = new Map() } = options;

  return (async (...args: Parameters<T>) => {
    const key = getCacheKey(...args);
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    // Remove expired entry
    if (cached) {
      cache.delete(key);
    }

    // Execute function
    const result = await func(...args);
    
    // Store in cache
    cache.set(key, {
      value: result,
      expiry: now + ttl,
    });

    return result;
  }) as T;
};

/**
 * Async pool - limit concurrent async operations
 */
export const asyncPool = async <T, U>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T) => Promise<U>
): Promise<U[]> => {
  const results: U[] = [];
  const executing: Promise<void>[] = [];

  for (const item of array) {
    const promise = iteratorFn(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= poolLimit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
};

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onError?: (error: Error, attempt: number, nextDelay: number) => void;
  } = {}
): Promise<T> => {
  const {
    maxAttempts = 5,
    initialDelay = 100,
    maxDelay = 30000,
    factor = 2,
    onError,
  } = options;

  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw error;
      }

      if (onError) {
        onError(error, attempt, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * factor * (0.5 + Math.random()), maxDelay);
    }
  }

  throw new Error('Retry failed');
};

/**
 * Timeout with fallback
 */
export const withFallback = async <T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  try {
    return await withTimeout(primary(), timeoutMs);
  } catch (error: any) {
    if (error.code === 'TIMEOUT_ERROR') {
      return await fallback();
    }
    throw error;
  }
};

/**
 * Async memoization
 */
export const memoizeAsync = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  options: {
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T => {
  const { ttl = Infinity, keyGenerator = (...args) => JSON.stringify(args) } = options;
  const cache = new Map<string, { value: any; expiry: number }>();

  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    if (cached) {
      cache.delete(key);
    }

    const result = await func(...args);
    
    cache.set(key, {
      value: result,
      expiry: ttl === Infinity ? Infinity : now + ttl,
    });

    return result;
  }) as T;
};