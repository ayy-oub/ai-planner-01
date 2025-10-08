import 'dotenv/config';
import 'module-alias/register';
import cluster from 'cluster';
import os from 'os';
import { createTerminus } from '@godaddy/terminus';
import app from './app';
import { config } from '@shared/config';
import { logger } from '@shared/utils/logger';
import { healthCheck } from '@infrastructure/monitoring/health-check';
import { connectDatabase } from '@infrastructure/database/firebase';
import { connectRedis } from '@infrastructure/database/redis';
import { gracefulShutdown } from '@shared/utils/graceful-shutdown';

const numCPUs = os.cpus().length;
const PORT = config.app.port;

async function startServer() {
    try {
        // Connect to databases
        await connectDatabase();
        await connectRedis();

        const server = app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT} in ${config.app.env} mode`);
            logger.info(`📊 Health check available at: http://localhost:${PORT}/health`);
            logger.info(`📚 API Docs available at: http://localhost:${PORT}/api-docs`);

            if (config.app.env === 'development') {
                logger.info(`🔧 Development mode enabled`);
                logger.info(`📖 Swagger documentation enabled`);
            }
        });

        // Graceful shutdown
        createTerminus(server, {
            signal: 'SIGINT',
            healthChecks: {
                '/health': healthCheck,
                '/health/live': healthCheck,
                '/health/ready': healthCheck,
            },
            onSignal: async () => {
                logger.info('Server is starting cleanup');
                await gracefulShutdown();
            },
            onShutdown: () => {
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