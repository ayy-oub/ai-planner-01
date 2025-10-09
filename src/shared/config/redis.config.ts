import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

export interface RedisConfig {
    connection: {
        host: string;
        port: number;
        password?: string;
        db: number;
        tls?: boolean;
    };
    pool: {
        min: number;
        max: number;
        acquireTimeoutMillis: number;
        createTimeoutMillis: number;
        destroyTimeoutMillis: number;
        idleTimeoutMillis: number;
        reapIntervalMillis: number;
        createRetryIntervalMillis: number;
    };
    retry: {
        maxRetriesPerRequest: number;
        retryDelayOnFailure: number;
        enableOfflineQueue: boolean;
    };
    keyPrefix: {
        session: string;
        cache: string;
        rateLimit: string;
        socket: string;
    };
    ttl: {
        session: number;
        cache: number;
        rateLimit: number;
    };
}

class RedisManager {
    private static instance: RedisManager;
    private client: Redis | null = null;
    private subscriber: Redis | null = null;
    private publisher: Redis | null = null;

    private constructor() { }

    public static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }

    public initialize(): void {
        try {
            if (!this.client) {
                this.client = new Redis({
                    host: config.redis.host,
                    port: config.redis.port,
                    password: config.redis.password || undefined,
                    db: config.redis.db,
                    tls: config.redis.tls ? {} : undefined,
                    maxRetriesPerRequest: config.redis.retry?.maxRetriesPerRequest ?? 3,
                    enableOfflineQueue: config.redis.retry?.enableOfflineQueue ?? false,
                    lazyConnect: true,
                    retryStrategy(times) {
                        // delay reconnect by 100ms * number of attempts
                        return Math.min(times * 100, 2000);
                    }
                });


                this.subscriber = this.client.duplicate();
                this.publisher = this.client.duplicate();

                this.setupEventHandlers();
                logger.info('Redis client initialized successfully');
            }
        } catch (error) {
            logger.error('Failed to initialize Redis client:', error);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        if (!this.client) return;

        this.client.on('connect', () => {
            logger.info('Redis client connected');
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
        });

        this.client.on('error', (error) => {
            logger.error('Redis client error:', error);
        });

        this.client.on('close', () => {
            logger.warn('Redis client connection closed');
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis client reconnecting');
        });
    }

    public getClient(): Redis {
        if (!this.client) {
            throw new Error('Redis client not initialized');
        }
        return this.client;
    }

    public getSubscriber(): Redis {
        if (!this.subscriber) {
            throw new Error('Redis subscriber not initialized');
        }
        return this.subscriber;
    }

    public getPublisher(): Redis {
        if (!this.publisher) {
            throw new Error('Redis publisher not initialized');
        }
        return this.publisher;
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.client) await this.client.disconnect();
            if (this.subscriber) await this.subscriber.disconnect();
            if (this.publisher) await this.publisher.disconnect();
            logger.info('Redis clients disconnected');
        } catch (error) {
            logger.error('Error disconnecting Redis clients:', error);
            throw error;
        }
    }
}

export const redisManager = RedisManager.getInstance();

// Export convenience functions
export const getRedisClient = (): Redis => redisManager.getClient();
export const getRedisSubscriber = (): Redis => redisManager.getSubscriber();
export const getRedisPublisher = (): Redis => redisManager.getPublisher();

export const redisConfig: RedisConfig = {
    connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        tls: config.redis.tls,
    },
    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
    },
    retry: {
        maxRetriesPerRequest: 3,
        retryDelayOnFailure: 100,
        enableOfflineQueue: false,
    },
    keyPrefix: {
        session: 'session:',
        cache: 'cache:',
        rateLimit: 'rl:',
        socket: 'socket:',
    },
    ttl: {
        session: 60 * 60 * 24, // 24 hours
        cache: 60 * 5, // 5 minutes
        rateLimit: 60 * 15, // 15 minutes
    },
};

export default redisManager;