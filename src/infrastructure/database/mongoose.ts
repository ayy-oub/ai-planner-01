import mongoose from 'mongoose';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';

class MongoConnection {
    private static instance: MongoConnection;
    private isConnected = false;
    private connectionRetryCount = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 5000; // 5 seconds

    private constructor() {
        this.initializeMongoDB();
    }

    static getInstance(): MongoConnection {
        if (!MongoConnection.instance) {
            MongoConnection.instance = new MongoConnection();
        }
        return MongoConnection.instance;
    }

    private async initializeMongoDB(): Promise<void> {
        try {
            if (!config.mongo.uri) {
                logger.warn('MongoDB URI not configured, skipping MongoDB connection');
                return;
            }

            const mongoConfig = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
                bufferMaxEntries: 0,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                retryWrites: true,
                w: 'majority',
            };

            await mongoose.connect(config.mongo.uri, mongoConfig);

            this.setupEventHandlers();

            this.isConnected = true;
            this.connectionRetryCount = 0;
            logger.info('MongoDB connection established successfully');
        } catch (error) {
            logger.error('Failed to initialize MongoDB:', error);
            await this.handleConnectionError(error);
        }
    }

    private setupEventHandlers(): void {
        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connected');
            this.isConnected = true;
            this.connectionRetryCount = 0;
        });

        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
            this.isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
            this.isConnected = true;
            this.connectionRetryCount = 0;
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            await this.disconnect();
            process.exit(0);
        });
    }

    private async handleConnectionError(error: any): Promise<void> {
        this.connectionRetryCount++;

        if (this.connectionRetryCount < this.maxRetries) {
            logger.warn(`MongoDB connection retry ${this.connectionRetryCount}/${this.maxRetries}`);
            await this.delay(this.retryDelay);
            await this.initializeMongoDB();
        } else {
            logger.error('MongoDB connection failed after maximum retries');
            // Don't throw error for optional MongoDB
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getConnection() {
        if (!this.isConnected) {
            throw new AppError('MongoDB connection not established', 500);
        }
        return mongoose.connection;
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.isConnected) return false;

            await mongoose.connection.db.admin().ping();
            return true;
        } catch (error) {
            logger.error('MongoDB health check failed:', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await mongoose.connection.close();
            this.isConnected = false;
            logger.info('MongoDB connection closed');
        } catch (error) {
            logger.error('Error closing MongoDB connection:', error);
            throw new AppError('Failed to close MongoDB connection', 500);
        }
    }

    get connectionStatus(): boolean {
        return this.isConnected;
    }
}

// Export singleton instance
export const mongoConnection = MongoConnection.getInstance();
export default mongoConnection;