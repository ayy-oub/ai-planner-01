import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

class RedisConnection {
    private static instance: RedisConnection;
    private client: RedisClient | null = null;
    private isConnected = false;
    private connectionRetryCount = 0;
    private readonly maxRetries = 5;
    private readonly retryDelay = 3000; // 3 seconds

    private constructor() {
        void this.initializeRedis(); // fire-and-forget async init
    }

    static getInstance(): RedisConnection {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection();
        }
        return RedisConnection.instance;
    }

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
                        return null; // stop retrying
                    }
                    return this.retryDelay;
                },
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
            };

            this.client = new Redis(redisOptions);

            this.setupEventHandlers();

            await this.client.connect();

            this.isConnected = true;
            this.connectionRetryCount = 0;

            logger.info('Redis connection established successfully');
        } catch (error: unknown) {
            logger.error('Failed to initialize Redis:', error);
            await this.handleConnectionError(error);
        }
    }

    private setupEventHandlers(): void {
        if (!this.client) return;

        this.client.on('error', (error: unknown) => {
            logger.error('Redis client error:', error);
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            logger.info('Redis client connected');
            this.isConnected = true;
            this.connectionRetryCount = 0;
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
            this.isConnected = true;
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis client reconnecting...');
            this.connectionRetryCount++;
        });

        this.client.on('end', () => {
            logger.warn('Redis connection ended');
            this.isConnected = false;
        });
    }

    private async handleConnectionError(error: unknown): Promise<void> {
        this.connectionRetryCount++;

        if (this.connectionRetryCount < this.maxRetries) {
            logger.warn(`Redis connection retry ${this.connectionRetryCount}/${this.maxRetries}`);
            await this.delay(this.retryDelay);
            await this.initializeRedis();
        } else {
            throw new AppError('Redis connection failed after maximum retries', 500);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getClient(): RedisClient {
        if (!this.client || !this.isConnected) {
            throw new AppError('Redis connection not established', 500);
        }
        return this.client;
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.client || !this.isConnected) return false;

            await this.client.ping();
            return true;
        } catch (error: unknown) {
            logger.error('Redis health check failed:', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.client) {
                await this.client.quit();
                this.client = null;
                this.isConnected = false;
                logger.info('Redis connection closed');
            }
        } catch (error: unknown) {
            logger.error('Error closing Redis connection:', error);
            throw new AppError('Failed to close Redis connection', 500);
        }
    }

    get connectionStatus(): boolean {
        return this.isConnected;
    }

    get retryCount(): number {
        return this.connectionRetryCount;
    }
}

// Export singleton instance
export const redisConnection = RedisConnection.getInstance();

export async function connectRedis(): Promise<Redis | undefined> {
    await redisConnection.getClient().connect(); // Or ensure connected
    return redisConnection.getClient();
};

export default redisConnection;