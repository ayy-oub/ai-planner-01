import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface CircuitBreakerOptions {
    failureThreshold: number;      // Number of failures before opening
    resetTimeout: number;          // Time in ms before attempting reset
    monitoringPeriod: number;      // Time window in ms for monitoring
    successThreshold: number;      // Number of successes before closing
}

export enum CircuitState {
    CLOSED = 'CLOSED',      // Normal operation
    OPEN = 'OPEN',          // Failing fast
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export class CircuitBreaker {
    private state: CircuitState;
    private failures: number;
    private successes: number;
    private nextAttempt: number;
    private lastFailureTime: number;

    constructor(
        private name: string,
        private options: CircuitBreakerOptions
    ) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = 0;
        this.lastFailureTime = 0;
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                throw new AppError(
                    `${this.name} service is unavailable`,
                    503,
                    'SERVICE_UNAVAILABLE',
                    { circuitBreakerState: this.state }
                );
            }
            this.state = CircuitState.HALF_OPEN;
            this.successes = 0;
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    private onSuccess(): void {
        this.failures = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;

            if (this.successes >= this.options.successThreshold) {
                this.state = CircuitState.CLOSED;
                logger.info(`Circuit breaker ${this.name} closed after ${this.successes} successes`);
            }
        }
    }

    /**
     * Handle failed execution
     */
    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            this.nextAttempt = Date.now() + this.options.resetTimeout;
            logger.warn(`Circuit breaker ${this.name} reopened after failure in HALF_OPEN state`);
        } else if (this.failures >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttempt = Date.now() + this.options.resetTimeout;
            logger.error(`Circuit breaker ${this.name} opened after ${this.failures} failures`);
        }
    }

    /**
     * Get circuit breaker state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get circuit breaker statistics
     */
    getStats() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            nextAttempt: this.nextAttempt,
            lastFailureTime: this.lastFailureTime,
        };
    }

    /**
     * Reset circuit breaker
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = 0;
        this.lastFailureTime = 0;
        logger.info(`Circuit breaker ${this.name} manually reset`);
    }
}

/**
 * Circuit breaker middleware factory
 */
export const createCircuitBreakerMiddleware = (
    name: string,
    options?: Partial<CircuitBreakerOptions>
) => {
    const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 60000,
        successThreshold: 3,
    };

    const circuitBreaker = new CircuitBreaker(name, {
        ...defaultOptions,
        ...options,
    });

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Execute next middleware with circuit breaker protection
            await circuitBreaker.execute(async () => {
                return new Promise<void>((resolve, reject) => {
                    const originalNext = next;

                    // Override next to capture errors
                    (req as any).next = (error?: any) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                        originalNext(error);
                    };

                    // Continue to next middleware
                    next();
                });
            });
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Pre-configured circuit breakers for common services
 */
export const circuitBreakers = {
    // Firebase circuit breaker
    firebase: new CircuitBreaker('firebase', {
        failureThreshold: 3,
        resetTimeout: 30000, // 30 seconds
        monitoringPeriod: 60000,
        successThreshold: 2,
    }),

    // Redis circuit breaker
    redis: new CircuitBreaker('redis', {
        failureThreshold: 5,
        resetTimeout: 15000, // 15 seconds
        monitoringPeriod: 30000,
        successThreshold: 3,
    }),

    // Email service circuit breaker
    email: new CircuitBreaker('email', {
        failureThreshold: 3,
        resetTimeout: 120000, // 2 minutes
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 2,
    }),

    // AI service circuit breaker
    ai: new CircuitBreaker('ai', {
        failureThreshold: 4,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 120000, // 2 minutes
        successThreshold: 2,
    }),

    // External API circuit breaker
    externalApi: new CircuitBreaker('externalApi', {
        failureThreshold: 5,
        resetTimeout: 180000, // 3 minutes
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
    }),

    // GitHub API
    github: new CircuitBreaker('github', {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 120000,
        successThreshold: 3,
    }),

    // OpenAI API
    openAI: new CircuitBreaker('openAI', {
        failureThreshold: 4,
        resetTimeout: 60000,
        monitoringPeriod: 120000,
        successThreshold: 2,
    }),

    // Google Calendar API
    googleCalendar: new CircuitBreaker('googleCalendar', {
        failureThreshold: 3,
        resetTimeout: 60000,
        monitoringPeriod: 120000,
        successThreshold: 2,
    }),

    // SendGrid API
    sendGrid: new CircuitBreaker('sendGrid', {
        failureThreshold: 3,
        resetTimeout: 120000,
        monitoringPeriod: 300000,
        successThreshold: 2,
    }),
};

/**
 * Circuit breaker health check
 */
export const getCircuitBreakerHealth = () => {
    const health = {
        status: 'healthy',
        circuitBreakers: {},
    };

    for (const [name, breaker] of Object.entries(circuitBreakers)) {
        (health.circuitBreakers as any)[name] = breaker.getStats();

        if (breaker.getState() === CircuitState.OPEN) {
            health.status = 'degraded';
        }
    }

    return health;
};

/**
 * Middleware to expose circuit breaker status
 */
export const circuitBreakerStatus = (req: Request, res: Response) => {
    res.json({
        success: true,
        data: getCircuitBreakerHealth(),
    });
};