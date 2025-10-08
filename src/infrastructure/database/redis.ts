import { createClient, RedisClientType } from 'redis';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

class RedisConnection {
    private static instance: RedisConnection;
    private client: RedisClientType | null = null;
    private isConnected = false;
    private connectionRetryCount = 0;
    private readonly maxRetries = 5;
    private readonly retryDelay = 3000; // 3 seconds

    private constructor() {
        this.initializeRedis();
    }

    static getInstance(): RedisConnection {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection();
        }
        return RedisConnection.instance;
    }

    private async initializeRedis(): Promise<void> {
        try {
            const connectionConfig = {
                socket: {
                    host: config.redis.host,
                    port: config.redis.port,
                    reconnectStrategy: (retries: number) => {
                        if (retries > this.maxRetries) {
                            logger.error('Max Redis reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        return Math.min(retries * 1000, 3000);
                    },
                },
                password: config.redis.password || undefined,
                database: config.redis.database || 0,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
            };

            this.client = createClient(connectionConfig);

            this.setupEventHandlers();

            await this.client.connect();

            this.isConnected = true;
            this.connectionRetryCount = 0;
            logger.info('Redis connection established successfully');
        } catch (error) {
            logger.error('Failed to initialize Redis:', error);
            await this.handleConnectionError(error);
        }
    }

    private setupEventHandlers(): void {
        if (!this.client) return;

        this.client.on('error', (error) => {
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

    private async handleConnectionError(error: any): Promise<void> {
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

    getClient(): RedisClientType {
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
        } catch (error) {
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
        } catch (error) {
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
export default redisConnection;