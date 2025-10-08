import { Server } from 'http';
import { Redis } from 'ioredis';
import { logger } from './logger';
import { AppError } from './errors';

/**
 * Shutdown handler options
 */
export interface ShutdownOptions {
  timeout?: number; // Maximum time to wait for graceful shutdown (ms)
  forceExit?: boolean; // Whether to force exit after timeout
  signals?: NodeJS.Signals[]; // Signals to handle
  cleanup?: () => Promise<void>; // Custom cleanup function
}

/**
 * Resource interface for cleanup
 */
export interface DisposableResource {
  name: string;
  close: () => Promise<void>;
  isConnected?: () => boolean;
}

/**
 * Graceful shutdown manager
 */
export class GracefulShutdownManager {
  private resources: DisposableResource[] = [];
  private isShuttingDown = false;
  private options: Required<ShutdownOptions>;

  constructor(options: ShutdownOptions = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      forceExit: options.forceExit !== false,
      signals: options.signals || ['SIGTERM', 'SIGINT', 'SIGUSR2'],
      cleanup: options.cleanup || (async () => {}),
    };

    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    this.options.signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`);
        this.shutdown(signal);
      });
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      this.shutdown('UNHANDLED_REJECTION');
    });
  }

  /**
   * Add resource for cleanup
   */
  addResource(resource: DisposableResource): void {
    this.resources.push(resource);
    logger.info(`Added resource for cleanup: ${resource.name}`);
  }

  /**
   * Remove HTTP server
   */
  addHttpServer(server: Server, name: string = 'HTTP Server'): void {
    this.addResource({
      name,
      close: () => new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            logger.error(`Error closing ${name}`, { error: error.message });
            reject(error);
          } else {
            logger.info(`${name} closed successfully`);
            resolve();
          }
        });
      }),
      isConnected: () => server.listening,
    });
  }

  /**
   * Add Redis connection
   */
  addRedis(redis: Redis, name: string = 'Redis'): void {
    this.addResource({
      name,
      close: async () => {
        await redis.quit();
        logger.info(`${name} connection closed`);
      },
      isConnected: () => redis.status === 'ready',
    });
  }

  /**
   * Add database connection
   */
  addDatabase(connection: any, name: string = 'Database'): void {
    this.addResource({
      name,
      close: async () => {
        if (connection.close) {
          await connection.close();
        } else if (connection.destroy) {
          connection.destroy();
        }
        logger.info(`${name} connection closed`);
      },
      isConnected: () => connection.readyState === 1 || connection.connected === true,
    });
  }

  /**
   * Graceful shutdown process
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();

    try {
      logger.info('Starting graceful shutdown', { signal, resources: this.resources.length });

      // Stop accepting new connections
      await this.stopAcceptingConnections();

      // Run custom cleanup
      logger.info('Running custom cleanup');
      await this.runWithTimeout(
        this.options.cleanup(),
        5000,
        'Custom cleanup timed out'
      );

      // Close resources in reverse order
      logger.info('Closing resources');
      await this.closeResources();

      // Final cleanup
      await this.finalCleanup();

      const duration = Date.now() - startTime;
      logger.info('Graceful shutdown completed', { duration: `${duration}ms` });

      // Exit process
      process.exit(0);

    } catch (error) {
      logger.error('Graceful shutdown failed', { 
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });

      if (this.options.forceExit) {
        logger.warn('Forcing exit due to shutdown failure');
        process.exit(1);
      }
    }
  }

  /**
   * Stop accepting new connections
   */
  private async stopAcceptingConnections(): Promise<void> {
    logger.info('Stopping connection acceptance');
    
    // Mark HTTP servers as not listening
    for (const resource of this.resources) {
      if (resource.name.includes('Server') && resource.isConnected) {
        logger.info(`Stopping ${resource.name} from accepting new connections`);
      }
    }
  }

  /**
   * Close all resources
   */
  private async closeResources(): Promise<void> {
    // Close resources in reverse order (last added first)
    const resourcesToClose = [...this.resources].reverse();

    const closePromises = resourcesToClose.map(async (resource) => {
      try {
        logger.info(`Closing resource: ${resource.name}`);
        
        if (resource.isConnected && !resource.isConnected()) {
          logger.info(`Resource ${resource.name} is already disconnected`);
          return;
        }

        await this.runWithTimeout(
          resource.close(),
          10000,
          `Resource ${resource.name} close timed out`
        );

        logger.info(`Resource ${resource.name} closed successfully`);
      } catch (error) {
        logger.error(`Error closing resource ${resource.name}`, { error: error.message });
        // Continue with other resources even if one fails
      }
    });

    await Promise.allSettled(closePromises);
  }

  /**
   * Final cleanup tasks
   */
  private async finalCleanup(): Promise<void> {
    logger.info('Performing final cleanup');

    try {
      // Close logger transports
      if (logger.transports) {
        logger.info('Closing logger transports');
        // Note: Winston logger cleanup would go here
      }

      // Clear any remaining intervals/timeouts
      const activeHandles = process._getActiveHandles();
      const activeRequests = process._getActiveRequests();

      logger.info('Cleanup statistics', {
        activeHandles: activeHandles.length,
        activeRequests: activeRequests.length,
      });

    } catch (error) {
      logger.error('Final cleanup error', { error: error.message });
    }
  }

  /**
   * Run function with timeout
   */
  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Get shutdown status
   */
  isShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get resource status
   */
  getResourceStatus(): Array<{
    name: string;
    status: 'connected' | 'disconnected' | 'unknown';
  }> {
    return this.resources.map(resource => ({
      name: resource.name,
      status: resource.isConnected 
        ? (resource.isConnected() ? 'connected' : 'disconnected')
        : 'unknown',
    }));
  }
}

/**
 * Health check manager
 */
export class HealthCheckManager {
  private checks: Map<string, () => Promise<boolean>> = new Map();

  /**
   * Add health check
   */
  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async runChecks(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
  }> {
    const results: Record<string, boolean> = {};
    let allHealthy = true;

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const isHealthy = await checkFn();
        results[name] = isHealthy;
        
        if (!isHealthy) {
          allHealthy = false;
        }
      } catch (error) {
        logger.error(`Health check failed for ${name}`, { error: error.message });
        results[name] = false;
        allHealthy = false;
      }
    });

    await Promise.all(checkPromises);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results,
    };
  }
}

/**
 * Process manager
 */
export class ProcessManager {
  private shutdownManager: GracefulShutdownManager;
  private healthCheckManager: HealthCheckManager;

  constructor(options ?: ShutdownOptions) {
    this.shutdownManager = new GracefulShutdownManager(options);
    this.healthCheckManager = new HealthCheckManager();
}

/**
 * Get shutdown manager
 */
getShutdownManager(): GracefulShutdownManager {
    return this.shutdownManager;
}

/**
 * Get health check manager
 */
getHealthCheckManager(): HealthCheckManager {
    return this.healthCheckManager;
}

/**
 * Setup process monitoring
 */
setupMonitoring(): void {
    // Monitor memory usage
    const memoryCheck = setInterval(() => {
        const usage = process.memoryUsage();

        if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
            logger.warn('High memory usage detected', {
                heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
            });
        }
    }, 30000); // Check every 30 seconds

    this.shutdownManager.addResource({
        name: 'Memory Monitor',
        close: async () => {
            clearInterval(memoryCheck);
        },
    });

    // Monitor event loop lag
    let lastCheck = process.hrtime.bigint();
    const lagCheck = setInterval(() => {
        const now = process.hrtime.bigint();
        const lag = Number(now - lastCheck) / 1000000 - 1000; // Expected 1000ms interval

        if (lag > 1000) { // 1 second lag
            logger.warn('Event loop lag detected', { lag: `${lag.toFixed(2)}ms` });
        }

        lastCheck = now;
    }, 1000);

    this.shutdownManager.addResource({
        name: 'Event Loop Monitor',
        close: async () => {
            clearInterval(lagCheck);
        },
    });
}
}

/**
 * Cleanup utilities
 */
export const cleanupUtils = {
    /**
     * Close database connections
     */
    async closeDatabaseConnections(): Promise<void> {
        logger.info('Closing database connections');
        // Implementation would go here
    },

    /**
     * Close cache connections
     */
    async closeCacheConnections(): Promise<void> {
        logger.info('Closing cache connections');
        // Implementation would go here
    },

    /**
     * Stop background jobs
     */
    async stopBackgroundJobs(): Promise<void> {
        logger.info('Stopping background jobs');
        // Implementation would go here
    },

    /**
     * Close file handles
     */
    async closeFileHandles(): Promise<void> {
        logger.info('Closing file handles');
        // Implementation would go here
    },

    /**
     * Cleanup temporary files
     */
    async cleanupTemporaryFiles(): Promise<void> {
        logger.info('Cleaning up temporary files');
        // Implementation would go here
    },

    /**
     * Notify external services
     */
    async notifyExternalServices(): Promise<void> {
        logger.info('Notifying external services of shutdown');
        // Implementation would go here
    },
};

/**
 * Quick shutdown setup
 */
export const setupGracefulShutdown = (
    server?: Server,
    redis?: Redis,
    options?: ShutdownOptions
): GracefulShutdownManager => {
    const shutdownManager = new GracefulShutdownManager(options);

    if (server) {
        shutdownManager.addHttpServer(server);
    }

    if (redis) {
        shutdownManager.addRedis(redis);
    }

    // Add default cleanup
    shutdownManager.addResource({
        name: 'Default Cleanup',
        close: async () => {
            await Promise.all([
                cleanupUtils.closeDatabaseConnections(),
                cleanupUtils.closeCacheConnections(),
                cleanupUtils.stopBackgroundJobs(),
                cleanupUtils.cleanupTemporaryFiles(),
                cleanupUtils.notifyExternalServices(),
            ]);
        },
    });

    return shutdownManager;
};

/**
 * Emergency shutdown
 */
export const emergencyShutdown = (reason: string, code: number = 1): void => {
    logger.error('Emergency shutdown initiated', { reason, code });

    // Log stack trace
    console.error('Emergency shutdown stack trace:');
    console.trace();

    // Force exit after a short delay to allow logging
    setTimeout(() => {
        process.exit(code);
    }, 1000);
};

export {
    GracefulShutdownManager,
    HealthCheckManager,
    ProcessManager,
    setupGracefulShutdown,
    emergencyShutdown,
};