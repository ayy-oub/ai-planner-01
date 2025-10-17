import 'reflect-metadata';
import 'dotenv/config';
import 'module-alias/register';
import cluster from 'cluster';
import os from 'os';
import { createTerminus } from '@godaddy/terminus';
import app from './app';
import { config } from '../src/shared/config';
import { logger } from '../src/shared/utils/logger';
import { healthCheck } from '../src/infrastructure/monitoring/health-check';
import { connectDatabase } from '../src/infrastructure/database/firebase';
import { setupGracefulShutdown } from '../src/shared/utils/graceful-shutdown';
// Removed: import '@/shared/container';
import '@/shared/xss-clean';
import { registerDependencies } from '@/shared/container';

const numCPUs = os.cpus().length;
const PORT = config.app.port;

async function startServer() {
    try {
        // Register dependencies first!
        await registerDependencies();

        // Connect to other databases
        await connectDatabase();

        // Now it's safe to resolve anything from the container
        // (No need to connect Redis here separately if container manages it)
        // But if you want to keep connectRedis here, be consistent

        const server = app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT} in ${config.app.env} mode`);
            logger.info(`📊 Health check available at: http://localhost:${PORT}/health`);
            logger.info(`📚 API Docs available at: http://localhost:${PORT}/api-docs`);

            if (config.app.env === 'development') {
                logger.info(`🔧 Development mode enabled`);
                logger.info(`📖 Swagger documentation enabled`);
            }
        });

        // Setup graceful shutdown with Redis client from container
        // Resolve redisClient from container if needed
        // const redisClient = container.resolve<Redis>('RedisClient');
        // or pass redisClient to shutdownManager if you want
        
        const shutdownManager = setupGracefulShutdown(server /*, redisClient */);

        createTerminus(server, {
            signal: 'SIGINT',
            healthChecks: {
                '/health': healthCheck,
                '/health/live': healthCheck,
                '/health/ready': healthCheck,
            },
            onSignal: async () => {
                logger.info('Server is starting cleanup');
                await shutdownManager.shutdown('SIGINT');
            },
            onShutdown: async () => {
                logger.info('Cleanup finished, server is shutting down');
            },
            timeout: 10000,
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Cluster mode for production
if (config.app.env === 'production' && cluster.isMaster) {
    logger.info(`Master ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart worker
    });
} else {
    startServer();
}
