import 'reflect-metadata';
import 'dotenv/config';
import 'module-alias/register';
import cluster from 'cluster';
import os from 'os';
import { createTerminus } from '@godaddy/terminus';
import { config } from '../src/shared/config';
import { logger } from '../src/shared/utils/logger';
import { healthCheck } from '../src/infrastructure/monitoring/health-check';
import { connectDatabase } from '../src/infrastructure/database/firebase';
import { setupGracefulShutdown } from '../src/shared/utils/graceful-shutdown';
//import './types/xss-clean';
import { connectRedis } from './infrastructure/database/redis';
import createApp from './app';

const numCPUs = os.cpus().length;
const PORT = config.app.port;

async function startServer() {
    try {

        // Connect to other databases
        await connectDatabase();

        const redisClient = await connectRedis();

        const app = createApp();

        const server = app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT} in ${config.app.env} mode`);
            logger.info(`📊 Health check available at: http://localhost:${PORT}/health`);
            logger.info(`📚 API Docs available at: http://localhost:${PORT}/api-docs`);

            if (config.app.env === 'development') {
                logger.info(`🔧 Development mode enabled`);
                logger.info(`📖 Swagger documentation enabled`);
            }
        });

        const shutdownManager = setupGracefulShutdown(server, redisClient);

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
