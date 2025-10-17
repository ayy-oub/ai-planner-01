// src/infrastructure/database/redis-connection.ts
import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

class RedisConnection {
    private static instance: RedisConnection;
    private client: RedisClient | null = null;
    private publisher: RedisClient | null = null;   // ← NEW
    private subscriber: RedisClient | null = null;  // ← NEW
    private isConnected = false;
    private connectionRetryCount = 0;
    private readonly maxRetries = 5;
    private readonly retryDelay = 3000;

    private constructor() {
        this.initializeRedis().catch(e => {
            logger.error('Redis initialisation failed on start-up', e);
            console.error(e);          // make sure it appears even if logger is mis-configured
            process.exit(1);           // fail fast
        });
    }

    static getInstance(): RedisConnection {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection();
        }
        return RedisConnection.instance;
    }

    /* ---------------------------------------------------------- */
    /*  Initialisation – creates THREE clients                    */
    /* ---------------------------------------------------------- */
    private async initializeRedis(): Promise<void> {
        try {
            const redisOptions: RedisOptions = {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password || undefined,
                db: config.redis.db || 0,
                retryStrategy: (times: number) => {
                    if (times > this.maxRetries) {
                        logger.error('Max Redis reconnection attempts reached');
                        return null;
                    }
                    return this.retryDelay;
                },
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false,
                connectTimeout: 10000,
                commandTimeout: 5000,
                family: 4,
                keepAlive: 30000,
                noDelay: true,
                tls: config.redis.tls ? {} : undefined,
                lazyConnect: true,          // connect explicitly below
            };

            /* 1. main client */
            this.client = new Redis(redisOptions);
            /* 2. publisher */
            this.publisher = this.client.duplicate();
            /* 3. subscriber */
            this.subscriber = this.client.duplicate();

            /* wire events once */
            [this.client, this.publisher, this.subscriber].forEach((c) =>
                this.setupEventHandlers(c),
            );

            /* connect all three */
            await Promise.all([
                this.client.connect(),
                //this.publisher.connect(),
                //this.subscriber.connect(),
            ]);

            this.isConnected = true;
            this.connectionRetryCount = 0;
            logger.info('Redis connection established (client + pub + sub)');
        } catch (error: unknown) {
            logger.error('Failed to initialise Redis:', error);
            await this.handleConnectionError(error);
        }
    }

    /* ---------------------------------------------------------- */
    /*  Event handlers – per-client                               */
    /* ---------------------------------------------------------- */
    private setupEventHandlers(client: RedisClient): void {
        client.on('connect', () => {
            logger.info('Redis client connected');
        });
        client.on('ready', () => {
            logger.info('Redis client ready');
            this.isConnected = true;
        });
        client.on('error', (err) => {
            logger.error('Redis client error');
            this.isConnected = false;
        });
        client.on('reconnecting', () => {
            logger.info('Redis client reconnecting');
            this.connectionRetryCount++;
        });
        client.on('end', () => {
            logger.warn('Redis connection ended');
            this.isConnected = false;
        });
    }

    /* ---------------------------------------------------------- */
    /*  Getters – same API as old redisManager                    */
    /* ---------------------------------------------------------- */
    getClient(): RedisClient {
        if (!this.client || !this.isConnected) {
            console.warn('[REDIS] Client requested before ready – returning dummy');
            return new (require('ioredis'))({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                lazyConnect: true, // won’t connect until first command
            });
        }
        return this.client;
    }

    getPublisher(): RedisClient {          // ← NEW
        if (!this.publisher || !this.isConnected) {
            throw new AppError('Redis publisher not established', 500);
        }
        return this.publisher;
    }

    getSubscriber(): RedisClient {         // ← NEW
        if (!this.subscriber || !this.isConnected) {
            throw new AppError('Redis subscriber not established', 500);
        }
        return this.subscriber;
    }

    /* ---------------------------------------------------------- */
    /*  Health / disconnect / retry helpers – unchanged           */
    /* ---------------------------------------------------------- */
    async healthCheck(): Promise<boolean> {
        try {
            if (!this.client || !this.isConnected) return false;
            await this.client.ping();
            return true;
        } catch (err) {
            logger.error('Redis health-check failed:', err);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        await Promise.all([
            this.client?.quit(),
            this.publisher?.quit(),
            this.subscriber?.quit(),
        ]);
        this.isConnected = false;
        logger.info('Redis disconnected (client + pub + sub)');
    }

    get connectionStatus(): boolean { return this.isConnected; }
    get retryCount(): number { return this.connectionRetryCount; }

    /* ---------------------------------------------------------- */
    /*  Private helpers                                             */
    /* ---------------------------------------------------------- */

    private delay(ms: number): Promise<void> {
        return new Promise(res => setTimeout(res, ms));
    }

    private async handleConnectionError(error: unknown): Promise<void> {
        this.connectionRetryCount++;
        if (this.connectionRetryCount >= this.maxRetries) {
            throw new AppError(
                `Redis connection failed after ${this.maxRetries} attempts`,
                500
            );
        }
        logger.warn(`Redis retry ${this.connectionRetryCount}/${this.maxRetries}`);
        await this.delay(this.retryDelay);
        // allow the next await initializeRedis() to be called again
    }
}

/* ------------------------------------------------------------------ */
/*  Singleton & convenience exports                                   */
/* ------------------------------------------------------------------ */
export const redisConnection = RedisConnection.getInstance();

export const getRedisClient = (): RedisClient => redisConnection.getClient();
export const getRedisPublisher = (): RedisClient => redisConnection.getPublisher();
export const getRedisSubscriber = (): RedisClient => redisConnection.getSubscriber();

export async function connectRedis(): Promise<RedisClient> {
    return redisConnection.getClient(); // already connected, but keeps the old signature
}

export default redisConnection;